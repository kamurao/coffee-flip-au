/**
 * Send mobile push alerts for newly discovered high-margin deals.
 * Supports ntfy.sh (zero-signup mobile app), Discord Webhook, and Telegram Bot.
 */
export async function sendAlerts(newDeals, env = process.env) {
  if (!Array.isArray(newDeals) || newDeals.length === 0) {
    return { sent: 0, channels: [] };
  }

  const channels = [];
  const ntfyTopic = env.NTFY_TOPIC?.trim();
  const discordUrl = env.DISCORD_WEBHOOK_URL?.trim();
  const tgToken = env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChatId = env.TELEGRAM_CHAT_ID?.trim();

  // ntfy.sh topics are public: anyone who knows the name can read or spoof alerts.
  if (ntfyTopic && ntfyTopic.length < 20) {
    console.warn(
      "[CoffeeFlip AU] Warning: NTFY_TOPIC is short and may be guessable. Use a long random name (see README)."
    );
  }

  for (const deal of newDeals) {
    const emoji = deal.tier === "50%+" ? "🔥" : "✅";
    const summary = `${emoji} ${deal.brand} ${deal.model} — $${deal.askPriceAUD} AUD (Est. Resale $${deal.resaleMedianAUD} | +$${deal.netProfitAUD} / +${deal.profitPct}%)`;
    const body = [
      `Ask: $${deal.askPriceAUD} AUD`,
      `Est. Resale: $${deal.resaleMedianAUD} AUD (range $${deal.resaleLowAUD}–$${deal.resaleHighAUD})`,
      `Est. Profit: +$${deal.netProfitAUD} AUD (+${deal.profitPct}%)`,
      `Liquidity: ${deal.liquidity.toUpperCase()} | Location: ${deal.location}`,
      deal.url ? `Link: ${deal.url}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (ntfyTopic) {
      const server = env.NTFY_SERVER?.trim() || "https://ntfy.sh";
      await fetch(`${server}/${encodeURIComponent(ntfyTopic)}`, {
        method: "POST",
        headers: {
          Title: summary,
          Priority: deal.tier === "50%+" ? "high" : "default",
          Tags: deal.tier === "50%+" ? "fire,coffee" : "white_check_mark,coffee",
          ...(deal.url ? { Click: deal.url } : {}),
        },
        body,
      });
      if (!channels.includes("ntfy")) channels.push("ntfy");
    }

    if (discordUrl) {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: summary,
              url: deal.url || undefined,
              description: body,
              color: deal.tier === "50%+" ? 0xef4444 : 0x10b981,
            },
          ],
        }),
      });
      if (!channels.includes("discord")) channels.push("discord");
    }

    if (tgToken && tgChatId) {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: `${summary}\n\n${body}`,
          disable_web_page_preview: false,
        }),
      });
      if (!channels.includes("telegram")) channels.push("telegram");
    }
  }

  return { sent: newDeals.length, channels };
}
