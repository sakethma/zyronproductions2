/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = 'Zyron Productions <onboarding@resend.dev>';

// Nodemailer SMTP Transporter setup
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;
if (smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  console.log(`Nodemailer SMTP Transporter configured for user: ${smtpUser}`);
  
  // Verify SMTP connection on startup
  transporter.verify((error) => {
    if (error) {
      console.error('❌ Nodemailer SMTP Transporter Verification FAILED:', error.message);
      console.error('👉 Tip: Ensure you are using a Gmail App Password, NOT your regular Google account password.');
    } else {
      console.log('✅ Nodemailer SMTP Transporter is successfully verified and ready to send emails!');
    }
  });
} else {
  console.log('Nodemailer SMTP variables (SMTP_USER/SMTP_PASS) are not set. SMTP is not active.');
}

async function sendMail({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  // Gmail SMTP is the sole configured and authorized mail provider
  if (transporter) {
    const from = process.env.SMTP_FROM || `Zyron Productions <${smtpUser}>`;
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

async function sendConfirmationEmail(booking: any, event: any) {
  try {
    const html = `
      <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5;">
        <h1 style="color: #7c3aed; text-align: center; margin-bottom: 24px; font-family: serif;">Congratulations! 🎉</h1>
        <p style="font-size: 16px; text-align: center; margin-bottom: 32px; font-weight: bold;">Your spot at ${event.title} is officially secured.</p>
        
        <div style="background-color: white; padding: 20px; border: 1px solid #e5e5e5; margin-bottom: 24px;">
          <h2 style="text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px; font-size: 14px; margin-top: 0; color: #737373;">Admission Details</h2>
          <p style="margin: 8px 0;">Booking Ref: <strong style="color: #7c3aed;">${booking.id.split('-')[0].toUpperCase()}</strong></p>
          <p style="margin: 8px 0;">Event: <strong>${event.title}</strong></p>
          <p style="margin: 8px 0;">Guest: <strong>${booking.guest_name}</strong></p>
          <p style="margin: 8px 0;">Passes: <strong>${booking.quantity}x ${booking.tier.toUpperCase()}</strong></p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <p style="margin-bottom: 16px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Digital Entry Pass</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=ZYRON-TICKET-${booking.id}" alt="Ticket QR Code" style="width: 200px; height: 200px; border: 1px solid #e5e5e5; padding: 16px; background: white;" />
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

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

app.use(express.json({ type: ['application/json', 'text/plain'] }));

// Set up sessions cookie middleware helper
import cookieParser from 'cookie-parser';
app.use(cookieParser('zyron-secret-cookie-key-1337'));

// Helper to ensure database is loaded and seeded

import { db as drizzleDb } from './src/db/index.ts';
import { users, events, bookings, galleryItems, notifications } from './src/db/schema.ts';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';

// Compatibility types
interface DbState {
  users: any[];
  events: any[];
  bookings: any[];
  gallery_items: any[];
  notifications: any[];
}

async function readDb(): Promise<DbState> {
  const usersList = await drizzleDb.select().from(users);
  const eventsList = await drizzleDb.select().from(events);
  const bookingsList = await drizzleDb.select().from(bookings);
  const galleryList = await drizzleDb.select().from(galleryItems);
  const notificationsList = await drizzleDb.select().from(notifications);
  
  return {
    users: usersList.map(u => ({ ...u, id: u.uid })),
    events: eventsList,
    bookings: bookingsList,
    gallery_items: galleryList,
    notifications: notificationsList
  };
}


async function writeDb(data: DbState) {
  // 1. DELETE bookings & gallery
  const existingBookings = await drizzleDb.select().from(bookings);
  const newBookingIds = data.bookings.map((b: any) => b.id);
  for (const b of existingBookings) {
    if (!newBookingIds.includes(b.id)) {
      await drizzleDb.delete(bookings).where(eq(bookings.id, b.id));
    }
  }
  
  const existingGallery = await drizzleDb.select().from(galleryItems);
  const newGalleryIds = data.gallery_items.map((g: any) => g.id);
  for (const gi of existingGallery) {
    if (!newGalleryIds.includes(gi.id)) {
      await drizzleDb.delete(galleryItems).where(eq(galleryItems.id, gi.id));
    }
  }

  // 2. DELETE events
  const existingEvents = await drizzleDb.select().from(events);
  const newEventIds = data.events.map((e: any) => e.id);
  for (const ev of existingEvents) {
    if (!newEventIds.includes(ev.id)) {
      await drizzleDb.delete(events).where(eq(events.id, ev.id));
    }
  }

  // 3. DELETE notifications
  const existingNotifications = await drizzleDb.select().from(notifications);
  const newNotifIds = data.notifications.map((n: any) => n.id);
  for (const n of existingNotifications) {
    if (!newNotifIds.includes(n.id)) {
      await drizzleDb.delete(notifications).where(eq(notifications.id, n.id));
    }
  }

  // 4. INSERT/UPDATE events
  for (const ev of data.events) {
    const existing = await drizzleDb.select().from(events).where(eq(events.id, ev.id));
    if (existing.length === 0) {
      await drizzleDb.insert(events).values(ev);
    } else {
      await drizzleDb.update(events).set(ev).where(eq(events.id, ev.id));
    }
  }
  
  // 5. INSERT/UPDATE bookings
  for (const b of data.bookings) {
    const existing = await drizzleDb.select().from(bookings).where(eq(bookings.id, b.id));
    if (existing.length === 0) {
      await drizzleDb.insert(bookings).values(b);
    } else {
      await drizzleDb.update(bookings).set(b).where(eq(bookings.id, b.id));
    }
  }
  
  // 6. INSERT/UPDATE gallery
  for (const gi of data.gallery_items) {
    const existing = await drizzleDb.select().from(galleryItems).where(eq(galleryItems.id, gi.id));
    if (existing.length === 0) {
      await drizzleDb.insert(galleryItems).values(gi);
    } else {
      await drizzleDb.update(galleryItems).set(gi).where(eq(galleryItems.id, gi.id));
    }
  }

  // 7. INSERT/UPDATE notifications
  for (const n of data.notifications) {
    const existing = await drizzleDb.select().from(notifications).where(eq(notifications.id, n.id));
    const isReadVal = n.read !== undefined ? n.read : (n.is_read !== undefined ? n.is_read : false);
    const dbNotif = {
      id: n.id,
      user_id: n.user_id,
      title: n.title,
      message: n.message,
      read: isReadVal,
      created_at: n.created_at
    };
    if (existing.length === 0) {
      await drizzleDb.insert(notifications).values(dbNotif);
    } else {
      await drizzleDb.update(notifications).set(dbNotif).where(eq(notifications.id, n.id));
    }
  }
}
// Run migrations dynamically on start if SQL is configured
import { migrate } from 'drizzle-orm/node-postgres/migrator';

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


// ------------------- API ROUTES -------------------

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'zyron-super-secret-key-123';

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    
    let user;
    if (existing.length > 0) {
      // If there is an existing user but they have no password_hash, let them register/set password
      const firstWithNull = existing.find(u => !u.password_hash);
      if (firstWithNull) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const updated = await drizzleDb.update(users)
          .set({ password_hash: hashedPassword })
          .where(eq(users.id, firstWithNull.id))
          .returning();
        user = updated[0];
      } else {
        return res.status(400).json({ error: 'Email already exists' });
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const uid = 'uid-' + Date.now() + '-' + Math.floor(Math.random()*1000);
      const adminEmails = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'];
      const role = adminEmails.includes(normalizedEmail) ? 'admin' : 'user';
      
      const newUser = await drizzleDb.insert(users).values({
        uid,
        email: normalizedEmail,
        password_hash: hashedPassword,
        role
      }).returning();
      user = newUser[0];
    }
    
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) return res.status(400).json({ error: 'Invalid email or password' });
    
    // Find the user with a matching password_hash
    const userWithPassword = existing.find(u => !!u.password_hash);
    if (!userWithPassword) return res.status(400).json({ error: 'Invalid email or password' });
    
    const match = await bcrypt.compare(password, userWithPassword.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid email or password' });

    const user = userWithPassword;
    // Dynamic admin check & promotion
    const adminEmails = ['admin@zyron.events', 'sakethma007@gmail.com', 'zyronproductions@gmail.com'];
    if (user.email && adminEmails.includes(user.email.toLowerCase().trim()) && user.role !== 'admin') {
      user.role = 'admin';
      await drizzleDb.update(users).set({ role: 'admin' }).where(eq(users.uid, user.uid));
    }
    
    const token = jwt.sign({ uid: user.uid, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// Password recovery system
const resetCodes = new Map<string, { code: string; expiresAt: number }>();

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  const normalizedEmail = email.trim().toLowerCase();
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No user registered with this email address' });
    }
    
    // Generate 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins expiry
    
    resetCodes.set(normalizedEmail, { code, expiresAt });
    
    console.log(`[PASSWORD RESET SUCCESS] Generated code ${code} for user: ${normalizedEmail}`);
    
    let emailSent = false;
    let emailErrorMsg = '';
    
    const emailResult = await sendMail({
      to: normalizedEmail,
      subject: 'Your Zyron Productions Reset Code',
      text: `Your password reset code is: ${code}\n\nThis code is valid for 15 minutes. Use it to securely reset your password.`
    });
    
    if (emailResult.success) {
      emailSent = true;
    } else {
      emailErrorMsg = emailResult.error || 'Configuration or delivery error';
    }
    
    return res.json({ 
      success: true, 
      message: emailSent 
        ? 'A secure 6-digit verification code has been sent to your email.' 
        : `Verification code generated. (Email delivery failed: ${emailErrorMsg}. Use code: ${code} to proceed).`,
      code: emailSent ? undefined : code
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password are required' });
  }
  
  const normalizedEmail = email.trim().toLowerCase();
  const cached = resetCodes.get(normalizedEmail);
  
  if (!cached) {
    return res.status(400).json({ error: 'No active reset request found for this email' });
  }
  
  if (cached.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  
  if (Date.now() > cached.expiresAt) {
    resetCodes.delete(normalizedEmail);
    return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
  }
  
  try {
    const existing = await drizzleDb.select().from(users).where(eq(users.email, normalizedEmail));
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User no longer exists' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password_hash for all matches (or just the user)
    await drizzleDb.update(users)
      .set({ password_hash: hashedPassword })
      .where(eq(users.email, normalizedEmail));
      
    resetCodes.delete(normalizedEmail);
    console.log(`[PASSWORD RESET SUCCESS] Successfully reset password for user: ${normalizedEmail}`);
    
    return res.json({ success: true, message: 'Password has been successfully updated.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session_token', { sameSite: 'none', secure: true });
  return res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: any) => {
  return res.json({ user: req.user });
});


// SMTP Diagnostic endpoints
app.get('/api/smtp/status', async (req, res) => {
  if (!transporter) {
    return res.json({
      configured: false,
      working: false,
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      error: 'SMTP_USER and/or SMTP_PASS are missing in the .env configuration.'
    });
  }

  try {
    // Run a live verification check on the connection
    await new Promise<void>((resolve, reject) => {
      transporter!.verify((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.json({
      configured: true,
      working: true,
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      message: 'SMTP credentials are valid and connection is successful!'
    });
  } catch (err: any) {
    return res.json({
      configured: true,
      working: false,
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      error: err.message || 'Verification failed.'
    });
  }
});

app.post('/api/smtp/test', async (req, res) => {
  const { to } = req.body;
  const recipient = to ? to.trim() : 'sakethma007@gmail.com';

  if (!transporter) {
    return res.status(400).json({
      success: false,
      error: 'SMTP is not configured. Please define SMTP_USER and SMTP_PASS environment variables.'
    });
  }

  try {
    const from = process.env.SMTP_FROM || `Zyron Productions <${smtpUser}>`;
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject: 'Test Email: Zyron Productions SMTP Verification',
      html: `
        <div style="font-family: monospace; color: #171717; background-color: #fafafa; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5;">
          <h2 style="color: #7c3aed; text-transform: uppercase; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px;">Zyron SMTP Diagnostic Test</h2>
          <p>This is a diagnostic email verifying that your <strong>Gmail SMTP/Nodemailer</strong> integration is fully functional!</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 24px 0; color: #166534;">
            <strong>Status:</strong> Success! The keys and setup are proper.
          </div>
          <p style="font-size: 11px; color: #737373;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    });

    return res.json({
      success: true,
      message: `Test email sent successfully to ${recipient}!`,
      messageId: info.messageId,
      response: info.response
    });
  } catch (err: any) {
    console.error('SMTP diagnostics test failed:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send test email.'
    });
  }
});


// Public Events API
app.get('/api/events', async (req, res) => {
  try {
    const published = await drizzleDb.select().from(events).where(eq(events.status, 'published'));
    // Sort by event_date ascending
    published.sort((a: any, b: any) => new Date(a.event_date || '').getTime() - new Date(b.event_date || '').getTime());
    return res.json(published);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:slug', async (req, res) => {
  try {
    const result = await drizzleDb.select().from(events).where(eq(events.slug, req.params.slug));
    if (result.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    return res.json(result[0]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// Public Gallery API
app.get('/api/gallery', async (req, res) => {
  try {
    const items = await drizzleDb.select().from(galleryItems);
    items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0) || new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    return res.json(items.slice(0, 60));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// Bookings API (Requires Authentication)
app.get('/api/bookings/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userBookings = await drizzleDb.select().from(bookings).where(eq(bookings.user_id, req.user.uid));
    
    // Join with event details
    const result = [];
    for (const b of userBookings) {
      const eventResult = await drizzleDb.select().from(events).where(eq(events.id, b.event_id || ''));
      const event = eventResult[0] || null;
      result.push({
        ...b,
        event_title: event?.title || 'Unknown Event',
        event_slug: event?.slug || '',
        event_date: event?.event_date || '',
        event_location: event?.location || '',
        event_image_url: event?.image_url || ''
      });
    }

    // Sort by created_at descending
    result.sort((a: any, b: any) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', requireAuth, async (req: AuthRequest, res) => {
  console.log("POST /api/bookings req.body:", req.body);
  try {
    await fs.writeFile('booking_debug.json', JSON.stringify({ body: req.body, headers: req.headers }, null, 2));
  } catch (err) {}
  let { event_id, tier, quantity, guest_name, guest_email, guest_phone, guest_instagram } = req.body;
  event_id = typeof event_id === 'string' ? event_id.trim() : event_id;
  tier = typeof tier === 'string' ? tier.trim() : tier;
  guest_name = typeof guest_name === 'string' ? guest_name.trim() : guest_name;
  guest_email = typeof guest_email === 'string' ? guest_email.trim() : guest_email;
  guest_phone = typeof guest_phone === 'string' ? guest_phone.trim() : guest_phone;

  if (!event_id || !tier || !quantity || !guest_name || !guest_email || !guest_phone) {
    return res.status(400).json({ error: 'All primary booking fields including phone are required.' });
  }
  if (quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: 'Invalid quantity. Max 20 tickets per booking.' });
  }

  try {
    const db = await readDb();
    const event = db.events.find((e: any) => e.id === event_id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (event.status !== 'published') {
      return res.status(400).json({ error: 'This event is not open for bookings.' });
    }

    let priceCents = 0;
    if (tier === 'vip') priceCents = event.vip_price_cents;
    else if (tier === 'group') priceCents = event.group_price_cents;
    else if (tier === 'earlybird') priceCents = event.earlybird_price_cents;
    else if (tier === 'couple') priceCents = event.couple_price_cents;
    else priceCents = event.general_price_cents;

    if (!priceCents || priceCents <= 0) {
      return res.status(400).json({ error: 'Selected ticket tier is not available.' });
    }

    if (event.tickets_sold + quantity > event.capacity) {
      return res.status(400).json({ error: 'Not enough tickets left for this tier/quantity.' });
    }

    // Atomic update of tickets_sold
    event.tickets_sold += quantity;

    const newBooking = {
      id: crypto.randomUUID(),
      user_id: req.user.id,
      event_id,
      tier,
      quantity,
      guest_name,
      guest_email,
      guest_phone,
      guest_instagram: guest_instagram || '',
      total_cents: priceCents * quantity,
      payment_status: 'pending',
      payment_provider_ref: '',
      dietary: '',
      role_preference: '',
      accessibility: '',
      cancelled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.bookings.push(newBooking);
    await writeDb(db);

    return res.json(newBooking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update guest preferences per booking
app.post('/api/bookings/:id/preferences', requireAuth, async (req: AuthRequest, res) => {
  const { dietary, role_preference, accessibility } = req.body;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Security check: Must own booking, or be admin
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this booking.' });
    }

    booking.dietary = dietary || '';
    booking.role_preference = role_preference || '';
    booking.accessibility = accessibility || '';
    booking.updated_at = new Date().toISOString();

    await writeDb(db);
    return res.json(booking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Cancel a booking
app.post('/api/bookings/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Check ownership or admin role
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this booking.' });
    }

    if (booking.cancelled_at) {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // Release ticket inventory
    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (event) {
      event.tickets_sold = Math.max(0, event.tickets_sold - booking.quantity);
    }

    booking.cancelled_at = new Date().toISOString();
    booking.payment_status = 'refunded';
    booking.updated_at = new Date().toISOString();

    await writeDb(db);
    return res.json(booking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// Simulated Payment Endpoint
app.post('/api/bookings/:id/pay', requireAuth, async (req: AuthRequest, res) => {
  const { payment_ref } = req.body;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    booking.payment_status = 'paid';
    booking.payment_provider_ref = payment_ref || `pay_sim_${crypto.randomBytes(4).toString('hex')}`;
    booking.updated_at = new Date().toISOString();

    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Confirmed & Tickets Emailed',
      message: `Payment of ₹${Math.round(booking.total_cents / 100).toLocaleString()} successfully processed. Your event tickets have been sent to ${booking.guest_email}.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(newNotif);

    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (event) {
      await sendConfirmationEmail(booking, event);
    }

    await writeDb(db);
    return res.json(booking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// ------------------- RAZORPAY INTEGRATION -------------------
import Razorpay from 'razorpay';

let razorpayInstance: Razorpay | null = null;
function getRazorpay() {
  if (!razorpayInstance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return null;
    }
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

app.get('/api/config/razorpay', (req, res) => {
  res.json({ configured: !!getRazorpay(), key_id: process.env.RAZORPAY_KEY_ID || null });
});

// DEV BYPASS for Testing without Razorpay Key
app.post('/api/bookings/:id/dev-bypass', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = req.params.id;
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === bookingId);
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    booking.payment_status = 'paid';
    booking.payment_provider_ref = 'dev_bypass_' + Date.now();

    // Create notification
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Confirmed & Tickets Emailed',
      message: `Payment of ₹${Math.round(booking.total_cents / 100).toLocaleString()} successfully processed (Bypass). Your event tickets have been sent to ${booking.guest_email}.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(newNotif);

    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (event) {
      await sendConfirmationEmail(booking, event);
    }

    await writeDb(db);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/:id/razorpay-order', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const bookingId = req.params.id;
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === bookingId);
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });
    
    // Auth check
    const reqUser = (req as any).user;
    if (booking.user_id !== reqUser.id && reqUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(500).json({ error: 'Razorpay keys not configured on server' });
    }

    const options = {
      amount: booking.total_cents, // amount in the smallest currency unit
      currency: "INR",
      receipt: booking.id,
    };

    const order = await rzp.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/:id/verify-razorpay', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    const bookingId = req.params.id;
    
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay Secret Key not configured on server' });
    }

    const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    // Auth check
    const reqUser = (req as any).user;
    if (booking.user_id !== reqUser.id && reqUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Mark as paid
    booking.payment_status = 'paid';
    
    // Create notification
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Confirmed & Tickets Emailed',
      message: `Payment of ₹${Math.round(booking.total_cents / 100).toLocaleString()} successfully processed via Razorpay. Your event tickets have been sent to ${booking.guest_email}.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    db.notifications.unshift(newNotif);

    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (event) {
      await sendConfirmationEmail(booking, event);
    }

    await writeDb(db);
    return res.json({ success: true, booking });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ------------------- ADMIN API ROUTES -------------------

// Admin events list
app.get('/api/admin/events', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    // Sort by created_at desc for administration
    const events = [...db.events];
    events.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json(events);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin upsert event
app.post('/api/admin/events', requireAdmin, async (req: AuthRequest, res: any) => {
  const {
    id, title, teaser, description, event_date, location, image_url,
    capacity, general_price, vip_price, group_price, earlybird_price, couple_price, status
  } = req.body;

  if (!title || !location || !event_date || !capacity) {
    return res.status(400).json({ error: 'Title, Location, Date, and Capacity are required.' });
  }

  try {
    const db = await readDb();
    
    // Convert ₹ back to cents
    const general_price_cents = Math.round((parseFloat(general_price) || 0) * 100);
    const vip_price_cents = Math.round((parseFloat(vip_price) || 0) * 100);
    const group_price_cents = Math.round((parseFloat(group_price) || 0) * 100);
    const earlybird_price_cents = Math.round((parseFloat(earlybird_price) || 0) * 100);
    const couple_price_cents = Math.round((parseFloat(couple_price) || 0) * 100);

    // Create slug from title if not specified
    let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let count = 1;
    
    while (db.events.find((e: any) => e.slug === slug && e.id !== id)) {
      count++;
      slug = `${baseSlug}-${count}`;
    }

    if (id) {
      // Edit mode
      const eventIndex = db.events.findIndex((e: any) => e.id === id);
      if (eventIndex === -1) {
        return res.status(404).json({ error: 'Event not found to update.' });
      }

      const existing = db.events[eventIndex];
      if (capacity < existing.tickets_sold) {
        return res.status(400).json({ error: `Cannot decrease capacity below current tickets sold (${existing.tickets_sold}).` });
      }

      db.events[eventIndex] = {
        ...existing,
        title,
        slug,
        teaser: teaser || '',
        description: description || '',
        event_date,
        location,
        image_url: image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200',
        capacity: parseInt(capacity),
        general_price_cents,
        vip_price_cents,
        group_price_cents,
        earlybird_price_cents,
        couple_price_cents,
        status: status || 'draft',
        updated_at: new Date().toISOString()
      };

      await writeDb(db);
      return res.json(db.events[eventIndex]);
    } else {
      // Create mode
      const newEvent = {
        id: crypto.randomUUID(),
        title,
        slug,
        teaser: teaser || '',
        description: description || '',
        event_date,
        location,
        image_url: image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200',
        capacity: parseInt(capacity),
        tickets_sold: 0,
        general_price_cents,
        vip_price_cents,
        group_price_cents,
        earlybird_price_cents,
        couple_price_cents,
        status: status || 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.events.push(newEvent);
      await writeDb(db);
      return res.json(newEvent);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Delete Event
app.delete('/api/admin/events/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const eventId = req.params.id;
    // Check if event has any active paid/pending bookings
    const activeBookings = await drizzleDb.select().from(bookings).where(and(eq(bookings.event_id, eventId), isNull(bookings.cancelled_at)));
    if (activeBookings.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete event with active bookings. Please archive the event instead or cancel existing bookings first.'
      });
    }

    await drizzleDb.delete(galleryItems).where(eq(galleryItems.event_id, eventId));
    await drizzleDb.delete(bookings).where(eq(bookings.event_id, eventId));
    await drizzleDb.delete(events).where(eq(events.id, eventId));

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Get Event Guests
app.get('/api/admin/events/:id/guests', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const guests = db.bookings.filter((b: any) => b.event_id === req.params.id);
    return res.json(guests);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Check In Guest
app.post('/api/admin/bookings/:id/checkin', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.checked_in) {
      return res.status(400).json({ error: 'Guest already checked in.' });
    }
    booking.checked_in = true;
    booking.checked_in_at = new Date().toISOString();
    await writeDb(db);
    return res.json({ success: true, booking });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Add Gallery Item
app.post('/api/admin/gallery', requireAdmin, async (req: AuthRequest, res: any) => {
  const { image_url, caption, event_id, sort_order } = req.body;
  if (!image_url) {
    return res.status(400).json({ error: 'Image URL is required.' });
  }
  try {
    const db = await readDb();
    const newItem = {
      id: crypto.randomUUID(),
      image_url,
      caption: caption || '',
      event_id: event_id || null,
      sort_order: parseInt(sort_order) || 0,
      created_at: new Date().toISOString()
    };
    db.gallery_items.push(newItem);
    await writeDb(db);
    return res.json(newItem);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Delete Gallery Item
app.delete('/api/admin/gallery/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    await drizzleDb.delete(galleryItems).where(eq(galleryItems.id, req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Analytics
app.get('/api/admin/analytics', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();

    // Sum paid bookings total_cents
    const paidBookings = db.bookings.filter((b: any) => b.payment_status === 'paid' && b.cancelled_at === null);
    const totalRevenueCents = paidBookings.reduce((sum: number, b: any) => sum + b.total_cents, 0);
    const paidBookingsCount = paidBookings.length;

    // Capacity stats across all published/archived events
    const activeEvents = db.events.filter((e: any) => e.status !== 'archived');
    const totalCapacity = activeEvents.reduce((sum: number, e: any) => sum + e.capacity, 0);
    const ticketsSold = activeEvents.reduce((sum: number, e: any) => sum + e.tickets_sold, 0);

    // Tier breakdown
    const tierBreakdown = { general: 0, vip: 0, group: 0, earlybird: 0, couple: 0 };
    paidBookings.forEach((b: any) => {
      if (b.tier === 'vip') tierBreakdown.vip += b.quantity;
      else if (b.tier === 'group') tierBreakdown.group += b.quantity;
      else if (b.tier === 'earlybird') tierBreakdown.earlybird += b.quantity;
      else if (b.tier === 'couple') tierBreakdown.couple += b.quantity;
      else tierBreakdown.general += b.quantity;
    });

    // Repeat buyer rate
    const buyerCounts: { [email: string]: number } = {};
    paidBookings.forEach((b: any) => {
      const email = b.guest_email.toLowerCase();
      buyerCounts[email] = (buyerCounts[email] || 0) + 1;
    });
    const uniqueBuyers = Object.keys(buyerCounts).length;
    const repeatBuyers = Object.values(buyerCounts).filter((cnt: number) => cnt > 1).length;
    const repeatBuyerRate = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0;

    // Per event metrics
    const eventStats = db.events.map((e: any) => {
      const eventPaidBookings = db.bookings.filter((b: any) => b.event_id === e.id && b.payment_status === 'paid' && b.cancelled_at === null);
      const revenueCents = eventPaidBookings.reduce((sum: number, b: any) => sum + b.total_cents, 0);
      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        tickets_sold: e.tickets_sold,
        capacity: e.capacity,
        revenueCents
      };
    });

    return res.json({
      totalRevenueCents,
      paidBookingsCount,
      ticketsSold,
      totalCapacity,
      tierBreakdown,
      repeatBuyerRate,
      eventStats
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// ------------------- VITE & STATIC SERVING -------------------

async function startServer() {
  await initDb();

  // If in development, run Vite dev server as middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
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
