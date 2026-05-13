// Pesquisa YouTube via instâncias públicas do Invidious (sem chave de API)
const INSTANCES = [
  'iv.nboeck.de',
  'invidious.io.lol',
  'yt.cdaut.de',
  'inv.tux.pizza',
  'invidious.privacyredirect.com',
];

async function tryFetch(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const { q, id } = req.query;

  // ── Lookup de um vídeo específico por ID ──────────────────────────────────
  if (id) {
    for (const inst of INSTANCES) {
      try {
        const data = await tryFetch(
          `https://${inst}/api/v1/videos/${id}?fields=videoId,title,author,lengthSeconds`
        );
        if (!data || !data.videoId) continue;
        return res.json({
          results: [{
            id:       data.videoId,
            title:    data.title    || 'Sem título',
            author:   data.author   || 'Desconhecido',
            duration: data.lengthSeconds || null,
            thumb:    `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg`,
          }],
        });
      } catch { /* tentar próxima instância */ }
    }
    // Fallback: retorna info mínima mesmo sem a instância
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

  // ── Pesquisa por texto ────────────────────────────────────────────────────
  if (!q || !q.trim()) return res.json({ results: [] });

  for (const inst of INSTANCES) {
    try {
      const data = await tryFetch(
        `https://${inst}/api/v1/search?q=${encodeURIComponent(q.trim())}&type=video&fields=videoId,title,author,lengthSeconds`
      );
      if (!Array.isArray(data) || data.length === 0) continue;

      return res.json({
        results: data.slice(0, 8).map(v => ({
          id:       v.videoId,
          title:    v.title    || 'Sem título',
          author:   v.author   || 'Desconhecido',
          duration: v.lengthSeconds || null,
          thumb:    `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
        })),
      });
    } catch { /* tentar próxima instância */ }
  }

  return res.json({
    results: [],
    error: 'Pesquisa indisponível. Cola o link do YouTube directamente.',
  });
};
