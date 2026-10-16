// Мгновенный алерт в Telegram при поступлении жалобы (LogEntry с
// type=COMPLAINT, kind=COMPLAINT — не отзыв) — чтобы руководитель узнавал
// сразу, а не на утренней проверке журнала. Шлётся напрямую через
// Telegram Bot API (без похода в бота на Render) из server actions
// logs/actions.ts. TELEGRAM_BOT_TOKEN/TELEGRAM_ALERT_CHAT_IDS — те же
// значения, что в .env бота (токен и ALLOWED_TELEGRAM_USER_IDS), заданы
// отдельно здесь как переменные окружения Vercel. Если не настроены —
// тихо ничего не делает (не должно ломать сохранение записи).
export async function notifyComplaintAlert(employeeName: string, date: string, notes: string | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = (process.env.TELEGRAM_ALERT_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const text = [`⚠️ Жалоба — ${employeeName}`, `Дата: ${date}`, notes ? `Комментарий: ${notes}` : null].filter(Boolean).join("\n");

  await Promise.all(
    chatIds.map(async (chatId) => {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        if (!res.ok) {
          console.error("Telegram alert failed", chatId, await res.text());
        }
      } catch (e) {
        console.error("Telegram alert error", chatId, e);
      }
    })
  );
}
