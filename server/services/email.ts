import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = 'Zyron Productions <onboarding@resend.dev>';

const cleanEnvVar = (val: string | undefined): string | undefined => {
  if (!val) return val;
  let clean = val.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  return clean;
};

// SMTP Transporter setup
export const smtpHost = cleanEnvVar(process.env.SMTP_HOST) || 'smtp.gmail.com';
export const smtpPort = parseInt(cleanEnvVar(process.env.SMTP_PORT) || '587', 10);
export const smtpUser = cleanEnvVar(process.env.SMTP_USER);
export const smtpPass = cleanEnvVar(process.env.SMTP_PASS);

export let smtpVerified = false;
export let smtpVerifyError: string | null = null;
export let transporter: nodemailer.Transporter | null = null;

if (smtpUser && smtpPass) {
  const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED === 'false' ? false : true;
  const isGmail = smtpHost.toLowerCase().includes('gmail.com');

  transporter = nodemailer.createTransport((isGmail ? {
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    pool: true, // Use connection pooling to prevent socket starvation
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  } : {
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
  }) as any);
  console.log(`[SMTP] Nodemailer Transporter initialized for user: ${smtpUser} (Gmail Service Option: ${isGmail})`);
  
  // Verify SMTP connection on startup
  transporter.verify((error) => {
    if (error) {
      smtpVerified = false;
      smtpVerifyError = error.message;
      console.error('❌ Nodemailer SMTP Transporter Verification FAILED:', error.message);
      if (isGmail && (error.message.includes('Username and Password not accepted') || error.message.includes('auth'))) {
        console.error('💡 TIP: Gmail SMTP requires a 16-character "App Password" rather than your standard Gmail password.');
        console.error('   How to configure:');
        console.error('   1. Go to your Google Account Settings (https://myaccount.google.com).');
        console.error('   2. Navigate to "Security" -> Enable "2-Step Verification" if not already enabled.');
        console.error('   3. Scroll to the bottom of "2-Step Verification" page and select "App passwords".');
        console.error('   4. Create a new app password (select App="Mail", Device="Other").');
        console.error('   5. Copy the generated 16-character password and set it as SMTP_PASS.');
      }
    } else {
      smtpVerified = true;
      smtpVerifyError = null;
      console.log('✅ Nodemailer SMTP Transporter is successfully verified and ready to send emails!');
    }
  });
} else {
  console.log('Nodemailer SMTP variables (SMTP_USER/SMTP_PASS) are not set. SMTP is not active.');
}

export async function sendMail({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  if (transporter) {
    const from = cleanEnvVar(process.env.SMTP_FROM) || `Zyron Productions <${smtpUser}>`;
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
        replyTo: 'zyroninbox@gmail.com',
      });
      console.log('Email sent successfully via Gmail SMTP. MessageID:', info.messageId);
      return { success: true, service: 'SMTP', id: info.messageId };
    } catch (err: any) {
      console.error('SMTP sending failed:', err);
      return { success: false, error: err.message || 'SMTP sending failed' };
    }
  }

  console.log(`[EMAIL NOT SENT - NO SMTP CONFIG] To: ${to}, Subject: ${subject}`);
  if (text) console.log(`[TEXT]: ${text}`);
  return { success: false, error: 'Gmail SMTP is not configured. Please define SMTP_USER and SMTP_PASS environment variables.' };
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
    const escapedBookingRef = escapeHtml(booking.id.split('-')[0].toUpperCase());
    const escapedTier = escapeHtml(booking.tier.toUpperCase());
    const escapedQuantity = escapeHtml(booking.quantity);

    const html = `
      <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5;">
        <h1 style="color: #7c3aed; text-align: center; margin-bottom: 24px; font-family: serif;">Congratulations! 🎉</h1>
        <p style="font-size: 16px; text-align: center; margin-bottom: 32px; font-weight: bold;">Your spot at ${escapedEventTitle} is officially secured.</p>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e5e5; margin-bottom: 24px;">
          <h2 style="text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; font-size: 14px; margin-top: 0; color: #737373;">Admission Details</h2>
          <p style="margin: 8px 0;">Booking Ref: <strong style="color: #7c3aed;">${escapedBookingRef}</strong></p>
          <p style="margin: 8px 0;">Event: <strong>${escapedEventTitle}</strong></p>
          <p style="margin: 8px 0;">Guest: <strong>${escapedGuestName}</strong></p>
          <p style="margin: 8px 0;">Passes: <strong>${escapedQuantity}x ${escapedTier}</strong></p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <p style="margin-bottom: 16px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Digital Entry Pass</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ZYRON-TICKET-${escapedBookingId}" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e5e5; padding: 16px; background: white;" />
          <p style="font-size: 10px; color: #737373; text-transform: uppercase; margin-top: 12px;">Present this QR code for priority admission at the gate</p>
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
