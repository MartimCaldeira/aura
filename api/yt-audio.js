/**
 * Converte vídeo YouTube → MP3 usando cobalt.tools (open-source)
 * e serve o áudio diretamente ao browser.
 * https://github.com/imputnet/cobalt
 */

const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt.api.timelessnesses.me',  // instância pública alternativa
];

async function getCobaltUrl(videoId, instance) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const res = await fetch(`${instance}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'User-Agent':   'Aura/1.0 (https://github.com/MartimCaldeira/aura)',
    },
    body: JSON.stringify({
      url:           ytUrl,
      downloadMode:  'audio',
      audioFormat:   'mp3',
      audioBitrate:  '128',
      filenameStyle: 'basic',
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`cobalt HTTP ${res.status}`);

  const data = await res.json();

  if (data.status === 'error') {
    throw new Error(`cobalt: ${data.error?.code || 'unknown error'}`);
  }
  if (!data.url) throw new Error('cobalt: sem URL de download');

  return data.url;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Video ID inválido.' });
  }

  let audioUrl = null;
  let lastErr  = null;

  // Tentar cada instância do cobalt até uma funcionar
  for (const instance of COBALT_INSTANCES) {
    try {
      audioUrl = await getCobaltUrl(id, instance);
      break;
    } catch (e) {
      lastErr = e;
      console.warn(`[yt-audio] ${instance} falhou:`, e.message);
    }
  }

  if (!audioUrl) {
    console.error('[yt-audio] Todas as instâncias falharam:', lastErr?.message);
    return res.status(502).json({
      error: `Não foi possível converter: ${lastErr?.message || 'erro desconhecido'}. Tenta colar o URL do áudio directamente.`,
    });
  }

  // Fazer download do áudio e servir ao cliente
  try {
    const audioRes = await fetch(audioUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal:  AbortSignal.timeout(55000),
    });

    if (!audioRes.ok) throw new Error(`Download falhou: HTTP ${audioRes.status}`);

    const buffer      = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';

    res.setHeader('Content-Type',        contentType);
    res.setHeader('Content-Length',      buffer.byteLength);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.mp3"`);
    return res.send(Buffer.from(buffer));

  } catch (e) {
    console.error('[yt-audio] Download falhou:', e.message);
    return res.status(502).json({ error: `Download falhou: ${e.message}` });
  }
};
