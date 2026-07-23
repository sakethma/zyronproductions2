import QRCode from 'qrcode';

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

export async function sendConfirmationEmail(booking: any, event: any, downloadUrl?: string) {
  try {
    const escapedEventTitle = escapeHtml(event?.title || 'Zyron Event');
    const escapedGuestName = escapeHtml(booking?.guest_name || 'VIP Guest');
    const escapedBookingId = escapeHtml(booking?.id || '');
    const rawTicketId = booking?.ticket_id || (booking?.id ? booking.id.substring(0, 8).toUpperCase() : 'TK0000');
    const escapedTicketId = escapeHtml(rawTicketId);
    const escapedBookingRef = escapeHtml(booking?.id ? booking.id.split('-')[0].toUpperCase() : 'ZYRON');
    const escapedTier = escapeHtml((booking?.tier || 'GENERAL').toUpperCase());
    const escapedQuantity = escapeHtml(booking?.quantity || 1);
    const escapedUtr = booking?.utr ? escapeHtml(booking.utr) : (booking?.payment_provider_ref ? escapeHtml(booking.payment_provider_ref) : '');
    const escapedVenue = event?.location ? escapeHtml(event.location) : 'Venue Coordinates (Dispatched 24h prior)';
    const formattedDate = event?.event_date ? new Date(event.event_date).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }) : 'To Be Announced';

    const pdfDownloadUrl = downloadUrl || `https://ais-dev-tbqq7zl3tdwceaxtc2cmlj-296496770216.asia-southeast1.run.app/api/tickets/${escapedBookingId}/download`;

    const qrPayload = `ZYRON-TICKET-${booking.id}`;
    // Use reliable HTTPS QR server URL to bypass Gmail/mobile mail client data URL blocking
    const qrCodeImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}&color=000000&bgcolor=ffffff`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed - Zyron Productions</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
          <tr>
            <td align="center">
              <!-- Main Email Container Card -->
              <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                
                <!-- Branding Header -->
                <tr>
                  <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                    <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                    <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Live Electronic Music & Modular Installations</div>
                  </td>
                </tr>

                <!-- Status Banner -->
                <tr>
                  <td style="padding: 24px 28px 12px 28px; text-align: center;">
                    <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                      ✓ Admission Confirmed & Approved
                    </div>
                    <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                      Congratulations, ${escapedGuestName}! 🎉
                    </h1>
                    <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                      Your entry pass for <strong style="color: #e4e4e7;">${escapedEventTitle}</strong> has been officially verified and issued.
                    </p>
                  </td>
                </tr>

                <!-- Ticket Details Card -->
                <tr>
                  <td style="padding: 16px 28px;">
                    <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                      <tr>
                        <td>
                          <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                            Official Admission Credential
                          </div>
                          
                          <table role="presentation" width="100%" style="margin-top: 14px; font-size: 13px; line-height: 1.8;">
                            <tr>
                              <td style="color: #71717a; font-family: monospace; width: 35%;">TICKET ID:</td>
                              <td style="color: #c084fc; font-family: monospace; font-weight: 800; font-size: 16px;">${escapedTicketId}</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">BOOKING REF:</td>
                              <td style="color: #f4f4f5; font-family: monospace; font-weight: 700;">${escapedBookingRef}</td>
                            </tr>
                            ${escapedUtr ? `
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">PAYMENT UTR:</td>
                              <td style="color: #a1a1aa; font-family: monospace;">${escapedUtr}</td>
                            </tr>` : ''}
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">EVENT:</td>
                              <td style="color: #ffffff; font-weight: 700;">${escapedEventTitle}</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">GUEST NAME:</td>
                              <td style="color: #e4e4e7;">${escapedGuestName}</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">PASSES:</td>
                              <td style="color: #38bdf8; font-family: monospace; font-weight: 700;">${escapedQuantity}x ${escapedTier} PASS</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">EVENT DATE:</td>
                              <td style="color: #e4e4e7;">${formattedDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">VENUE:</td>
                              <td style="color: #e4e4e7;">${escapedVenue}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- QR Code Display Box -->
                <tr>
                  <td style="padding: 12px 28px 24px 28px; text-align: center;">
                    <div style="font-family: monospace; font-size: 11px; font-weight: 700; color: #d4d4d8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 14px;">
                      ENTRY PASS SCANNER QR CODE
                    </div>
                    
                    <!-- High contrast crisp white wrapper box so QR code scans cleanly in all mail clients -->
                    <div style="display: inline-block; background-color: #ffffff; padding: 16px; border-radius: 12px; border: 1px solid #3f3f46; box-shadow: 0 0 20px rgba(168, 85, 247, 0.25);">
                      <img src="${qrCodeImgSrc}" alt="Ticket Entry QR Code" width="200" height="200" style="display: block; width: 200px; height: 200px; border: none; outline: none;" />
                    </div>

                    <p style="margin: 14px 0 0 0; font-family: monospace; font-size: 10px; color: #71717a; text-transform: uppercase; letter-spacing: 1px;">
                      Present this QR code at venue entrance for instant priority entry (Ticket ID: ${escapedTicketId})
                    </p>
                  </td>
                </tr>

                <!-- Action Button: Download PDF Ticket -->
                <tr>
                  <td style="padding: 0 28px 28px 28px; text-align: center;">
                    <a href="${pdfDownloadUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 12px; font-family: monospace; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45); transition: all 0.2s ease;">
                      ↓ DOWNLOAD DIGITAL PASS (PDF)
                    </a>
                  </td>
                </tr>

                <!-- Footer Divider & Instructions -->
                <tr>
                  <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; color: #a1a1aa; line-height: 1.6; font-family: monospace;">
                      📍 Secret venue coordinates & access instructions will be dispatched 24 hours prior to the experience.
                    </p>
                    <p style="margin: 0; font-size: 10px; color: #71717a; font-family: monospace;">
                      Need support? Reach out at <a href="mailto:zyroninbox@gmail.com" style="color: #c084fc; text-decoration: none;">zyroninbox@gmail.com</a> • Zyron Productions
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
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
