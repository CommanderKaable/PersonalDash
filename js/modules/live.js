// Sources the BROWSER may fetch directly (they send CORS headers).
// Used by the refresh buttons to get fresher data than the 30-minute GitHub Actions cache.
// Everything else (Yahoo, NHL, RSS) can only be refreshed by the Action.

export async function liveHackerNews(sourceName = "Hacker News") {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12");
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return data.hits.map((h) => ({
    title: h.title,
    link: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    comments: `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points,
    source: sourceName,
    date: h.created_at,
  }));
}

export async function liveCrypto(list) {
  const ids = list.map((c) => c.id).join(",");
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=sek&include_24hr_change=true`);
  if (!res.ok) throw new Error(res.status);
  const data = await res.json();
  return list.map((c) => ({
    name: c.name,
    group: "Krypto",
    price: data[c.id]?.sek ?? null,
    change: data[c.id]?.sek_24h_change ?? null,
    currency: "SEK",
  }));
}
