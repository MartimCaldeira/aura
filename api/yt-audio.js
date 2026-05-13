/**
 * Obtém stream de áudio do YouTube em cascata:
 *   1. Piped API (piped.video — frontend open-source com proxy próprio)
 *   2. Innertube iOS client (às vezes devolve URLs directas sem cipher)
 *   3. Innertube TV embedded player (muito estável)
 *   4. Cobalt instances (último recurso)
 */

// ── Piped public instances ────────────────────────────────────────────────────
const PIPED = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.in',
  'https://pipedapi.adminforge.de',
  'https://watchapi.whatever.social',
];

// ── Innertube: iOS client ────────────────────────────────────────────────────
const IOS = {
  key:  'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
  ctx:  {
    client: {
      clientName:    'IOS',
      clientVersion: '19.09.3',
      deviceModel:   'iPhone16,2',
      userAgent:     'com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_3_1 like Mac OS X;)',
      osName:        'iPhone',
      osVersion:     '17.3.1.21D61',
      hl: 'en', gl: 'US',
    },
  },
  hdrs: {
    'X-YouTube-Client-Name':    '5',
    'X-YouTube-Client-Version': '19.09.3',
    'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone16,2; U; CPU iOS 17_3_1 like Mac OS X;)',
  },
};

// ── Innertube: TV embedded player (very stable, returns direct URLs) ──────────
const TV = {
  key:  'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
  ctx:  {
    client: {
      clientName:    'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      clientVersion: '2.0',
      platform:      'TV',
      hl: 'en', gl: 'US',
    },
    thirdParty: { embedUrl: 'https://www.youtube.com/' },
  },
  hdrs: {
    'X-YouTube-Client-Name':    '85',
    'X-YouTube-Client-Version': '2.0',
    'User-Agent': 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/6.0 TV Safari/538.1',
  },
};

// ── Cobalt ────────────────────────────────────────────────────────────────────
const COBALT = [
  'https://cobalt.api.timelessnesses.me',
  'https://cob.nadeko.net',
  'https://cobalt.catvibers.me',
  'https://api.cobalt.tools',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function bestAudio(formats) {
  if (!formats?.length) return null;
  const m4a  = formats.filter(f => f.mimeType?.includes('mp4a') || f.format === 'M4A');
  const pool = m4a.length ? m4a : formats;
  return pool.sort((a, b) =>
    (b.averageBitrate || b.bitrate || b.audioBitrate || 0) -
    (a.averageBitrate || a.bitrate || a.audioBitrate || 0)
  )[0];
}

async function tryPiped(videoId) {
  for (const inst of PIPED) {
    try {
      const r = await fetch(`${inst}/streams/${videoId}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
        signal:  AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const d = await r.json();
      if (d.error || !d.audioStreams?.length) continue;

      const best = bestAudio(d.audioStreams);
      if (!best?.url) continue;

      const ext = (best.format || 'm4a').toLowerCase() === 'm4a' ? 'm4a' : 'webm';
      console.log(`[piped] OK via ${inst} → ${ext}`);
      return { url: best.url, mimeType: best.mimeType?.split(';')[0] || 'audio/mp4', ext };
    } catch (e) {
      console.warn(`[piped] ${inst}: ${e.message}`);
    }
  }
  throw new Error('Piped: todas as instâncias falharam');
}

async function tryInnertube(client, label, videoId) {
  const r = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${client.key}&prettyPrint=false`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...client.hdrs },
      body:    JSON.stringify({ context: client.ctx, videoId, contentCheckOk: true, racyCheckOk: true }),
      signal:  AbortSignal.timeout(15000),
    }
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d       = await r.json();
  const formats = (d.streamingData?.adaptiveFormats || []).filter(
    f => f.mimeType?.startsWith('audio/') && f.url && !f.signatureCipher && !f.cipher
  );
  const best = bestAudio(formats);
  if (!best) throw new Error('sem URL directa');
  const ext = best.mimeType?.includes('mp4a') ? 'm4a' : 'webm';
  console.log(`[innertube/${label}] OK → ${ext} @ ${best.averageBitrate || best.bitrate}bps`);
  return { url: best.url, mimeType: best.mimeType?.split(';')[0] || 'audio/mp4', ext };
}

async function tryCobalt(videoId) {
  for (const inst of COBALT) {
    try {
      const r = await fetch(`${inst}/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Aura/1.0' },
        body:    JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }),
        signal:  AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (d.status === 'error' || !d.url) throw new Error(d.error?.code || 'no url');
      console.log(`[cobalt] OK via ${inst}`);
      return { url: d.url, mimeType: 'audio/mpeg', ext: 'mp3' };
    } catch (e) {
      console.warn(`[cobalt] ${inst}: ${e.message}`);
    }
  }
  throw new Error('Cobalt: todas as instâncias falharam');
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Video ID inválido.' });
  }

  const errors = [];
  let   stream = null;

  const attempt = async (label, fn) => {
    if (stream) return;
    try   { stream = await fn(); }
    catch (e) { errors.push(`${label}: ${e.message}`); }
  };

  await attempt('Piped',        () => tryPiped(id));
  await attempt('Innertube/iOS',() => tryInnertube(IOS, 'ios', id));
  await attempt('Innertube/TV', () => tryInnertube(TV,  'tv',  id));
  await attempt('Cobalt',       () => tryCobalt(id));

  if (!stream) {
    console.error('[yt-audio] Todos os métodos falharam:', errors);
    return res.status(502).json({
      error: `Não foi possível obter o áudio.\n${errors.join('\n')}`,
    });
  }

  // Fazer download e servir ao cliente
  try {
    const audioRes = await fetch(stream.url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-' },
      signal:  AbortSignal.timeout(55000),
    });
    if (!audioRes.ok) throw new Error(`Download HTTP ${audioRes.status}`);

    const buf = await audioRes.arrayBuffer();
    res.setHeader('Content-Type',        stream.mimeType);
    res.setHeader('Content-Length',      buf.byteLength);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.${stream.ext}"`);
    res.setHeader('X-Audio-Format',      stream.ext);
    return res.send(Buffer.from(buf));
  } catch (e) {
    console.error('[yt-audio] Download do stream falhou:', e.message);
    return res.status(502).json({ error: `Download falhou: ${e.message}` });
  }
};
