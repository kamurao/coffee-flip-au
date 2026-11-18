let dealsPayload = null;
let catalogData = [];

const BROKEN_CLIENT_REGEX =
  /\b(broken|for\s+parts|parts\s+only|spare\s+parts|not\s+working|doesn['’]?t\s+work|faulty|needs?\s+(?:a\s+)?repairs?|needs?\s+(?:a\s+)?servic(?:e|ing)|leaking|leaks?|won['’]?t\s+turn\s+on|no\s+power|tripping|error\s+code|cracked|damaged|as[\s-]+is|untested|fixer[\s-]+upper)\b/i;

function fmtAUD(n) {
  return `$${Number(n).toLocaleString("en-AU")}`;
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

function renderStats(data) {
  const s = data.stats || {};
  const hotCount = (data.deals || []).filter((d) => d.tier === "50%+").length;
  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-card"><div class="stat-label">Active Deals</div><div class="stat-val">${s.dealsFound ?? 0}</div></div>
    <div class="stat-card"><div class="stat-label">🔥 50%+ Flips</div><div class="stat-val">${hotCount}</div></div>
    <div class="stat-card"><div class="stat-label">Broken Rejected</div><div class="stat-val">${s.rejectedBroken ?? 0}</div></div>
    <div class="stat-card"><div class="stat-label">Scanned</div><div class="stat-val">${s.scanned ?? 0}</div></div>
  `;
  const when = data.generatedAt ? new Date(data.generatedAt).toLocaleString("en-AU") : "Never";
  document.getElementById("statusLine").textContent =
    `${data.location || "Australia"} • Mode: ${(data.mode || "demo").toUpperCase()} • Updated: ${when}`;
}

function renderDeals() {
  const list = document.getElementById("dealsList");
  if (!dealsPayload || !Array.isArray(dealsPayload.deals)) {
    list.innerHTML = `<div class="card">No scan data found yet.</div>`;
    return;
  }

  const q = document.getElementById("dealSearch").value.trim().toLowerCase();
  const filter = document.getElementById("dealFilter").value;
  const sort = document.getElementById("dealSort").value;

  let items = dealsPayload.deals.filter((d) => {
    if (filter === "50+" && d.tier !== "50%+") return false;
    if ((filter === "espresso_machine" || filter === "grinder") && d.subCategory !== filter) return false;
    if (q) {
      const hay = `${d.title} ${d.brand} ${d.model} ${d.location}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  items = [...items].sort((a, b) => {
    if (sort === "profitAUD") return b.netProfitAUD - a.netProfitAUD;
    if (sort === "priceAsc") return a.askPriceAUD - b.askPriceAUD;
    return b.profitPct - a.profitPct;
  });

  if (items.length === 0) {
    list.innerHTML = `<div class="card">No matching deals under current filters.</div>`;
    return;
  }

  list.innerHTML = items
    .map(
      (d) => `
      <article class="card">
        <div class="card-head">
          <div>
            <div class="deal-model">${d.brand} ${d.model}</div>
            <h3 class="deal-title">${d.title}</h3>
          </div>
          <span class="badge ${d.tier === "50%+" ? "badge-hot" : "badge-good"}">
            ${d.tier === "50%+" ? "🔥" : "✅"} +${d.profitPct}%
          </span>
        </div>
        <div class="price-row">
          <div class="price-box"><small>Ask</small><strong>${fmtAUD(d.askPriceAUD)}</strong></div>
          <div class="price-box"><small>Est. Resale</small><strong>${fmtAUD(d.resaleMedianAUD)}</strong></div>
          <div class="price-box"><small>Est. Profit</small><strong class="profit-text">+${fmtAUD(d.netProfitAUD)}</strong></div>
        </div>
        <div class="deal-meta">
          <span class="badge badge-liq">${d.liquidity.toUpperCase()} VOLUME</span>
          &nbsp;📍 ${d.location}
        </div>
        ${d.notes ? `<div class="deal-notes">${d.notes}</div>` : ""}
        ${d.url ? `<a class="btn-link" href="${d.url}" target="_blank" rel="noopener">Open on FB Marketplace →</a>` : ""}
      </article>
    `
    )
    .join("");
}

function renderCatalog() {
  const q = document.getElementById("catalogSearch").value.trim().toLowerCase();
  const typeFilter = document.getElementById("catalogType").value;
  const tbody = document.getElementById("catalogBody");

  const rows = catalogData.filter((item) => {
    if (typeFilter === "all" && item.category !== "coffee") return false;
    if (typeFilter !== "all" && item.subCategory !== typeFilter) return false;
    if (q && !`${item.brand} ${item.model}`.toLowerCase().includes(q)) return false;
    return true;
  });

  tbody.innerHTML = rows
    .map((item) => {
      const max50 = Math.floor(item.resaleMedianAUD / 1.5);
      const max30 = Math.floor(item.resaleMedianAUD / 1.3);
      return `
        <tr>
          <td><strong>${item.brand} ${item.model}</strong></td>
          <td>${item.subCategory.replace("_", " ")}</td>
          <td><strong>${fmtAUD(max50)}</strong></td>
          <td>${fmtAUD(max30)}</td>
          <td>${fmtAUD(item.resaleMedianAUD)} <span class="muted">(${fmtAUD(item.resaleLowAUD)}–${fmtAUD(item.resaleHighAUD)})</span></td>
          <td><span class="badge badge-liq">${item.liquidity.toUpperCase()}</span></td>
        </tr>
      `;
    })
    .join("");
}

function setupChecker() {
  document.getElementById("checkerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("chkTitle").value.trim();
    const price = Number(document.getElementById("chkPrice").value);
    const desc = document.getElementById("chkDesc").value.trim();
    const out = document.getElementById("checkerResult");
    out.classList.remove("hidden");

    const sanitized = `${title} ${desc}`
      .replace(/\bno\s+leaks?\b/gi, "")
      .replace(/\bdoesn['’]?t\s+leak\b/gi, "")
      .replace(/\bno\s+issues?\b/gi, "");

    if (price > 1000) {
      out.innerHTML = `❌ <strong>Over $1,000 AUD cap</strong> (Ask: ${fmtAUD(price)}).`;
      return;
    }
    if (BROKEN_CLIENT_REGEX.test(sanitized)) {
      out.innerHTML = `⛔ <strong>Rejected (Broken / Parts / Faulty)</strong> — matches fault keywords.`;
      return;
    }

    const match = catalogData.find((item) => {
      const hit = item.patterns.some((p) => new RegExp(p, "i").test(`${title}\n${desc}`));
      const excl = (item.excludePatterns || []).some((p) => new RegExp(p, "i").test(`${title}\n${desc}`));
      return hit && !excl;
    });

    if (!match) {
      out.innerHTML = `⚠️ <strong>No catalog match</strong> — model not in high-volume resale list. Check sold comps manually.`;
      return;
    }

    const profit = Math.round(match.resaleMedianAUD - price);
    const pct = Math.round((profit / price) * 100);
    const verdict =
      pct >= 50 ? "🔥 STRONG 50%+ FLIP" : pct >= 30 ? "✅ GOOD 30%+ FLIP" : "❌ BELOW 30% TARGET";

    out.innerHTML = `
      <div><strong>${verdict}</strong></div>
      <div>Matched: <strong>${match.brand} ${match.model}</strong> (${match.liquidity.toUpperCase()} volume)</div>
      <div>Est. Resale: <strong>${fmtAUD(match.resaleMedianAUD)} AUD</strong> | Est. Profit: <strong class="profit-text">+${fmtAUD(profit)} (${pct}%)</strong></div>
      <div class="muted">${match.notes}</div>
    `;
  });
}

async function init() {
  setupTabs();
  setupChecker();
  ["dealSearch", "dealFilter", "dealSort"].forEach((id) =>
    document.getElementById(id).addEventListener("input", renderDeals)
  );
  ["catalogSearch", "catalogType"].forEach((id) =>
    document.getElementById(id).addEventListener("input", renderCatalog)
  );

  try {
    const [dealsRes, catRes] = await Promise.all([
      fetch("./data/deals.json"),
      fetch("./data/catalog.json"),
    ]);
    dealsPayload = await dealsRes.json();
    catalogData = await catRes.json();
    renderStats(dealsPayload);
    renderDeals();
    renderCatalog();
  } catch (err) {
    document.getElementById("statusLine").textContent = "Failed to load data files.";
  }
}

init();
