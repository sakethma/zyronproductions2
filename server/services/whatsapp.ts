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
  let apiError: string | undefined = undefined;
  let apiResponseBody: any = undefined;
  let messageId = `WA_${Date.now()}_${ticketId}`;

  if (metaToken && phoneId) {
    try {
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }
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
      const respData = await resp.json().catch(() => null);
      apiResponseBody = respData;

      if (resp.ok && respData?.messages?.[0]?.id) {
        messageId = respData.messages[0].id;
        apiSuccess = true;
        console.log(`[WHATSAPP META API SUCCESS] Dispatched to ${formattedPhone}`);
      } else {
        apiError = respData?.error?.message || `HTTP ${resp.status}: ${JSON.stringify(respData)}`;
        console.error(`[WHATSAPP META API FAILURE] Status ${resp.status}:`, apiError);
      }
    } catch (err: any) {
      apiError = err?.message || String(err);
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
    let cleanDigits = phone.replace(/[^0-9]/g, '');
    if (cleanDigits.length === 10) cleanDigits = '91' + cleanDigits;
    const waDeepLink = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageText)}`;

    logs.unshift({
      id: messageId,
      booking_id: booking.id,
      ticket_id: ticketId,
      phone,
      formatted_phone: cleanDigits,
      guest_name: guestName,
      message: messageText,
      pass_url: passDownloadUrl,
      wa_deep_link: waDeepLink,
      status: apiSuccess ? 'sent' : (apiError ? 'failed' : 'simulated'),
      api_error: apiError,
      api_response: apiResponseBody,
      sent_at: new Date().toISOString()
    });

    await fs.writeFile(LOG_PATH, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch (logErr) {
    console.error('Failed to write WhatsApp log file:', logErr);
  }

  return {
    success: true,
    messageId,
    status: apiSuccess ? 'sent' : (apiError ? 'failed' : 'simulated'),
    error: apiError
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
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }
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
        console.log(`[WHATSAPP REMINDER SUCCESS] Dispatched to ${formattedPhone}`);
      } else {
        const errText = await resp.text();
        console.error(`[WHATSAPP REMINDER FAILURE] Status ${resp.status}:`, errText);
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

export async function sendTestWhatsAppText(targetPhone: string, customText?: string): Promise<{
  success: boolean;
  status: 'sent' | 'failed' | 'simulated';
  messageId: string;
  phone: string;
  formatted_phone: string;
  wa_deep_link: string;
  error?: string;
  api_response?: any;
}> {
  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  let cleanDigits = targetPhone.replace(/[^0-9]/g, '');
  if (cleanDigits.length === 10) {
    cleanDigits = '91' + cleanDigits;
  }

  const messageText = customText || `⚡ *Zyron Productions - WhatsApp Trail Test*\n\nHello! This is an automated trail test dispatch from Zyron Productions backend system.\n\n📱 *Recipient Phone:* +${cleanDigits}\n⏰ *Timestamp:* ${new Date().toISOString()}\n✅ *Integration Status:* Meta Cloud API Active\n\nWelcome to Zyron VIP Access!`;

  let apiSuccess = false;
  let apiError: string | undefined = undefined;
  let apiResponseBody: any = undefined;
  let messageId = `WA_TEST_${Date.now()}_${cleanDigits.slice(-4)}`;

  if (metaToken && phoneId) {
    try {
      console.log(`[WHATSAPP TEST DISPATCH] Attempting Meta API send to +${cleanDigits}...`);
      const resp = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanDigits,
          type: 'text',
          text: { body: messageText }
        })
      });

      const respData = await resp.json().catch(() => null);
      apiResponseBody = respData;

      if (resp.ok && respData?.messages?.[0]?.id) {
        messageId = respData.messages[0].id;
        apiSuccess = true;
        console.log(`[WHATSAPP TEST SUCCESS] Message ID: ${messageId} to +${cleanDigits}`);
      } else {
        apiError = respData?.error?.message || `HTTP ${resp.status}: ${JSON.stringify(respData)}`;
        console.error(`[WHATSAPP TEST META FAILURE] Status ${resp.status}:`, apiError);
      }
    } catch (err: any) {
      apiError = err?.message || String(err);
      console.error('[WHATSAPP TEST API ERROR]', err);
    }
  } else {
    console.log(`[WHATSAPP TEST SIMULATED] WHATSAPP_TOKEN / WHATSAPP_PHONE_ID missing. Dispatch simulated for +${cleanDigits}`);
  }

  const waDeepLink = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(messageText)}`;

  // Log test run
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

    logs.unshift({
      id: messageId,
      phone: targetPhone,
      formatted_phone: cleanDigits,
      type: 'test_trail',
      message: messageText,
      wa_deep_link: waDeepLink,
      status: apiSuccess ? 'sent' : (apiError ? 'failed' : 'simulated'),
      api_error: apiError,
      api_response: apiResponseBody,
      sent_at: new Date().toISOString()
    });

    await fs.writeFile(LOG_PATH, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch (logErr) {
    console.error('Failed to write WhatsApp log for test run:', logErr);
  }

  return {
    success: apiSuccess || !metaToken || !phoneId,
    status: apiSuccess ? 'sent' : (apiError ? 'failed' : 'simulated'),
    messageId,
    phone: targetPhone,
    formatted_phone: cleanDigits,
    wa_deep_link: waDeepLink,
    error: apiError,
    api_response: apiResponseBody
  };
}

export async function getWhatsAppDiagnostics() {
  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  let logs: any[] = [];
  try {
    const LOG_PATH = path.join(process.cwd(), 'data', 'whatsapp_logs.json');
    const raw = await fs.readFile(LOG_PATH, 'utf-8');
    logs = JSON.parse(raw);
  } catch {
    logs = [];
  }

  const recentFailures = logs.filter(l => l.status === 'failed' || l.api_error);
  const recentSuccesses = logs.filter(l => l.status === 'sent');
  const simulatedCount = logs.filter(l => l.status === 'simulated').length;

  return {
    integration_configured: !!(metaToken && phoneId),
    meta_token_present: !!metaToken,
    phone_id_present: !!phoneId,
    phone_id: phoneId ? `${phoneId.slice(0, 4)}****${phoneId.slice(-4)}` : null,
    total_logs_count: logs.length,
    sent_count: recentSuccesses.length,
    failed_count: recentFailures.length,
    simulated_count: simulatedCount,
    recent_logs: logs.slice(0, 30),
    common_dispatch_failure_reasons: [
      {
        reason: 'Meta Sandbox Recipient Restriction (Error Code 131030)',
        explanation: 'When using Meta WhatsApp Cloud API in Development / Sandbox mode, free-form messages can ONLY be delivered to phone numbers that have been explicitly added & verified in the Meta App Developer Dashboard under "Test Phone Numbers".',
        action: 'Add +918125829270 to your WhatsApp Business Sandbox Test Recipients list in Meta Developer Portal.'
      },
      {
        reason: '24-Hour Messaging Window Rule (Error Code 131047 / 100)',
        explanation: 'WhatsApp Business API strictly enforces a 24-hour customer service window. Free-form text messages cannot be initiated by the business if the customer has not messaged your Business WhatsApp number in the last 24 hours.',
        action: 'To send proactive updates outside the 24h window, create & register a pre-approved Message Template in Meta Business Manager.'
      },
      {
        reason: 'Missing API Key Fallback to Simulation',
        explanation: 'If WHATSAPP_TOKEN or WHATSAPP_PHONE_ID is absent in server .env, Zyron automatically switches to Simulation mode and generates wa.me direct deep links to prevent booking crashes.',
        action: 'Define WHATSAPP_TOKEN and WHATSAPP_PHONE_ID in server environment variables to enable direct API delivery.'
      }
    ]
  };
}
