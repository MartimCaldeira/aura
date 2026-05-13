/**
 * Obtém URL de áudio directa do YouTube via @distube/ytdl-core
 * (resolve cipher, não faz stream — o cliente descarrega directamente)
 */

const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Video ID inválido.' });
  }

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${id}`, {
      // iOS client bypasses bot detection better than the default WEB client
      playerClients: ['ios', 'mweb'],
      requestOptions: {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    const allAudio = ytdl.filterFormats(info.formats, 'audioonly');
    if (!allAudio.length) {
      return res.status(502).json({ error: 'Nenhum formato de áudio disponível.' });
    }

    // Prefer m4a (mp4 container / mp4a codec), fall back to anything
    const m4a  = allAudio.filter(f => f.container === 'mp4' || f.mimeType?.includes('mp4a'));
    const pool = m4a.length ? m4a : allAudio;
    const fmt  = ytdl.chooseFormat(pool, { quality: 'highestaudio' });

    const ext      = fmt.container === 'webm' ? 'webm' : 'm4a';
    const mimeType = fmt.mimeType?.split(';')[0] || (ext === 'webm' ? 'audio/webm' : 'audio/mp4');

    console.log(`[ytdl] OK → ${ext} @ ${fmt.averageBitrate || fmt.bitrate}bps`);

    // Return the direct (deciphered) URL — browser downloads from YouTube directly.
    // This avoids proxying the whole file through Vercel (timeout / memory issues).
    return res.json({ url: fmt.url, mimeType, ext });

  } catch (err) {
    console.error('[ytdl] erro:', err.message);
    return res.status(502).json({ error: `Não foi possível obter o áudio: ${err.message}` });
  }
};
