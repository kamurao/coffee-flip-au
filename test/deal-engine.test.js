import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateListingFilter, fitsSuzukiSwift } from "../src/filter.js";
import { matchCatalogItem } from "../src/matcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "data/catalog.json"), "utf8"));
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, "config/settings.json"), "utf8"));

test("rejects broken, leaking, parts-only, and tripping listings", () => {
  const badListings = [
    { id: "1", title: "Breville BES920 for parts only", price: 200, description: "" },
    { id: "2", title: "Breville Barista Express", price: 150, description: "Leaking from bottom, needs repair" },
    { id: "3", title: "Rancilio Silvia", price: 300, description: "Tripping safety switch when heated" },
    { id: "4", title: "Niche Zero", price: 250, description: "Not working, no power" },
    { id: "5", title: "Breville Dual Boiler", price: 400, description: "Selling as is, untested" },
  ];

  for (const item of badListings) {
    const res = evaluateListingFilter(item, settings.filters);
    assert.equal(res.rejected, true, `Expected rejection for: ${item.title}`);
  }
});

test("allows benign negations like 'no leaks' and 'no issues'", () => {
  const good = {
    id: "10",
    title: "Breville Dual Boiler BES920",
    price: 520,
    description: "Works great, no leaks, no issues, recently descaled.",
  };
  const res = evaluateListingFilter(good, settings.filters);
  assert.equal(res.rejected, false);
});

test("rejects accessory-only listings and out-of-range prices", () => {
  const portafilter = {
    id: "11",
    title: "58mm Bottomless Portafilter for Breville BES920",
    price: 45,
    description: "Portafilter only, no machine included.",
  };
  assert.equal(evaluateListingFilter(portafilter, settings.filters).rejected, true);

  const tooExpensive = {
    id: "12",
    title: "Rocket Appartamento",
    price: 1450,
    description: "Mint condition",
  };
  assert.equal(evaluateListingFilter(tooExpensive, settings.filters).rejected, true);

  const placeholder = {
    id: "13",
    title: "Breville Barista Express",
    price: 1,
    description: "Message for price",
  };
  assert.equal(evaluateListingFilter(placeholder, settings.filters).rejected, true);
});

test("matches catalog models accurately and enforces 30% / 50% profit tiers", () => {
  const bes920Hot = {
    id: "20",
    title: "Breville Dual Boiler BES920BSS",
    price: 500,
    description: "Great working order",
  };
  const matchHot = matchCatalogItem(bes920Hot, catalog, settings);
  assert.ok(matchHot);
  assert.equal(matchHot.catalogId, "breville-bes920");
  assert.equal(matchHot.tier, "50%+");
  assert.equal(matchHot.netProfitAUD, 400);
  assert.equal(matchHot.profitPct, 80);

  const bes878LowMargin = {
    id: "21",
    title: "Breville Barista Pro BES878",
    price: 620,
    description: "Works great",
  };
  const matchLow = matchCatalogItem(bes878LowMargin, catalog, settings);
  assert.equal(matchLow, null, "Should reject <30% profit margin");
});

test("Suzuki Swift dimension checker handles cm and mm", () => {
  assert.equal(fitsSuzukiSwift("Sideboard 115 x 45 x 70 cm").fits, true);
  assert.equal(fitsSuzukiSwift("Cabinet 1150 x 450 x 700 mm").fits, true);
  assert.equal(fitsSuzukiSwift("Large dining table 180 x 90 x 75 cm").fits, false);
  assert.equal(fitsSuzukiSwift("Herman Miller Aeron chair, great condition").fits, true);
});
