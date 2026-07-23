import { readDb, writeDb } from './db.ts';
import { sendWhatsAppReminder } from './whatsapp.ts';

export async function checkAndSendUpcomingEventReminders(baseUrl?: string): Promise<{ checked: number; sent: number }> {
  let sentCount = 0;
  let checkedCount = 0;

  try {
    const db = await readDb();
    const now = Date.now();
    const LOOKAHEAD_WINDOW_MS = 36 * 60 * 60 * 1000; // 36 hours window for 24h reminders

    const defaultHost = baseUrl || process.env.APP_URL || 'http://localhost:3000';

    for (const booking of db.bookings) {
      if (booking.payment_status !== 'paid' || booking.cancelled_at || booking.reminder_sent) {
        continue;
      }

      const event = db.events.find((e: any) => e.id === booking.event_id);
      if (!event || !event.event_date) continue;

      checkedCount++;
      const eventTime = new Date(event.event_date).getTime();
      if (isNaN(eventTime)) continue;

      const timeUntilEvent = eventTime - now;

      // Identify upcoming events starting within ~24 hours (0 to 36h from now)
      if (timeUntilEvent > 0 && timeUntilEvent <= LOOKAHEAD_WINDOW_MS) {
        const downloadUrl = `${defaultHost}/api/tickets/${booking.id}/download`;
        
        console.log(`[BACKGROUND REMINDER TASK] Event "${event.title}" is in ~${Math.round(timeUntilEvent / 3600000)}h. Triggering WhatsApp reminder to ${booking.guest_name}...`);

        if (booking.guest_phone) {
          try {
            await sendWhatsAppReminder(booking, event, downloadUrl);
            booking.reminder_sent = true;
            booking.reminder_sent_at = new Date().toISOString();
            sentCount++;
          } catch (err) {
            console.error(`[BACKGROUND REMINDER ERROR] Failed for booking ${booking.id}:`, err);
          }
        } else {
          booking.reminder_sent = true;
          booking.reminder_sent_at = new Date().toISOString();
        }
      }
    }

    if (sentCount > 0) {
      await writeDb(db);
    }
  } catch (err) {
    console.error('[BACKGROUND REMINDER SERVICE ERROR]', err);
  }

  return { checked: checkedCount, sent: sentCount };
}

let reminderIntervalTimer: NodeJS.Timeout | null = null;

export function startReminderScheduler(intervalMs = 15 * 60 * 1000) {
  if (reminderIntervalTimer) return;

  console.log('[REMINDER SERVICE] Background WhatsApp reminder task scheduler initialized.');
  
  // Run once on startup after 5 seconds
  setTimeout(() => {
    checkAndSendUpcomingEventReminders().catch(err => console.error('[REMINDER TASK STARTUP ERROR]', err));
  }, 5000);

  // Run periodically every interval (default 15 mins)
  reminderIntervalTimer = setInterval(() => {
    checkAndSendUpcomingEventReminders().catch(err => console.error('[REMINDER TASK CRON ERROR]', err));
  }, intervalMs);
}
