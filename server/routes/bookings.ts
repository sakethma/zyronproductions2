import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { bookings, events } from '../../src/db/schema.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { readDb, writeDb } from '../services/db.ts';
import { sendConfirmationEmail } from '../services/email.ts';
import Razorpay from 'razorpay';

const router = Router();

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

// User bookings list
router.get('/my', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userBookings = await drizzleDb.select().from(bookings).where(eq(bookings.user_id, req.user.uid));
    
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

    result.sort((a: any, b: any) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Validate coupon
router.post('/validate-coupon', requireAuth, async (req: AuthRequest, res: any) => {
  let { code, event_id, ticket_price_cents, quantity } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Coupon code is required.' });
  }

  code = code.trim().toUpperCase();
  quantity = parseInt(quantity) || 1;

  try {
    const db = await readDb();
    if (!db.coupons) db.coupons = [];
    const coupon = db.coupons.find((c: any) => c.code === code);

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code.' });
    }

    if (!coupon.active) {
      return res.status(400).json({ error: 'This coupon is inactive.' });
    }

    if (coupon.max_uses !== null && coupon.max_uses !== undefined && coupon.uses >= coupon.max_uses) {
      return res.status(400).json({ error: 'This coupon has reached its maximum usage limit.' });
    }

    if (coupon.event_id && coupon.event_id !== event_id) {
      return res.status(400).json({ error: 'This coupon is not valid for this event.' });
    }

    const originalTotalCents = (ticket_price_cents || 0) * quantity;
    let discountCents = 0;

    if (coupon.discount_type === 'percentage') {
      discountCents = Math.round((originalTotalCents * coupon.discount_value) / 100);
    } else if (coupon.discount_type === 'fixed') {
      discountCents = coupon.discount_value;
    }

    if (discountCents > originalTotalCents) {
      discountCents = originalTotalCents;
    }

    return res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value
      },
      discount_cents: discountCents,
      final_cents: originalTotalCents - discountCents
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create booking
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  let { event_id, tier, quantity, guest_name, guest_email, guest_phone, guest_instagram, coupon_code } = req.body;
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

    event.tickets_sold += quantity;

    let originalTotalCents = priceCents * quantity;
    let discountCents = 0;
    let validatedCouponCode = null;

    if (coupon_code && typeof coupon_code === 'string' && coupon_code.trim()) {
      const code = coupon_code.trim().toUpperCase();
      if (!db.coupons) db.coupons = [];
      const coupon = db.coupons.find((c: any) => c.code === code);
      if (!coupon) {
        return res.status(400).json({ error: 'Invalid coupon code.' });
      }
      if (!coupon.active) {
        return res.status(400).json({ error: 'This coupon is inactive.' });
      }
      if (coupon.max_uses !== null && coupon.max_uses !== undefined && coupon.uses >= coupon.max_uses) {
        return res.status(400).json({ error: 'This coupon has reached its maximum usage limit.' });
      }
      if (coupon.event_id && coupon.event_id !== event_id) {
        return res.status(400).json({ error: 'This coupon is not valid for this event.' });
      }

      if (coupon.discount_type === 'percentage') {
        discountCents = Math.round((originalTotalCents * coupon.discount_value) / 100);
      } else if (coupon.discount_type === 'fixed') {
        discountCents = coupon.discount_value;
      }

      if (discountCents > originalTotalCents) {
        discountCents = originalTotalCents;
      }

      coupon.uses += 1;
      validatedCouponCode = coupon.code;
    }

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
      total_cents: originalTotalCents - discountCents,
      coupon_code: validatedCouponCode,
      discount_cents: discountCents,
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

// Preferences update
router.post('/:id/preferences', requireAuth, async (req: AuthRequest, res) => {
  const { dietary, role_preference, accessibility } = req.body;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

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

// Cancel booking
router.post('/:id/cancel', requireAuth, async (req: AuthRequest, res) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this booking.' });
    }

    if (booking.cancelled_at) {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

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

// Simulated payment
router.post('/:id/pay', requireAuth, async (req: AuthRequest, res) => {
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
      sendConfirmationEmail(booking, event).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Simulated payment email dispatch failed:', err);
      });
    }

    await writeDb(db);
    return res.json(booking);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Resend email
router.post('/:id/resend-email', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden. You do not own this booking.' });
    }

    if (booking.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Cannot send confirmation email for unpaid bookings.' });
    }

    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (!event) {
      return res.status(404).json({ error: 'Associated event not found.' });
    }

    await sendConfirmationEmail(booking, event);
    return res.json({ success: true, message: `Tickets re-sent successfully to ${booking.guest_email}!` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DEV bypass
router.post('/:id/dev-bypass', requireAuth, async (req: AuthRequest, res) => {
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
      sendConfirmationEmail(booking, event).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Developer bypass email dispatch failed:', err);
      });
    }

    await writeDb(db);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create Razorpay order
router.post('/:id/razorpay-order', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const bookingId = req.params.id;
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === bookingId);
    
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.payment_status === 'paid') return res.status(400).json({ error: 'Already paid' });
    
    const reqUser = (req as any).user;
    if (booking.user_id !== reqUser.id && reqUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const rzp = getRazorpay();
    if (!rzp) {
      return res.status(500).json({ error: 'Razorpay keys not configured on server' });
    }

    const options = {
      amount: booking.total_cents,
      currency: "INR",
      receipt: booking.id,
    };

    const order = await rzp.orders.create(options);
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Razorpay
router.post('/:id/verify-razorpay', requireAuth, async (req: AuthRequest, res: any) => {
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
    
    const reqUser = (req as any).user;
    if (booking.user_id !== reqUser.id && reqUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    booking.payment_status = 'paid';
    
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
      sendConfirmationEmail(booking, event).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Razorpay verification email dispatch failed:', err);
      });
    }

    await writeDb(db);
    return res.json({ success: true, booking });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
