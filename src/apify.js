/**
 * Build Facebook Marketplace search URLs for active categories and call Apify Actor.
 */
export function buildSearchUrls(settings) {
  const citySlug = settings.location?.citySlug || "melbourne";
  const maxPrice = settings.filters?.maxPriceAUD ?? 1000;
  const activeCategories = settings.categories || { coffee: true };
  const queryMap = settings.apify?.searchQueries || {};

  const queries = [];
  for (const [cat, enabled] of Object.entries(activeCategories)) {
    if (enabled && Array.isArray(queryMap[cat])) {
      queries.push(...queryMap[cat]);
    }
  }

  return queries.map((q) => {
    const encoded = encodeURIComponent(q);
    return `https://www.facebook.com/marketplace/${citySlug}/search/?query=${encoded}&maxPrice=${maxPrice}&daysSinceListed=1`;
  });
}

function parsePrice(raw) {
  if (typeof raw === "number") return raw;
  if (raw && typeof raw === "object") {
    if (raw.amount !== undefined) return parsePrice(raw.amount);
    if (raw.formatted_amount) return parsePrice(raw.formatted_amount);
  }
  const str = String(raw || "").replace(/[^0-9.]/g, "");
  const num = Number(str);
  return Number.isFinite(num) ? num : NaN;
}

export function normalizeApifyListing(raw) {
  const id =
    raw.id ||
    raw.listingId ||
    raw.listing_id ||
    raw.url?.match(/\/item\/(\d+)/)?.[1] ||
    raw.listingUrl?.match(/\/item\/(\d+)/)?.[1] ||
    `${raw.title || raw.marketplace_listing_title || "item"}-${parsePrice(raw.price || raw.listing_price)}`;

  const title =
    raw.marketplace_listing_title ||
    raw.title ||
    raw.name ||
    "";

  const price = parsePrice(raw.listing_price ?? raw.price ?? raw.amount);

  const location =
    raw.location?.reverse_geocode?.city_page?.display_name ||
    raw.location?.reverse_geocode?.city ||
    (typeof raw.location === "string" ? raw.location : "") ||
    raw.locationText ||
    "";

  const description =
    raw.redacted_description?.text ||
    raw.description ||
    raw.subtitle ||
    "";

  const url =
    raw.url ||
    raw.listingUrl ||
    (id && /^\d+$/.test(String(id))
      ? `https://www.facebook.com/marketplace/item/${id}`
      : "");

  const image =
    raw.primary_listing_photo?.image?.uri ||
    raw.image ||
    raw.imageUrl ||
    (Array.isArray(raw.images) ? raw.images[0] : "") ||
    "";

  return {
    id: String(id),
    title: String(title).trim(),
    price,
    location: String(location).trim(),
    description: String(description).trim(),
    url: String(url).trim(),
    image: String(image).trim(),
    postedAt: raw.creation_time
      ? new Date(Number(raw.creation_time) * 1000).toISOString()
      : raw.postedAt || new Date().toISOString(),
  };
}

/**
 * Fetch listings from Apify Facebook Marketplace Scraper Actor.
 */
export async function fetchMarketplaceListings(settings, token) {
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }

  const actorId = settings.apify?.actorId || "apify~facebook-marketplace-scraper";
  const resultsPerQuery = settings.apify?.resultsPerQuery ?? 25;
  const startUrls = buildSearchUrls(settings).map((url) => ({ url }));

  if (startUrls.length === 0) {
    return [];
  }

  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls,
      resultsLimit: resultsPerQuery,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Apify API error (${res.status}): ${body.slice(0, 300)}`);
  }

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  // Deduplicate by listing ID across overlapping search queries
  const byId = new Map();
  for (const raw of items) {
    const norm = normalizeApifyListing(raw);
    if (norm.id && !byId.has(norm.id)) {
      byId.set(norm.id, norm);
    }
  }

  return Array.from(byId.values());
}
