const BROKEN_PATTERNS = [
  /\bbroken\b/i,
  /\bfor\s+parts\b/i,
  /\bparts\s+only\b/i,
  /\bspare\s+parts\b/i,
  /\bspares\s*(?:or|\/)\s*repairs?\b/i,
  /\bnot\s+working\b/i,
  /\bdoesn['’]?t\s+work\b/i,
  /\bdoes\s+not\s+work\b/i,
  /\bfaulty\b/i,
  /\bneeds?\s+(?:a\s+)?repairs?\b/i,
  /\bneeds?\s+(?:a\s+)?servic(?:e|ing)\b/i,
  /\bleaking\b/i,
  /\bleaks?\b/i,
  /\bwon['’]?t\s+turn\s+on\b/i,
  /\bno\s+power\b/i,
  /\btripping\b/i,
  /\btrips\s+(?:the\s+)?(?:safety|power|rcd|switch)\b/i,
  /\berror\s+code\b/i,
  /\bpump\s+(?:is\s+)?dead\b/i,
  /\bboiler\s+issue\b/i,
  /\bwon['’]?t\s+heat\b/i,
  /\bno\s+steam\b/i,
  /\bcracked\b/i,
  /\bdamaged\b/i,
  /\bas[\s-]+is\b/i,
  /\buntested\b/i,
  /\bfixer[\s-]+upper\b/i,
  /\bproject\s+machine\b/i,
];

const SOLD_PATTERNS = [
  /\bpending\s+pickup\b/i,
  /\bdeposit\s+taken\b/i,
  /^\s*\[?sold\]?\b/i,
];

const ACCESSORY_ONLY_TITLE_PATTERNS = [
  /^(?:\d+mm\s+)?(?:bottomless\s+)?portafilter\b/i,
  /^(?:coffee\s+)?tamper\b/i,
  /^dosing\s+(?:ring|funnel|cup)\b/i,
  /^knock\s+box\b/i,
  /^(?:water\s+)?filters?\b/i,
  /^descal(?:er|ing)\b/i,
  /^(?:group\s+)?(?:seal|gasket|o-?ring|shower\s+screen)\b/i,
  /^drip\s+tray\b/i,
  /^(?:bean\s+)?hopper\s+only\b/i,
];

const ACCESSORY_ONLY_DESC_PATTERNS = [
  /\bno\s+machine\s+included\b/i,
  /\bmachine\s+not\s+included\b/i,
  /\bportafilter\s+only\b/i,
  /\baccessories\s+only\b/i,
  /\bbox\s+only\b/i,
];

/**
 * Strip benign negations ("no leaks", "doesn't leak", "no faults") before checking broken keywords.
 */
function sanitizeNegations(text) {
  return text
    .replace(/\bno\s+leaks?\b/gi, "")
    .replace(/\bdoesn['’]?t\s+leak\b/gi, "")
    .replace(/\bdoes\s+not\s+leak\b/gi, "")
    .replace(/\bno\s+faults?\b/gi, "")
    .replace(/\bno\s+issues?\b/gi, "")
    .replace(/\bnot\s+broken\b/gi, "")
    .replace(/\bnot\s+damaged\b/gi, "");
}

/**
 * Check if a listing should be rejected (broken, faulty, sold, accessory-only, or out of price range).
 * @param {object} listing
 * @param {object} filters
 * @returns {{ rejected: boolean, reason: string | null }}
 */
export function evaluateListingFilter(listing, filters = {}) {
  const minPrice = filters.minPriceAUD ?? 30;
  const maxPrice = filters.maxPriceAUD ?? 1000;
  const excludePendingOrSold = filters.excludePendingOrSold ?? true;
  const excludeAccessoriesOnly = filters.excludeAccessoriesOnly ?? true;

  const price = Number(listing.price);
  if (!Number.isFinite(price) || price < minPrice) {
    return { rejected: true, reason: `Price below minimum ($${minPrice} AUD)` };
  }
  if (price > maxPrice) {
    return { rejected: true, reason: `Price above maximum ($${maxPrice} AUD)` };
  }

  const title = String(listing.title || "").trim();
  const description = String(listing.description || "").trim();
  const combined = sanitizeNegations(`${title}\n${description}`);

  for (const pattern of BROKEN_PATTERNS) {
    if (pattern.test(combined)) {
      return { rejected: true, reason: `Broken/faulty keyword matched: ${pattern}` };
    }
  }

  if (excludePendingOrSold) {
    const rawCombined = `${title}\n${description}`;
    for (const pattern of SOLD_PATTERNS) {
      if (pattern.test(rawCombined)) {
        return { rejected: true, reason: "Listing marked sold/pending" };
      }
    }
  }

  if (excludeAccessoriesOnly) {
    for (const pattern of ACCESSORY_ONLY_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        return { rejected: true, reason: "Accessory-only listing (title)" };
      }
    }
    for (const pattern of ACCESSORY_ONLY_DESC_PATTERNS) {
      if (pattern.test(description)) {
        return { rejected: true, reason: "Accessory-only listing (description)" };
      }
    }
  }

  return { rejected: false, reason: null };
}

/**
 * Parse dimensions like "110 x 45 x 70 cm" or "900 x 400 x 650 mm" and verify Suzuki Swift fit.
 * If no dimensions are found in text, returns { fits: true, parsedCm: null }.
 */
export function fitsSuzukiSwift(text, maxCm = { length: 120, width: 80, height: 70 }) {
  const str = String(text || "");
  const match = str.match(
    /(\d+(?:\.\d+)?)\s*(cm|mm)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(cm|mm)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(cm|mm)\b/i
  );
  if (!match) {
    return { fits: true, parsedCm: null };
  }

  const unit = (match[6] || match[4] || match[2] || "cm").toLowerCase();
  const scale = unit === "mm" ? 0.1 : 1;
  const dims = [
    Number(match[1]) * scale,
    Number(match[3]) * scale,
    Number(match[5]) * scale,
  ].sort((a, b) => b - a);

  const limits = [maxCm.length, maxCm.width, maxCm.height].sort((a, b) => b - a);
  const fits = dims[0] <= limits[0] && dims[1] <= limits[1] && dims[2] <= limits[2];

  return { fits, parsedCm: dims };
}
