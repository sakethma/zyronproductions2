import fs from 'fs/promises';
import path from 'path';

export interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'failed' | 'simulated';
  error?: string;
  previewUrl?: string;
}

export async function sendWhatsAppConfirmation(
  booking: any,
  event: any,
  passDownloadUrl: string
): Promise<WhatsAppMessageResult> {
  const ticketId = booking.ticket_id || booking.id.substring(0, 8).toUpperCase();
  const phone = booking.guest_phone || 'N/A';
  const guestName = booking.guest_name || 'Guest';

  const messageText = `🎉 *Booking Confirmed! - Zyron Productions*\n\nHi *${guestName}*, your pass for *${event.title}* has been verified & approved!\n\n🎟️ *Ticket ID:* ${ticketId}\n📋 *Booking Ref:* ${booking.id.split('-')[0].toUpperCase()}\n👥 *Passes:* ${booking.quantity}x ${booking.tier.toUpperCase()}\n📅 *Event Date:* ${event.event_date}\n📍 *Venue:* ${event.location}\n\n👇 *Download Your Digital Ticket Pass (PDF):*\n${passDownloadUrl}\n\nPresent your Ticket QR Code at the venue entrance for fast check-in. Welcome to Zyron!`;

  console.log(`[WHATSAPP DISPATCH] To: ${phone} (${guestName}) | Ticket ID: ${ticketId}`);
  console.log(`[WHATSAPP MESSAGE BODY]:\n${messageText}`);

  // Check if WhatsApp API env variables exist (Meta Cloud API / Twilio)
  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  let apiSuccess = false;
  let messageId = `WA_${Date.now()}_${ticketId}`;

  if (metaToken && phoneId) {
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: messageText }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        messageId = data.messages?.[0]?.id || messageId;
        apiSuccess = true;
      }
    } catch (err) {
      console.error('[WHATSAPP API ERROR]', err);
    }
  }

  // Save to persistent WhatsApp Log for UI audit & dev verification
  try {
    const LOG_DIR = path.join(process.cwd(), 'data');
    const LOG_PATH = path.join(LOG_DIR, 'whatsapp_logs.json');
    await fs.mkdir(LOG_DIR, { recursive: true });

    let logs: any[] = [];
    try {
      const raw = await fs.readFile(LOG_PATH, 'utf-8');
      logs = JSON.parse(raw);
    } catch {
      logs = [];
    }

    // Direct WhatsApp web deep link for quick testing
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const waDeepLink = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageText)}`;

    logs.unshift({
      id: messageId,
      booking_id: booking.id,
      ticket_id: ticketId,
      phone,
      guest_name: guestName,
      message: messageText,
      pass_url: passDownloadUrl,
      wa_deep_link: waDeepLink,
      status: apiSuccess ? 'sent' : 'simulated',
      sent_at: new Date().toISOString()
    });

    await fs.writeFile(LOG_PATH, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch (logErr) {
    console.error('Failed to write WhatsApp log file:', logErr);
  }

  return {
    success: true,
    messageId,
    status: apiSuccess ? 'sent' : 'simulated'
  };
}

export async function sendWhatsAppReminder(
  booking: any,
  event: any,
  passDownloadUrl: string
): Promise<WhatsAppMessageResult> {
  const ticketId = booking.ticket_id || booking.id.substring(0, 8).toUpperCase();
  const phone = booking.guest_phone || 'N/A';
  const guestName = booking.guest_name || 'Guest';

  const messageText = `⏰ *Event Reminder! - Zyron Productions*\n\nHi *${guestName}*, your upcoming event *${event.title}* is starting in 24 hours!\n\n🎟️ *Ticket ID:* ${ticketId}\n📅 *Event Date:* ${event.event_date}\n📍 *Venue:* ${event.location}\n\n👇 *Download Your Digital Ticket Pass (PDF):*\n${passDownloadUrl}\n\nPresent your Ticket QR Code at the venue entrance for fast check-in. See you there!`;

  console.log(`[WHATSAPP REMINDER DISPATCH] To: ${phone} (${guestName}) | Ticket ID: ${ticketId}`);
  console.log(`[WHATSAPP REMINDER BODY]:\n${messageText}`);

  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  let apiSuccess = false;
  let messageId = `WA_REMINDER_${Date.now()}_${ticketId}`;

  if (metaToken && phoneId) {
    try {
      const formattedPhone = phone.replace(/[^0-9]/g, '');
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: messageText }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        messageId = data.messages?.[0]?.id || messageId;
        apiSuccess = true;
      }
    } catch (err) {
      console.error('[WHATSAPP REMINDER API ERROR]', err);
    }
  }

  try {
    const LOG_DIR = path.join(process.cwd(), 'data');
    const LOG_PATH = path.join(LOG_DIR, 'whatsapp_logs.json');
    await fs.mkdir(LOG_DIR, { recursive: true });

    let logs: any[] = [];
    try {
      const raw = await fs.readFile(LOG_PATH, 'utf-8');
      logs = JSON.parse(raw);
    } catch {
      logs = [];
    }

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const waDeepLink = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageText)}`;

    logs.unshift({
      id: messageId,
      booking_id: booking.id,
      ticket_id: ticketId,
      phone,
      guest_name: guestName,
      type: 'reminder',
      message: messageText,
      pass_url: passDownloadUrl,
      wa_deep_link: waDeepLink,
      status: apiSuccess ? 'sent' : 'simulated',
      sent_at: new Date().toISOString()
    });

    await fs.writeFile(LOG_PATH, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch (logErr) {
    console.error('Failed to write WhatsApp log file:', logErr);
  }

  return {
    success: true,
    messageId,
    status: apiSuccess ? 'sent' : 'simulated'
  };
}
