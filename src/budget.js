/**
 * Apify free-plan budget guard.
 * The actor bills per returned listing, so we cap listings per month and rotate
 * through the search queries a few at a time.
 */
export function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function loadUsage(raw, now = new Date()) {
  const month = currentMonth(now);
  if (!raw || raw.month !== month) {
    return { month, runs: 0, resultsBilled: 0, cursor: raw?.cursor ?? 0 };
  }
  return { month, runs: raw.runs || 0, resultsBilled: raw.resultsBilled || 0, cursor: raw.cursor || 0 };
}

/** Pick the next `queriesPerRun` queries, rotating through the full list. */
export function pickRotation(queries, cursor, queriesPerRun) {
  if (queries.length === 0) return { picked: [], nextCursor: 0 };
  const n = Math.min(queriesPerRun, queries.length);
  const picked = [];
  for (let i = 0; i < n; i++) picked.push(queries[(cursor + i) % queries.length]);
  return { picked, nextCursor: (cursor + n) % queries.length };
}

/** Worst case listings this run may bill (assumes resultsLimit applies per URL). */
export function worstCaseResults(urlCount, resultsPerQuery) {
  return urlCount * resultsPerQuery;
}

export function canAfford(usage, worstCase, monthlyBudget) {
  return usage.resultsBilled + worstCase <= monthlyBudget;
}
