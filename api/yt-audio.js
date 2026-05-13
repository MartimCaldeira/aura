/**
 * Extrai o stream de áudio directamente do YouTube usando a Innertube
 * API com o cliente ANDROID — devolve URLs sem cipher na maioria dos casos.
 *
 * Fallback: múltiplas instâncias públicas do cobalt.tools
 */

// ── Innertube Android client ──────────────────────────────────────────────────
const ANDROID_KEY = 'AIzaSyA8eiZmM1lafRM_uo-ou6T3VOqEQkd_n8c';
const ANDROID_UA  = 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip';
const ANDROID_CTX = {
  client: {
    clientName:       'ANDROID',
    clientVersion:    '19.09.37',
    androidSdkVersion: 30,
    userAgent:        ANDROID_UA,
    hl: 'en', gl: 'US',
  },
};

// ── Cobalt fallback instances ─────────────────────────────────────────────────
const COBALT_INSTANCES = [
  'https://cobalt.api.timelessnesses.me',
  'https://cob.nadeko.net',
  'https://cobalt.catvibers.me',
  'https://api.cobalt.tools',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getYouTubeStreamUrl(videoId) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${ANDROID_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type':             'application/json',
        'User-Agent':               ANDROID_UA,
        'X-YouTube-Client-Name':    '3',
        'X-YouTube-Client-Version': '19.09.37',
        'Origin':                   'https://www.youtube.com',
      },
      body: JSON.stringify({
        context:       ANDROID_CTX,
        videoId,
        contentCheckOk: true,
        racyCheckOk:    true,
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) throw new Error(`YouTube player API: HTTP ${res.status}`);

  const data    = await res.json();
  const formats = data.streamingData?.adaptiveFormats || [];

  // Filtrar streams de áudio apenas com URL directa (sem cipher)
  const audio = formats.filter(f =>
    f.mimeType?.startsWith('audio/') &&
    f.url &&
    !f.signatureCipher &&
    !f.cipher
  );

  if (audio.length === 0) throw new Error('Stream requer desencriptação — não suportado');

  // Preferir m4a (AAC) para máxima compatibilidade com browsers
  const m4a = audio.filter(f => f.mimeType?.includes('mp4a'));
  const pool = m4a.length > 0 ? m4a : audio;

  const best = pool.sort(
    (a, b) => (b.averageBitrate || b.bitrate || 0) - (a.averageBitrate || a.bitrate || 0)
  )[0];

  return {
    url:      best.url,
    mimeType: (best.mimeType || 'audio/mp4').split(';')[0].trim(),
    ext:      best.mimeType?.includes('mp4a') ? 'm4a' : 'webm',
  };
}

async function getCobaltUrl(videoId, instance) {
  const r = await fetch(`${instance}/`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'User-Agent':   'Aura/1.0',
    },
    body: JSON.stringify({
      url:           `https://www.youtube.com/watch?v=${videoId}`,
      downloadMode:  'audio',
      audioFormat:   'mp3',
      audioBitrate:  '128',
      filenameStyle: 'basic',
    }),
    signal: AbortSignal.timeout(18000),
  });

  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (d.status === 'error') throw new Error(d.error?.code || 'cobalt error');
  if (!d.url) throw new Error('cobalt: sem URL');

  return { url: d.url, mimeType: 'audio/mpeg', ext: 'mp3' };
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Video ID inválido.' });
  }

  let streamInfo = null;
  const errors   = [];

  // ── Tentativa 1: Innertube Android (sem terceiros) ────────────────────────
  try {
    streamInfo = await getYouTubeStreamUrl(id);
    console.log(`[yt-audio] Innertube OK → ${streamInfo.ext} ${streamInfo.mimeType}`);
  } catch (e) {
    errors.push(`Innertube: ${e.message}`);
    console.warn('[yt-audio] Innertube falhou:', e.message);
  }

  // ── Tentativa 2: Cobalt instances ─────────────────────────────────────────
  if (!streamInfo) {
    for (const inst of COBALT_INSTANCES) {
      try {
        streamInfo = await getCobaltUrl(id, inst);
        console.log(`[yt-audio] Cobalt OK via ${inst}`);
        break;
      } catch (e) {
        errors.push(`${inst}: ${e.message}`);
        console.warn(`[yt-audio] ${inst} falhou:`, e.message);
      }
    }
  }

  if (!streamInfo) {
    return res.status(502).json({
      error: `Não foi possível obter o áudio. Erros: ${errors.join(' | ')}`,
    });
  }

  // ── Fazer download do stream e servir ao cliente ───────────────────────────
  try {
    const audioRes = await fetch(streamInfo.url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-' },
      signal:  AbortSignal.timeout(55000),
    });

    if (!audioRes.ok) throw new Error(`Download HTTP ${audioRes.status}`);

    const buffer = await audioRes.arrayBuffer();

    res.setHeader('Content-Type',        streamInfo.mimeType);
    res.setHeader('Content-Length',      buffer.byteLength);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.${streamInfo.ext}"`);
    res.setHeader('X-Audio-Format',      streamInfo.ext);   // client usa isto para saber a extensão
    return res.send(Buffer.from(buffer));

  } catch (e) {
    console.error('[yt-audio] Download falhou:', e.message);
    return res.status(502).json({ error: `Download falhou: ${e.message}` });
  }
};
