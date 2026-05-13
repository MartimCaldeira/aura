/**
 * Pesquisa YouTube usando a Innertube API (API interna do youtube.com)
 * e lookup de vídeo por ID via oEmbed API oficial.
 * Nenhuma chave de API necessária.
 */

// Chave pública embebida pelo próprio youtube.com no cliente web
const YT_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const INNERTUBE_CONTEXT = {
  client: {
    clientName:    'WEB',
    clientVersion: '2.20231121.08.00',
    hl:            'pt',
    gl:            'PT',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDuration(str) {
  // "3:45" → 225 s   "1:23:45" → 5025 s
  if (!str) return null;
  const parts = str.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parseInnertubeResults(data) {
  const out = [];
  try {
    const sections =
      data?.contents
          ?.twoColumnSearchResultsRenderer
          ?.primaryContents
          ?.sectionListRenderer
          ?.contents ?? [];

    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents ?? [];
      for (const item of items) {
        const vr = item?.videoRenderer;
        if (!vr?.videoId) continue;

        const title  = vr.title?.runs?.[0]?.text
                    || vr.title?.simpleText
                    || 'Sem título';
        const author = vr.ownerText?.runs?.[0]?.text
                    || vr.shortBylineText?.runs?.[0]?.text
                    || 'Desconhecido';
        const lenStr = vr.lengthText?.simpleText || '';

        out.push({
          id:       vr.videoId,
          title,
          author,
          duration: parseDuration(lenStr),
          thumb:    `https://img.youtube.com/vi/${vr.videoId}/mqdefault.jpg`,
        });

        if (out.length >= 8) return out;
      }
    }
  } catch (e) {
    console.error('[parseInnertubeResults]', e.message);
  }
  return out;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { q, id } = req.query;

  // ── Lookup por ID (oEmbed — API oficial, sem autenticação) ────────────────
  if (id) {
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(id)}&format=json`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (r.ok) {
        const d = await r.json();
        return res.json({
          results: [{
            id,
            title:    d.title       || 'Sem título',
            author:   d.author_name || 'Desconhecido',
            duration: null,
            thumb:    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
          }],
        });
      }
    } catch (e) {
      console.warn('[yt-search] oEmbed falhou:', e.message);
    }
    // Fallback mínimo
    return res.json({
      results: [{
        id,
        title:    'Vídeo do YouTube',
        author:   'Desconhecido',
        duration: null,
        thumb:    `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
      }],
    });
  }

  // ── Pesquisa por texto (Innertube API) ─────────────────────────────────────
  const query = (q || '').trim();
  if (!query) return res.json({ results: [] });

  try {
    const r = await fetch(
      `https://www.youtube.com/youtubei/v1/search?key=${YT_KEY}&prettyPrint=false`,
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
          'Origin':  'https://www.youtube.com',
          'Referer': `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          'X-YouTube-Client-Name':    '1',
          'X-YouTube-Client-Version': '2.20231121.08.00',
        },
        body: JSON.stringify({
          context: INNERTUBE_CONTEXT,
          query,
          params: 'EgIQAQ==',   // filtro: só vídeos
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const data    = await r.json();
    const results = parseInnertubeResults(data);

    if (results.length === 0) {
      return res.json({ results: [], error: 'Sem resultados para essa pesquisa.' });
    }
    return res.json({ results });

  } catch (err) {
    console.error('[yt-search] Innertube falhou:', err.message);
    return res.json({
      results: [],
      error: 'Pesquisa indisponível. Cola o link do YouTube directamente.',
    });
  }
};
