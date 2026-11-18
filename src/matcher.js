/**
 * Match a listing against the curated resale catalog and compute AUD profit metrics.
 * @param {object} listing
 * @param {Array<object>} catalog
 * @param {object} settings
 * @returns {object | null}
 */
export function matchCatalogItem(listing, catalog, settings) {
  const title = String(listing.title || "");
  const description = String(listing.description || "");
  const searchText = `${title}\n${description}`;
  const activeCategories = settings.categories || { coffee: true };

  let bestMatch = null;

  for (const item of catalog) {
    if (!activeCategories[item.category]) continue;

    const matchesPrimary = (item.patterns || []).some((p) => new RegExp(p, "i").test(title)) ||
      (item.patterns || []).some((p) => new RegExp(p, "i").test(searchText));
    if (!matchesPrimary) continue;

    const excluded = (item.excludePatterns || []).some((p) => new RegExp(p, "i").test(searchText));
    if (excluded) continue;

    // Prefer title matches over description-only matches
    const titleHit = (item.patterns || []).some((p) => new RegExp(p, "i").test(title));
    const score = (titleHit ? 100 : 10) + (item.demandScore || 5);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { item, score };
    }
  }

  if (!bestMatch) return null;

  const item = bestMatch.item;
  const askPrice = Number(listing.price);
  const prepBuffer = settings.filters?.prepBufferAUD ?? 0;
  const minProfitPct = settings.filters?.minProfitPct ?? 30;
  const highProfitPct = settings.filters?.highProfitPct ?? 50;

  const estimatedResaleAUD = item.resaleMedianAUD;
  const netProfitAUD = Math.round(estimatedResaleAUD - askPrice - prepBuffer);
  const profitPct = askPrice > 0 ? Math.round((netProfitAUD / askPrice) * 100) : 0;

  if (profitPct < minProfitPct) {
    return null;
  }

  const maxBuyFor30Pct = Math.floor((estimatedResaleAUD - prepBuffer) / 1.3);
  const maxBuyFor50Pct = Math.floor((estimatedResaleAUD - prepBuffer) / 1.5);

  return {
    id: String(listing.id),
    title: listing.title,
    askPriceAUD: askPrice,
    location: listing.location || settings.location?.displayName || "Australia",
    url: listing.url || "",
    image: listing.image || "",
    description: listing.description || "",
    postedAt: listing.postedAt || new Date().toISOString(),
    catalogId: item.id,
    category: item.category,
    subCategory: item.subCategory,
    brand: item.brand,
    model: item.model,
    resaleLowAUD: item.resaleLowAUD,
    resaleMedianAUD: item.resaleMedianAUD,
    resaleHighAUD: item.resaleHighAUD,
    netProfitAUD,
    profitPct,
    tier: profitPct >= highProfitPct ? "50%+" : "30%+",
    liquidity: item.liquidity,
    demandScore: item.demandScore,
    maxBuyFor30Pct,
    maxBuyFor50Pct,
    notes: item.notes || "",
  };
}
