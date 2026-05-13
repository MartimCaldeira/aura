// Converte vídeo do YouTube para MP3 usando cobalt.tools e devolve o áudio ao cliente
// cobalt.tools é open-source e não requer chave para uso pessoal: https://github.com/imputnet/cobalt

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Video ID inválido' });
  }

  const ytUrl = `https://www.youtube.com/watch?v=${id}`;

  try {
    // ── 1. Obter URL de download via cobalt.tools ──────────────────────────
    const cobaltRes = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Aura/1.0 (personal music player)',
      },
      body: JSON.stringify({
        url:            ytUrl,
        downloadMode:   'audio',
        audioFormat:    'mp3',
        audioBitrate:   '128',
        filenameStyle:  'basic',
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!cobaltRes.ok) {
      throw new Error(`cobalt.tools respondeu com erro ${cobaltRes.status}`);
    }

    const cobalt = await cobaltRes.json();

    if (cobalt.status === 'error') {
      const code = cobalt.error?.code || 'erro desconhecido';
      throw new Error(`cobalt: ${code}`);
    }

    if (!cobalt.url) {
      throw new Error('cobalt não devolveu URL de download');
    }

    // ── 2. Fazer download do áudio ─────────────────────────────────────────
    const audioRes = await fetch(cobalt.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(50000),
    });

    if (!audioRes.ok) {
      throw new Error(`Download falhou: HTTP ${audioRes.status}`);
    }

    const buffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';

    // ── 3. Enviar ao cliente ───────────────────────────────────────────────
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${id}.mp3"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('[yt-audio]', err.message);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: err.message });
  }
};
