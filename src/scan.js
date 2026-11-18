import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateListingFilter, fitsSuzukiSwift } from "./filter.js";
import { matchCatalogItem } from "./matcher.js";
import { fetchMarketplaceListings } from "./apify.js";
import { sendAlerts } from "./notify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function writeJson(relPath, data) {
  const fullPath = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function main() {
  const isDemo = process.argv.includes("--demo");
  const settings = readJson("config/settings.json");
  const catalog = readJson("data/catalog.json");
  const seenState = readJson("data/seen.json");
  const seenSet = new Set(seenState.seenIds || []);

  const token = process.env.APIFY_TOKEN?.trim();
  const useDemo = isDemo || !token;
  const mode = useDemo ? "demo" : "live";

  if (!isDemo && !token) {
    console.log("[CoffeeFlip AU] APIFY_TOKEN not set — running in demo mode with sample listings.");
  }

  const rawListings = useDemo
    ? readJson("data/demo-listings.json")
    : await fetchMarketplaceListings(settings, token);

  let rejectedBroken = 0;
  let matchedCatalog = 0;
  const deals = [];
  const newDeals = [];

  for (const listing of rawListings) {
    const filterResult = evaluateListingFilter(listing, settings.filters);
    if (filterResult.rejected) {
      rejectedBroken++;
      continue;
    }

    const deal = matchCatalogItem(listing, catalog, settings);
    if (!deal) continue;

    if (deal.category === "furniture") {
      const swiftCheck = fitsSuzukiSwift(
        `${listing.title} ${listing.description}`,
        settings.suzukiSwiftMaxCm
      );
      if (!swiftCheck.fits) continue;
    }

    matchedCatalog++;
    deals.push(deal);

    if (!seenSet.has(deal.id)) {
      newDeals.push(deal);
      seenSet.add(deal.id);
    }
  }

  // Sort highest profit % first, then net profit AUD
  deals.sort((a, b) => b.profitPct - a.profitPct || b.netProfitAUD - a.netProfitAUD);

  const output = {
    generatedAt: new Date().toISOString(),
    location: settings.location?.displayName || "Australia",
    mode,
    stats: {
      scanned: rawListings.length,
      rejectedBroken,
      matchedCatalog,
      dealsFound: deals.length,
    },
    deals,
  };

  writeJson("data/deals.json", output);
  writeJson("docs/data/deals.json", output);
  writeJson("docs/data/catalog.json", catalog);
  writeJson("data/seen.json", {
    seenIds: Array.from(seenSet).slice(-2000),
    lastRunAt: output.generatedAt,
  });

  if (!useDemo && newDeals.length > 0) {
    const alertResult = await sendAlerts(newDeals);
    console.log(`[CoffeeFlip AU] Sent ${alertResult.sent} alert(s) via: ${alertResult.channels.join(", ") || "none configured"}`);
  }

  console.log(
    `[CoffeeFlip AU] Mode=${mode} | Scanned=${output.stats.scanned} | Rejected=${rejectedBroken} | Deals=${deals.length} | New=${newDeals.length}`
  );
}

main().catch((err) => {
  console.error("[CoffeeFlip AU] Scan failed:", err);
  process.exit(1);
});
