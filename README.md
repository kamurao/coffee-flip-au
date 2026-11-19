# CoffeeFlip AU ☕

Automated, **PC-free** Facebook Marketplace deal finder for **high-volume, high-quality coffee equipment** in **Australia (AUD)**.

- **Budget cap:** Everything under **$1,000 AUD**
- **Profit target:** Minimum **30% profit** (with **🔥 50%+ Flip** alerts)
- **No broken equipment:** Automatically rejects parts-only, leaking, faulty, tripping, untested, or accessory-only listings
- **PC-free scanning:** Runs twice daily on GitHub Actions + Apify's free $5/month tier (budget-guarded, ~750 listings/month) and sends instant push alerts to your phone
- **Mobile Web Dashboard:** Hosted on GitHub Pages (`docs/`), including a **Quick Listing Checker** and **Buy Target Cheat Sheet**

---

## 5-Minute Setup (No PC Required After Setup)

### 1. Get a free Apify API token
1. Sign up at [apify.com](https://apify.com) (Free plan gives **$5/month** in credits, no credit card required).
2. Go to **Settings → Integrations** and copy your **Personal API Token**.

### 2. Set up instant phone notifications (easiest: ntfy.sh)
1. Install the free **ntfy** app on iOS or Android.
2. Subscribe to a unique private topic name, e.g. `coffeeflip-au-yourname-9482`.
   *(Alternatively, you can use a Discord Webhook or Telegram Bot.)*

### 3. Add GitHub Secrets
In this repository, go to **Settings → Secrets and variables → Actions → New repository secret**:
- `APIFY_TOKEN` — your Apify API token
- `NTFY_TOPIC` — your private ntfy topic name *(or `DISCORD_WEBHOOK_URL`, or `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`)*

### 4. Set your Australian city
Edit [`config/settings.json`](config/settings.json) and change `location.citySlug` (e.g. `melbourne`, `sydney`, `brisbane`, `perth`, `adelaide`).

### 5. Enable GitHub Pages (Mobile Dashboard)
1. Go to **Settings → Pages**.
2. Set **Source** to `Deploy from a branch`, **Branch** to `main`, and folder to `/docs`.
3. Open your published URL on your phone!

---

## Optional Categories (3D Printers & Suzuki Swift Furniture)
In [`config/settings.json`](config/settings.json), you can toggle:
- `"printers": true` — Bambu Lab A1 / A1 Mini / P1S, Prusa MK3S+ / MK4
- `"furniture": true` — Automatically checks parsed dimensions against **Suzuki Swift** rear-seats-folded cargo space (**120 × 80 × 70 cm**).

---

## Local Development & Testing
```bash
# Run unit tests
npm test

# Run offline demo scan & populate docs/data/deals.json
npm run scan:demo
```
