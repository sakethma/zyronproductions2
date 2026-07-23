export const cleanEnvVar = (val: string | undefined): string | undefined => {
  if (!val) return val;
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
};

export const parseFromAddress = (fromStr: string) => {
  const match = fromStr.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'Zyron Productions', email: fromStr.trim() };
};

export const brevoApiKey = cleanEnvVar(process.env.BREVO_API_KEY) || cleanEnvVar(process.env.SENDINBLUE_API_KEY);

if (brevoApiKey) {
  console.log('✅ Brevo REST API Integration is initialized and ready to dispatch emails!');
} else {
  console.log('ℹ️ Brevo REST API is not configured. Email delivery will run in Simulated/Sandbox mode.');
}

export interface SendMailResult {
  success: boolean;
  service?: string;
  id?: string;
  error?: string;
}

export interface SendMailParams {
  to: string | { email: string; name?: string }[];
  subject: string;
  html?: string;
  htmlContent?: string;
  text?: string;
  textContent?: string;
}

export async function sendMailViaBrevoApi({ to, subject, html, htmlContent, text, textContent }: SendMailParams): Promise<SendMailResult> {
  if (!brevoApiKey) {
    throw new Error('Brevo API key is not configured.');
  }

  const fromStr = cleanEnvVar(process.env.SMTP_FROM) || 'Zyron Productions <tickets@zyronproduction.work.gd>';
  const parsedFrom = parseFromAddress(fromStr);

  // Normalize recipient (to) from either string or array
  let formattedTo: { email: string; name?: string }[] = [];
  if (typeof to === 'string') {
    formattedTo = [{ email: to }];
  } else if (Array.isArray(to)) {
    formattedTo = to;
  }

  // Normalize HTML and Text content keys
  let finalHtml = htmlContent || html || '';
  const finalTxt = textContent || text || '';

  if (!finalHtml && finalTxt) {
    // Convert newlines to HTML break tags and wrap in a clean, beautifully branded monospace block
    finalHtml = `<div style="font-family: monospace; font-size: 14px; line-height: 1.6; color: #171717; background-color: #fafafa; padding: 24px; border: 1px solid #e5e5e5; max-width: 600px; margin: 0 auto;">
      <h2 style="font-family: serif; color: #7c3aed; margin-top: 0;">ZYRON PRODUCTIONS</h2>
      <p style="margin-bottom: 24px; white-space: pre-wrap;">${finalTxt.replace(/\r?\n/g, '<br />')}</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
      <p style="font-size: 10px; color: #737373; text-transform: uppercase; letter-spacing: 1px;">Secure Transaction System</p>
    </div>`;
  } else if (!finalHtml) {
    finalHtml = `<div style="font-family: sans-serif;">System message notification.</div>`;
  }

  console.log(`[Email] Attempting dispatch via Brevo REST API to:`, JSON.stringify(formattedTo));

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: parsedFrom.name,
        email: parsedFrom.email
      },
      to: formattedTo,
      subject: subject,
      htmlContent: finalHtml,
      textContent: finalTxt || undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo API responded with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  console.log('Email sent successfully via Brevo REST API. Message ID:', data.messageId);
  return { success: true, service: 'Brevo REST API', id: data.messageId };
}

export async function sendMail({ to, subject, html, htmlContent, text, textContent }: SendMailParams): Promise<SendMailResult> {
  if (brevoApiKey) {
    try {
      return await sendMailViaBrevoApi({ to, subject, html, htmlContent, text, textContent });
    } catch (brevoErr: any) {
      console.error('Brevo REST API dispatch failed:', brevoErr);
      return { success: false, error: brevoErr.message || 'Brevo API sending failed' };
    }
  }

  console.log(`[EMAIL NOT SENT - NO BREVO CONFIG] To: ${JSON.stringify(to)}, Subject: ${subject}`);
  if (text || textContent) console.log(`[TEXT]: ${text || textContent}`);
  return { success: false, error: 'Brevo REST API is not configured. Please define BREVO_API_KEY environment variable.' };
}

function escapeHtml(unsafe: any): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendConfirmationEmail(booking: any, event: any) {
  try {
    const escapedEventTitle = escapeHtml(event.title);
    const escapedGuestName = escapeHtml(booking.guest_name);
    const escapedBookingId = escapeHtml(booking.id);
    const escapedTicketId = escapeHtml(booking.ticket_id || booking.id.substring(0, 8).toUpperCase());
    const escapedBookingRef = escapeHtml(booking.id.split('-')[0].toUpperCase());
    const escapedTier = escapeHtml(booking.tier.toUpperCase());
    const escapedQuantity = escapeHtml(booking.quantity);
    const escapedUtr = booking.utr ? escapeHtml(booking.utr) : '';

    const html = `
      <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5;">
        <h1 style="color: #7c3aed; text-align: center; margin-bottom: 24px; font-family: serif;">Congratulations! 🎉</h1>
        <p style="font-size: 16px; text-align: center; margin-bottom: 32px; font-weight: bold;">Your spot at ${escapedEventTitle} is officially verified and secured.</p>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e5e5; margin-bottom: 24px;">
          <h2 style="text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; font-size: 14px; margin-top: 0; color: #737373;">Admission Ticket</h2>
          <p style="margin: 8px 0;">Ticket ID: <strong style="color: #7c3aed; font-size: 16px;">${escapedTicketId}</strong></p>
          <p style="margin: 8px 0;">Booking Ref: <strong>${escapedBookingRef}</strong></p>
          ${escapedUtr ? `<p style="margin: 8px 0;">Payment UTR: <strong>${escapedUtr}</strong></p>` : ''}
          <p style="margin: 8px 0;">Event: <strong>${escapedEventTitle}</strong></p>
          <p style="margin: 8px 0;">Guest: <strong>${escapedGuestName}</strong></p>
          <p style="margin: 8px 0;">Passes: <strong>${escapedQuantity}x ${escapedTier}</strong></p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <p style="margin-bottom: 16px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Entry Pass QR Code</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ZYRON-TICKET-${escapedTicketId}" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e5e5; padding: 16px; background: white;" />
          <p style="font-size: 10px; color: #737373; text-transform: uppercase; margin-top: 12px;">Present this QR code for priority admission at the venue entrance</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
        <p style="font-size: 12px; color: #737373; line-height: 1.6;">Your secret coordinates and structural protocols will be sent 24 hours prior to the experience. Stay tuned.</p>
        <p style="font-size: 12px; color: #737373; margin-top: 16px;">Need assistance? Reach out at zyroninbox@gmail.com</p>
      </div>
    `;

    const result = await sendMail({
      to: booking.guest_email,
      subject: `Booking Confirmed: ${event.title} 🎉`,
      html
    });

    if (result.success) {
      console.log(`Confirmation email sent successfully via ${result.service}. ID: ${result.id}`);
    } else {
      console.warn('Confirmation email sending failed:', result.error);
    }
  } catch (err) {
    console.error('Failed to send confirmation email due to exception:', err);
  }
}
