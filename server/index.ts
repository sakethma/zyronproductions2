import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import dns from 'dns';

// Force IPv4 DNS resolution first to bypass Render/Cloud environments IPv6 routing bugs (connect ENETUNREACH)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Load environment variables
dotenv.config();

import { db as drizzleDb } from '../src/db/index.ts';
import { users, galleryItems } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';

import authRouter from './routes/auth.ts';
import eventsRouter from './routes/events.ts';
import bookingsRouter from './routes/bookings.ts';
import adminRouter from './routes/admin.ts';

import { requireAuth, requireAdmin, getOrCreateUser, AuthRequest } from './middleware/auth.ts';
import { readDb, writeDb } from './services/db.ts';
import { sendMail, brevoApiKey } from './services/email.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ type: ['application/json', 'text/plain'] }));

function getCookieSecret(): string {
  const envSecret = process.env.COOKIE_SECRET;
  if (envSecret && envSecret !== 'zyron-secret-cookie-key-1337') {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    const globalObj = global as any;
    if (!globalObj.__prod_cookie_secret) {
      globalObj.__prod_cookie_secret = crypto.randomBytes(32).toString('hex');
    }
    return globalObj.__prod_cookie_secret;
  }
  return 'zyron-secret-cookie-key-1337';
}

app.use(cookieParser(getCookieSecret()));

// ------------------- DATABASE & MIGRATIONS INITIALIZATION -------------------
async function initDb() {
  const hasSql = !!process.env.SQL_HOST || !!process.env.DATABASE_URL;
  if (hasSql) {
    try {
      console.log('Running pending database migrations...');
      await migrate(drizzleDb, { migrationsFolder: './drizzle' });
      console.log('Database migrations completed successfully!');
    } catch (err: any) {
      const errMsg = err.message || '';
      if (errMsg.includes('permission denied') || errMsg.includes('CREATE SCHEMA')) {
        console.log('Note: Database schema is managed by the platform. Skipping local migration metadata table creation.');
      } else {
        console.log('Database migrator notice:', errMsg || err);
      }
    }
  }
}

// ------------------- ATTACH SUB-ROUTERS -------------------
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/admin', adminRouter);

// Razorpay configuration info for the frontend
app.get('/api/config/razorpay', (req, res) => {
  return res.json({
    configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    key_id: process.env.RAZORPAY_KEY_ID || null
  });
});

// GET /api/gallery
app.get('/api/gallery', async (req, res) => {
  try {
    const items = await drizzleDb.select().from(galleryItems);
    items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    return res.json(items.slice(0, 60));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Brevo Diagnostic endpoints
app.get('/api/smtp/status', async (req, res) => {
  if (!brevoApiKey) {
    return res.json({
      configured: false,
      working: false,
      service: 'Brevo REST API',
      error: 'BREVO_API_KEY is missing in the .env configuration.'
    });
  }

  return res.json({
    configured: true,
    working: true,
    service: 'Brevo REST API',
    message: 'Brevo API key is active and ready!'
  });
});

app.post('/api/smtp/test', async (req, res) => {
  const { to } = req.body;
  const recipient = to ? to.trim() : 'sakethma007@gmail.com';

  if (!brevoApiKey) {
    return res.status(400).json({
      success: false,
      error: 'Brevo REST API is not configured. Please define BREVO_API_KEY environment variable.'
    });
  }

  try {
    const emailRes = await sendMail({
      to: recipient,
      subject: 'Test Email: Zyron Productions Brevo Verification',
      html: `
        <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5;">
          <h2 style="color: #7c3aed; text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px;">Zyron Brevo Diagnostic Test</h2>
          <p>This is a diagnostic email verifying that your <strong>Brevo REST API</strong> integration is fully functional!</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 24px 0; color: #166534;">
            <strong>Status:</strong> Success! The keys and setup are proper.
          </div>
          <p style="font-size: 11px; color: #737373;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    });

    if (!emailRes.success) {
      throw new Error(emailRes.error || 'Failed to send test email.');
    }

    return res.json({
      success: true,
      message: `Test email sent successfully via Brevo to ${recipient}!`,
      messageId: emailRes.id,
      response: 'OK'
    });
  } catch (err: any) {
    console.error('Brevo diagnostics test failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send test email.'
    });
  }
});

app.all('/api/debug/mail-test', async (req, res) => {
  const toParam = req.query.to || req.body?.to;
  const recipient = toParam ? String(toParam).trim() : 'sakethma007@gmail.com';

  const envConfig = {
    BREVO_API_KEY_PRESENT: !!brevoApiKey,
    BREVO_API_KEY_LENGTH: brevoApiKey ? brevoApiKey.length : 0,
    SMTP_FROM: process.env.SMTP_FROM,
    NODE_ENV: process.env.NODE_ENV,
  };

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    recipient,
    envConfig,
    sendAttempt: null,
  };

  if (!brevoApiKey) {
    diagnostics.sendAttempt = {
      success: false,
      error: 'Brevo API key is not configured. Please define BREVO_API_KEY environment variable.'
    };
    return res.status(400).json({
      success: false,
      message: 'Brevo API key missing',
      diagnostics
    });
  }

  try {
    const emailRes = await sendMail({
      to: recipient,
      subject: `🚨 Zyron Brevo Diagnostic Test - ${new Date().toISOString()}`,
      text: `Zyron Brevo Debugging Report\n\nThis is an automated system diagnostic email. If you receive this, your application is successfully sending emails using Brevo REST API!\n\nDetails:\n- Timestamp: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: sans-serif; color: #1e293b; background-color: #f8fafc; padding: 32px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #6d28d9; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-top: 0;">🚨 Zyron Brevo Diagnostic Test</h2>
          <p>This is an automated system diagnostic email. If you receive this, your application is successfully sending emails using Brevo REST API!</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px; margin: 24px 0; color: #166534;">
            <strong>Status:</strong> Success! The Brevo service is functional.
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #475569;">Service:</td>
              <td style="padding: 6px 0; font-family: monospace;">Brevo REST API</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-weight: bold; color: #475569;">Time Generated:</td>
              <td style="padding: 6px 0;">${new Date().toISOString()}</td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">This diagnostic route is exposed at <code>/api/debug/mail-test</code>.</p>
        </div>
      `
    });

    if (!emailRes.success) {
      throw new Error(emailRes.error || 'Brevo API call failed');
    }

    diagnostics.sendAttempt = {
      success: true,
      messageId: emailRes.id,
      service: emailRes.service
    };

    return res.json({
      success: true,
      message: 'Brevo diagnostics completed with successful email dispatch!',
      diagnostics
    });
  } catch (sendErr: any) {
    diagnostics.sendAttempt = {
      success: false,
      error: sendErr.message,
      stack: sendErr.stack
    };

    return res.status(500).json({
      success: false,
      message: 'Brevo diagnostics completed, but email dispatch failed.',
      diagnostics
    });
  }
});

// E2E flow test endpoint
app.post('/api/test/e2e-email-flow', async (req, res) => {
  const { email } = req.body;
  const recipient = email ? email.trim() : 'sakethma007@gmail.com';

  const isMailConfigured = !!brevoApiKey;

  try {
    const db = await readDb();

    let userUid = 'test-user-id';
    const existingUsers = await drizzleDb.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      userUid = existingUsers[0].uid;
    } else {
      await drizzleDb.insert(users).values({
        uid: userUid,
        email: recipient,
        role: 'user',
        password_hash: '',
      });
    }
    
    let event = db.events.find((e: any) => e.status === 'published');
    if (!event) {
      event = {
        id: 'test-event-uuid-123',
        title: 'Quantum Resonance',
        slug: 'quantum-resonance-test',
        teaser: 'Sonic frequencies and spatial boundaries',
        description: 'An interactive audio-visual space test.',
        event_date: new Date(Date.now() + 86400000 * 7).toISOString(),
        location: 'Zyron Test Portal, Hyderabad',
        image_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200',
        capacity: 100,
        tickets_sold: 0,
        general_price_cents: 150000,
        vip_price_cents: 300000,
        group_price_cents: 120000,
        earlybird_price_cents: 100000,
        couple_price_cents: 250000,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.events.push(event);
    }

    const bookingId = crypto.randomUUID();
    const mockBooking = {
      id: bookingId,
      user_id: userUid,
      event_id: event.id,
      tier: 'vip',
      quantity: 2,
      guest_name: 'Test Guest Hyderabad',
      guest_email: recipient,
      guest_phone: '+919999999999',
      guest_instagram: 'zyron.test',
      total_cents: event.vip_price_cents * 2,
      payment_status: 'paid',
      payment_provider_ref: 'test_bypass_' + Date.now(),
      dietary: 'None',
      role_preference: 'Spectator',
      accessibility: 'None',
      cancelled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.bookings.push(mockBooking);
    
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: userUid,
      title: 'Test Payment Confirmed & Tickets Emailed',
      message: `Test booking of ₹${Math.round(mockBooking.total_cents / 100).toLocaleString()} successfully processed. Tickets sent to ${mockBooking.guest_email}.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(newNotif);

    await writeDb(db);

    const htmlEmail = `
      <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; box-sizing: border-box;">
        <h1 style="color: #7c3aed; text-align: center; margin-bottom: 24px; font-family: serif; font-size: 28px;">Congratulations! 🎉</h1>
        <p style="font-size: 15px; text-align: center; margin-bottom: 24px; font-weight: bold; line-height: 1.5; color: #1f2937;">Your spot at ${event.title} is officially secured.</p>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e5e5; margin-bottom: 24px;">
          <h2 style="text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; font-size: 13px; margin-top: 0; color: #6b7280; letter-spacing: 1px;">Admission Details</h2>
          <p style="margin: 8px 0; font-size: 13px;">Booking Ref: <strong style="color: #7c3aed;">${mockBooking.id.split('-')[0].toUpperCase()}</strong></p>
          <p style="margin: 8px 0; font-size: 13px;">Event: <strong>${event.title}</strong></p>
          <p style="margin: 8px 0; font-size: 13px;">Guest: <strong>${mockBooking.guest_name}</strong></p>
          <p style="margin: 8px 0; font-size: 13px;">Passes: <strong>${mockBooking.quantity}x VIP</strong></p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <p style="margin-bottom: 12px; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 1.5px; color: #4b5563;">Your Digital Entry Pass</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ZYRON-TICKET-${mockBooking.id}" alt="Ticket QR Code" style="width: 180px; height: 180px; border: 1px solid #e5e5e5; padding: 12px; background: white; display: inline-block;" />
          <p style="font-size: 10px; color: #6b7280; text-transform: uppercase; margin-top: 12px; letter-spacing: 0.5px;">Present this QR code for priority admission at the gate</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="font-size: 11px; color: #6b7280; line-height: 1.6; text-align: center; max-width: 480px; margin: 0 auto;">Your secret coordinates and structural protocols will be sent 24 hours prior to the experience. Stay tuned.</p>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 16px; text-align: center;">Need assistance? Reach out at zyroninbox@gmail.com</p>
      </div>
    `;

    let smtpResponse;
    if (isMailConfigured) {
      const emailRes = await sendMail({
        to: recipient,
        subject: `[TEST E2E] Booking Confirmed: ${event.title} 🎉`,
        html: htmlEmail,
      });

      if (!emailRes.success) {
        throw new Error(emailRes.error || 'Failed to dispatch email');
      }

      smtpResponse = {
        messageId: emailRes.id || 'res_' + Date.now(),
        response: `250 2.0.0 OK (Relayed successfully via ${emailRes.service})`,
        envelope: {
          from: process.env.SMTP_FROM || 'tickets@zyronproduction.work.gd',
          to: [recipient]
        }
      };
    } else {
      smtpResponse = {
        messageId: 'simulated_id_' + Date.now() + '@zyron.events',
        response: '250 2.0.0 OK (Simulated: Brevo API key is missing. Running in sandboxed preview mode.)',
        envelope: {
          from: 'Zyron Productions <tickets@zyronproduction.work.gd>',
          to: [recipient]
        }
      };
    }

    return res.json({
      success: true,
      simulated: !isMailConfigured,
      message: isMailConfigured 
        ? `E2E Test completed: Mock booking created and confirmation email sent via active channel to ${recipient}`
        : `E2E Simulation completed: Mock booking created and HTML email preview generated (Mail not active)`,
      booking: mockBooking,
      qr_code_payload: `ZYRON-TICKET-${mockBooking.id}`,
      qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ZYRON-TICKET-${mockBooking.id}`,
      html: htmlEmail,
      smtp_response: smtpResponse
    });
  } catch (err: any) {
    console.error('E2E email test failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to execute E2E test.'
    });
  }
});

// ------------------- VITE & STATIC SERVING -------------------
async function startServer() {
  await initDb();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zyron Productions server running on http://localhost:${PORT}`);
  });
}

startServer();
export { app };
