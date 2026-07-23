import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import { eq, desc, and, isNull } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { bookings, events } from '../../src/db/schema.ts';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { readDb, writeDb } from '../services/db.ts';
import { sendConfirmationEmail } from '../services/email.ts';
import { sendWhatsAppConfirmation } from '../services/whatsapp.ts';

const router = Router();

function getCashfreeBaseUrl() {
  const env = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase();
  return env === 'PRODUCTION'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
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
  let { event_id, tier, quantity, guest_name, guest_email, guest_phone, guest_instagram, coupon_code, additional_guests } = req.body;
  event_id = typeof event_id === 'string' ? event_id.trim() : event_id;
  tier = typeof tier === 'string' ? tier.trim() : tier;
  guest_name = typeof guest_name === 'string' ? guest_name.trim() : guest_name;
  guest_email = typeof guest_email === 'string' ? guest_email.trim() : guest_email;
  guest_phone = typeof guest_phone === 'string' ? guest_phone.trim() : guest_phone;
  additional_guests = typeof additional_guests === 'string' ? additional_guests.trim() : (Array.isArray(additional_guests) ? additional_guests.filter(Boolean).join(', ') : '');

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
      additional_guests: additional_guests || '',
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
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const downloadUrl = `${protocol}://${host}/api/tickets/${booking.id}/download`;

      sendConfirmationEmail(booking, event, downloadUrl).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Simulated payment email dispatch failed:', err);
      });

      sendWhatsAppConfirmation(booking, event, downloadUrl).then(waRes => {
        if (waRes.success) {
          booking.whatsapp_status = 'sent';
          writeDb(db).catch(() => {});
        }
      }).catch(err => console.error('[WhatsApp Background Error]', err));
    }

    await writeDb(db);
    return res.json(booking);
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
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const downloadUrl = `${protocol}://${host}/api/tickets/${booking.id}/download`;

      sendConfirmationEmail(booking, event, downloadUrl).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Developer bypass email dispatch failed:', err);
      });

      sendWhatsAppConfirmation(booking, event, downloadUrl).then(waRes => {
        if (waRes.success) {
          booking.whatsapp_status = 'sent';
          writeDb(db).catch(() => {});
        }
      }).catch(err => console.error('[WhatsApp Background Error]', err));
    }

    await writeDb(db);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create Cashfree order
router.post('/:id/cashfree-order', requireAuth, async (req: AuthRequest, res: any) => {
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

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
      return res.status(500).json({ error: 'Cashfree API keys not configured on server' });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const baseUrl = getCashfreeBaseUrl();

    // Unique order ID format for Cashfree
    const cleanBookingId = booking.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const orderId = `order_${cleanBookingId}_${Date.now()}`;
    const amountInInr = Number((booking.total_cents / 100).toFixed(2));

    const payload = {
      order_id: orderId,
      order_amount: amountInInr,
      order_currency: "INR",
      customer_details: {
        customer_id: (booking.user_id || `cust_${cleanBookingId}`).replace(/[^a-zA-Z0-9_-]/g, '_'),
        customer_name: booking.guest_name || 'Guest',
        customer_email: booking.guest_email || 'guest@example.com',
        customer_phone: (booking.guest_phone || '9999999999').replace(/[^0-9]/g, '').slice(-10) || '9999999999'
      },
      order_meta: {
        return_url: `${appUrl}/booking-success?bookingId=${booking.id}&order_id={order_id}`
      }
    };

    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cashfree Create Order Error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to create Cashfree order' });
    }

    return res.json({
      cf_order_id: data.order_id,
      payment_session_id: data.payment_session_id,
      order_status: data.order_status,
      amount: booking.total_cents,
      currency: "INR"
    });
  } catch (err: any) {
    console.error('Cashfree order creation exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify Cashfree Payment
router.post('/:id/verify-cashfree', requireAuth, async (req: AuthRequest, res: any) => {
  try {
    const { order_id } = req.body;
    const bookingId = req.params.id;

    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
      return res.status(500).json({ error: 'Cashfree API keys not configured on server' });
    }

    const baseUrl = getCashfreeBaseUrl();
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    const reqUser = (req as any).user;
    if (booking.user_id !== reqUser.id && reqUser.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.payment_status === 'paid') {
      return res.json({ success: true, booking, message: 'Already paid' });
    }

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required for verification' });
    }

    const response = await fetch(`${baseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': '2023-08-01'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Cashfree Order Verification Error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to verify Cashfree order' });
    }

    if (data.order_status === 'PAID') {
      booking.payment_status = 'paid';
      booking.payment_provider_ref = order_id;
      
      const newNotif = {
        id: crypto.randomUUID(),
        user_id: booking.user_id,
        title: 'Payment Confirmed & Tickets Emailed',
        message: `Payment of ₹${Math.round(booking.total_cents / 100).toLocaleString()} successfully processed via Cashfree. Your event tickets have been sent to ${booking.guest_email}.`,
        read: false,
        created_at: new Date().toISOString(),
      };
      db.notifications.unshift(newNotif);

      const event = db.events.find((e: any) => e.id === booking.event_id);
      if (event) {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
        const downloadUrl = `${protocol}://${host}/api/tickets/${booking.id}/download`;

        sendConfirmationEmail(booking, event, downloadUrl).catch(err => {
          console.error('[SMTP BACKGROUND ERROR] Cashfree verification email dispatch failed:', err);
        });

        sendWhatsAppConfirmation(booking, event, downloadUrl).then(waRes => {
          if (waRes.success) {
            booking.whatsapp_status = 'sent';
            writeDb(db).catch(() => {});
          }
        }).catch(err => console.error('[WhatsApp Background Error]', err));
      }

      await writeDb(db);
      return res.json({ success: true, booking, order_status: data.order_status });
    } else {
      return res.status(400).json({
        success: false,
        error: `Payment is not completed. Cashfree status: ${data.order_status}`
      });
    }
  } catch (err: any) {
    console.error('Cashfree verification exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// Legacy Razorpay compatibility endpoints
router.post('/:id/razorpay-order', requireAuth, async (req: AuthRequest, res: any) => {
  return res.redirect(307, `/api/bookings/${req.params.id}/cashfree-order`);
});

router.post('/:id/verify-razorpay', requireAuth, async (req: AuthRequest, res: any) => {
  return res.redirect(307, `/api/bookings/${req.params.id}/verify-cashfree`);
});

// Submit UPI Payment Proof (UTR + Screenshot) for Manual Review
router.post('/:id/submit-proof', requireAuth, async (req: AuthRequest, res: any) => {
  const { utr, screenshot, guest_name, guest_email, guest_phone } = req.body;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    if (!utr || typeof utr !== 'string' || utr.trim().length < 6) {
      return res.status(400).json({ error: 'Please enter a valid UTR / Transaction Reference Number.' });
    }

    const cleanedUtr = utr.trim();

    let ocrDetectedUtr = cleanedUtr;
    let ocrDetectedAmount = Math.round(booking.total_cents / 100);

    if (screenshot && typeof screenshot === 'string') {
      try {
        const { scanPaymentProofImage } = await import('../services/ocr.ts');
        const ocrRes = await scanPaymentProofImage(screenshot);
        if (ocrRes.detectedUtr) ocrDetectedUtr = ocrRes.detectedUtr;
        if (ocrRes.detectedAmountCents) ocrDetectedAmount = Math.round(ocrRes.detectedAmountCents / 100);
      } catch (ocrErr) {
        console.warn('OCR scan notice:', ocrErr);
      }
    }

    booking.utr = cleanedUtr;
    booking.payment_proof_url = screenshot || '';
    booking.ocr_detected_utr = ocrDetectedUtr;
    booking.ocr_detected_amount = ocrDetectedAmount;
    booking.payment_status = 'pending_verification';
    if (guest_name) booking.guest_name = guest_name;
    if (guest_email) booking.guest_email = guest_email;
    if (guest_phone) booking.guest_phone = guest_phone;
    booking.updated_at = new Date().toISOString();

    const shortId = booking.id.substring(0, 8).toUpperCase();
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Proof Submitted',
      message: `Your payment proof (UTR: ${cleanedUtr}) for Booking #${shortId} has been submitted. Status: Pending Admin Verification.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(newNotif);

    await writeDb(db);
    return res.json({ success: true, booking });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Download Digital PDF Ticket Pass
router.get('/:id/pdf', async (req, res: any) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).send('Booking not found');
    }

    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (!event) {
      return res.status(404).send('Event not found');
    }

    const { generateTicketPdfBuffer } = await import('../services/pdf.ts');
    const pdfBuffer = await generateTicketPdfBuffer(booking, event);

    const ticketId = booking.ticket_id || booking.id.substring(0, 8).toUpperCase();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Zyron_Ticket_${ticketId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Failed to generate ticket PDF:', err);
    return res.status(500).send('Error generating PDF ticket');
  }
});

export default router;
