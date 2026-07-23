import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { events, bookings, galleryItems } from '../../src/db/schema.ts';
import { requireAdmin, AuthRequest } from '../middleware/auth.ts';
import { readDb, writeDb } from '../services/db.ts';
import { sendConfirmationEmail } from '../services/email.ts';

const router = Router();

// Admin events list
router.get('/events', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const eventsList = [...db.events];
    eventsList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json(eventsList);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin upsert event
router.post('/events', requireAdmin, async (req: AuthRequest, res: any) => {
  const {
    id, title, teaser, description, event_date, location, image_url,
    capacity, general_price, vip_price, group_price, earlybird_price, couple_price, status
  } = req.body;

  if (!title || !location || !event_date || !capacity) {
    return res.status(400).json({ error: 'Title, Location, Date, and Capacity are required.' });
  }

  try {
    const db = await readDb();
    
    const general_price_cents = Math.round((parseFloat(general_price) || 0) * 100);
    const vip_price_cents = Math.round((parseFloat(vip_price) || 0) * 100);
    const group_price_cents = Math.round((parseFloat(group_price) || 0) * 100);
    const earlybird_price_cents = Math.round((parseFloat(earlybird_price) || 0) * 100);
    const couple_price_cents = Math.round((parseFloat(couple_price) || 0) * 100);

    let baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    let slug = baseSlug;
    let count = 1;
    
    while (db.events.find((e: any) => e.slug === slug && e.id !== id)) {
      count++;
      slug = `${baseSlug}-${count}`;
    }

    if (id) {
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
router.delete('/events/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const eventId = req.params.id;

    await drizzleDb.delete(galleryItems).where(eq(galleryItems.event_id, eventId));
    await drizzleDb.delete(bookings).where(eq(bookings.event_id, eventId));
    await drizzleDb.delete(events).where(eq(events.id, eventId));

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Get Event Guests
router.get('/events/:id/guests', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const guests = db.bookings.filter((b: any) => b.event_id === req.params.id);
    return res.json(guests);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Check In Guest
router.post('/bookings/:id/checkin', requireAdmin, async (req: AuthRequest, res: any) => {
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
router.post('/gallery', requireAdmin, async (req: AuthRequest, res: any) => {
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
router.delete('/gallery/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    await drizzleDb.delete(galleryItems).where(eq(galleryItems.id, req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Analytics
router.get('/analytics', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();

    const paidBookings = db.bookings.filter((b: any) => b.payment_status === 'paid' && b.cancelled_at === null);
    const totalRevenueCents = paidBookings.reduce((sum: number, b: any) => sum + b.total_cents, 0);
    const paidBookingsCount = paidBookings.length;

    const activeEvents = db.events.filter((e: any) => e.status !== 'archived');
    const totalCapacity = activeEvents.reduce((sum: number, e: any) => sum + e.capacity, 0);
    const ticketsSold = activeEvents.reduce((sum: number, e: any) => sum + e.tickets_sold, 0);

    const tierBreakdown = { general: 0, vip: 0, group: 0, earlybird: 0, couple: 0 };
    paidBookings.forEach((b: any) => {
      if (b.tier === 'vip') tierBreakdown.vip += b.quantity;
      else if (b.tier === 'group') tierBreakdown.group += b.quantity;
      else if (b.tier === 'earlybird') tierBreakdown.earlybird += b.quantity;
      else if (b.tier === 'couple') tierBreakdown.couple += b.quantity;
      else tierBreakdown.general += b.quantity;
    });

    const buyerCounts: { [email: string]: number } = {};
    paidBookings.forEach((b: any) => {
      const email = b.guest_email.toLowerCase();
      buyerCounts[email] = (buyerCounts[email] || 0) + 1;
    });
    const uniqueBuyers = Object.keys(buyerCounts).length;
    const repeatBuyers = Object.values(buyerCounts).filter((cnt: number) => cnt > 1).length;
    const repeatBuyerRate = uniqueBuyers > 0 ? Math.round((repeatBuyers / uniqueBuyers) * 100) : 0;

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

// Admin coupons list
router.get('/coupons', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const couponsList = db.coupons || [];
    return res.json(couponsList);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin upsert coupon
router.post('/coupons', requireAdmin, async (req: AuthRequest, res: any) => {
  let { id, code, discount_type, discount_value, max_uses, event_id, active } = req.body;

  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({ error: 'Code, Discount Type, and Discount Value are required.' });
  }

  code = code.trim().toUpperCase();
  if (!['percentage', 'fixed'].includes(discount_type)) {
    return res.status(400).json({ error: 'Discount Type must be percentage or fixed.' });
  }

  const val = parseFloat(discount_value);
  if (isNaN(val) || val <= 0) {
    return res.status(400).json({ error: 'Discount Value must be greater than 0.' });
  }

  if (discount_type === 'percentage' && val > 100) {
    return res.status(400).json({ error: 'Percentage discount cannot exceed 100%.' });
  }

  try {
    const db = await readDb();
    if (!db.coupons) db.coupons = [];

    const existingWithSameCode = db.coupons.find((c: any) => c.code === code && c.id !== id);
    if (existingWithSameCode) {
      return res.status(400).json({ error: `A coupon with code ${code} already exists.` });
    }

    let finalDiscountValue = val;
    if (discount_type === 'fixed') {
      finalDiscountValue = Math.round(val * 100);
    } else {
      finalDiscountValue = Math.round(val);
    }

    if (id) {
      const couponIndex = db.coupons.findIndex((c: any) => c.id === id);
      if (couponIndex === -1) {
        return res.status(404).json({ error: 'Coupon not found to update.' });
      }

      const existing = db.coupons[couponIndex];
      db.coupons[couponIndex] = {
        ...existing,
        code,
        discount_type,
        discount_value: finalDiscountValue,
        max_uses: max_uses ? parseInt(max_uses) : null,
        event_id: event_id || null,
        active: active !== undefined ? !!active : existing.active,
      };

      await writeDb(db);
      return res.json(db.coupons[couponIndex]);
    } else {
      const newCoupon = {
        id: crypto.randomUUID(),
        code,
        discount_type,
        discount_value: finalDiscountValue,
        max_uses: max_uses ? parseInt(max_uses) : null,
        uses: 0,
        event_id: event_id || null,
        active: active !== undefined ? !!active : true,
        created_at: new Date().toISOString()
      };

      db.coupons.push(newCoupon);
      await writeDb(db);
      return res.json(newCoupon);
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Delete Coupon
router.delete('/coupons/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    if (!db.coupons) db.coupons = [];

    const index = db.coupons.findIndex((c: any) => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    db.coupons.splice(index, 1);
    await writeDb(db);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Toggle Coupon Status
router.post('/coupons/:id/toggle', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    if (!db.coupons) db.coupons = [];

    const coupon = db.coupons.find((c: any) => c.id === req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found.' });
    }

    coupon.active = !coupon.active;
    await writeDb(db);
    return res.json(coupon);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Reset Bookings (Clear everything)
router.post('/reset-bookings', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    
    // Clear all bookings
    db.bookings = [];
    
    // Also reset tickets_sold to 0 on all events
    db.events = db.events.map((e: any) => ({
      ...e,
      tickets_sold: 0,
      updated_at: new Date().toISOString()
    }));
    
    // Write back updated state to database
    await writeDb(db);
    
    return res.json({ success: true, message: 'All bookings cleared and event seat counts reset successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Pending Payments List with Duplicate UTR Detection
router.get('/pending-payments', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    
    // Filter bookings that have UTR submitted or are pending verification
    const pending = db.bookings.filter((b: any) => 
      (b.payment_status === 'pending_verification' || b.payment_status === 'pending' || b.utr) &&
      b.payment_status !== 'paid' &&
      b.payment_status !== 'refunded' &&
      b.cancelled_at === null
    );

    // Count UTR frequencies across all bookings
    const utrCounts: { [utr: string]: number } = {};
    db.bookings.forEach((b: any) => {
      if (b.utr) {
        const u = b.utr.trim();
        utrCounts[u] = (utrCounts[u] || 0) + 1;
      }
    });

    const enriched = pending.map((b: any) => {
      const event = db.events.find((e: any) => e.id === b.event_id);
      const isDuplicate = b.utr ? (utrCounts[b.utr.trim()] || 0) > 1 : false;
      
      // Calculate mismatch between event pass price and total_cents
      let expectedPriceCents = 0;
      if (event) {
        if (b.tier === 'vip') expectedPriceCents = event.vip_price_cents;
        else if (b.tier === 'group') expectedPriceCents = event.group_price_cents;
        else if (b.tier === 'earlybird') expectedPriceCents = event.earlybird_price_cents;
        else if (b.tier === 'couple') expectedPriceCents = event.couple_price_cents;
        else expectedPriceCents = event.general_price_cents;
      }
      expectedPriceCents = expectedPriceCents * (b.quantity || 1) - (b.discount_cents || 0);

      const hasAmountMismatch = Math.abs(b.total_cents - expectedPriceCents) > 1;

      return {
        ...b,
        is_duplicate_utr: isDuplicate,
        has_amount_mismatch: hasAmountMismatch,
        expected_total_cents: expectedPriceCents,
        event_title: event ? event.title : 'Event',
        event_date: event ? event.event_date : '',
        event_location: event ? event.location : ''
      };
    });

    enriched.sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin OCR Scan Single Booking Payment Proof
router.post('/bookings/:id/scan-ocr', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (!booking.payment_proof_url) {
      return res.status(400).json({ error: 'No payment proof screenshot found for this booking.' });
    }

    const { scanPaymentProofImage } = await import('../services/ocr.ts');
    const ocrResult = await scanPaymentProofImage(booking.payment_proof_url);

    if (ocrResult.detectedUtr) {
      booking.ocr_detected_utr = ocrResult.detectedUtr;
    }
    if (ocrResult.detectedAmountCents) {
      booking.ocr_detected_amount = Math.round(ocrResult.detectedAmountCents / 100);
    }
    booking.updated_at = new Date().toISOString();
    await writeDb(db);

    return res.json({
      success: true,
      booking,
      ocrResult
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Approve Booking Payment
router.post('/bookings/:id/approve', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    if (booking.payment_status === 'paid') {
      return res.status(400).json({ error: 'Booking is already approved and paid.' });
    }

    // Generate clean Ticket ID (e.g., TK9382)
    const ticketNum = Math.floor(1000 + Math.random() * 9000);
    const ticket_id = `TK${ticketNum}`;

    booking.payment_status = 'paid';
    booking.ticket_id = ticket_id;
    booking.payment_provider_ref = booking.utr || `UPI_MANUAL_${ticket_id}`;
    booking.updated_at = new Date().toISOString();

    // Increment tickets sold on event
    const event = db.events.find((e: any) => e.id === booking.event_id);
    if (event) {
      event.tickets_sold = (event.tickets_sold || 0) + (booking.quantity || 1);
    }

    // Construct download link
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const downloadUrl = `${protocol}://${host}/api/tickets/${booking.id}/download`;

    // Add user notification
    const shortBookingId = booking.id.substring(0, 8).toUpperCase();
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Approved! Ticket Generated',
      message: `Your payment proof for Booking #${shortBookingId} was verified & approved! Ticket ID: ${ticket_id}. Show your QR Code at venue entrance.`,
      read: false,
      created_at: new Date().toISOString(),
    };
    if (!db.notifications) db.notifications = [];
    db.notifications.unshift(newNotif);

    // Trigger WhatsApp notification in background
    const phone = booking.guest_phone || '';
    if (phone) {
      const { sendWhatsAppConfirmation } = await import('../services/whatsapp.ts');
      sendWhatsAppConfirmation(booking, event || { title: 'Zyron Event' }, downloadUrl)
        .then(waRes => {
          if (waRes.success) {
            booking.whatsapp_status = 'sent';
            writeDb(db).catch(() => {});
          }
        })
        .catch(err => console.error('[WhatsApp Background Error]', err));
    }

    // Send confirmation email in background
    if (event) {
      sendConfirmationEmail(booking, event).catch(err => {
        console.error('[SMTP BACKGROUND ERROR] Admin manual approval email dispatch failed:', err);
      });
    }

    await writeDb(db);
    return res.json({ success: true, booking, ticket_id, downloadUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Auto-Approve Process Batch
router.post('/auto-approve', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();

    // Find all pending bookings
    const pendingList = db.bookings.filter((b: any) =>
      (b.payment_status === 'pending_verification' || b.payment_status === 'pending' || b.utr) &&
      b.payment_status !== 'paid' &&
      b.payment_status !== 'refunded' &&
      b.cancelled_at === null
    );

    // Count UTR frequencies to detect duplicates
    const utrCounts: { [utr: string]: number } = {};
    db.bookings.forEach((b: any) => {
      if (b.utr) {
        const u = b.utr.trim();
        utrCounts[u] = (utrCounts[u] || 0) + 1;
      }
    });

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';

    let approvedCount = 0;
    const flaggedList: any[] = [];

    const { sendWhatsAppConfirmation } = await import('../services/whatsapp.ts');

    for (const booking of pendingList) {
      const utr = (booking.utr || '').trim();
      const isDuplicate = utr ? (utrCounts[utr] || 0) > 1 : false;

      const event = db.events.find((e: any) => e.id === booking.event_id);
      let expectedPriceCents = 0;
      if (event) {
        if (booking.tier === 'vip') expectedPriceCents = event.vip_price_cents;
        else if (booking.tier === 'group') expectedPriceCents = event.group_price_cents;
        else if (booking.tier === 'earlybird') expectedPriceCents = event.earlybird_price_cents;
        else if (booking.tier === 'couple') expectedPriceCents = event.couple_price_cents;
        else expectedPriceCents = event.general_price_cents;
      }
      expectedPriceCents = expectedPriceCents * (booking.quantity || 1) - (booking.discount_cents || 0);

      const amountMismatch = Math.abs(booking.total_cents - expectedPriceCents) > 1;

      // Check if eligible for auto-approve (valid UTR >= 10 digits, no duplicate UTR, amount matches)
      if (utr && utr.length >= 10 && !isDuplicate && !amountMismatch) {
        const ticketNum = Math.floor(1000 + Math.random() * 9000);
        const ticket_id = `TK${ticketNum}`;

        booking.payment_status = 'paid';
        booking.ticket_id = ticket_id;
        booking.payment_provider_ref = utr;
        booking.updated_at = new Date().toISOString();

        if (event) {
          event.tickets_sold = (event.tickets_sold || 0) + (booking.quantity || 1);
        }

        const downloadUrl = `${protocol}://${host}/api/tickets/${booking.id}/download`;

        // Send WhatsApp notification
        if (booking.guest_phone) {
          try {
            const waRes = await sendWhatsAppConfirmation(booking, event || { title: 'Zyron Event' }, downloadUrl);
            if (waRes.success) booking.whatsapp_status = 'sent';
          } catch (waErr) {
            console.error('WhatsApp dispatch error:', waErr);
          }
        }

        // Send Email
        if (event) {
          sendConfirmationEmail(booking, event).catch(() => {});
        }

        approvedCount++;
      } else {
        flaggedList.push({
          id: booking.id,
          utr,
          isDuplicate,
          amountMismatch,
          reason: isDuplicate ? 'Duplicate UTR detected' : amountMismatch ? 'Amount mismatch' : 'Invalid or missing UTR'
        });
      }
    }

    await writeDb(db);

    return res.json({
      success: true,
      approvedCount,
      flaggedCount: flaggedList.length,
      flaggedBookings: flaggedList
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Reject Booking Payment
router.post('/bookings/:id/reject', requireAdmin, async (req: AuthRequest, res: any) => {
  const { reason } = req.body;
  try {
    const db = await readDb();
    const booking = db.bookings.find((b: any) => b.id === req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    booking.payment_status = 'failed';
    booking.rejection_reason = reason || 'Payment proof verification failed or UTR mismatch.';
    booking.updated_at = new Date().toISOString();

    const shortBookingId = booking.id.substring(0, 8).toUpperCase();
    const newNotif = {
      id: crypto.randomUUID(),
      user_id: booking.user_id,
      title: 'Payment Proof Rejected',
      message: `Your payment proof for Booking #${shortBookingId} was rejected by ZYRON Admin: ${booking.rejection_reason}. Please submit a valid payment screenshot.`,
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

// Admin Bulk Approve Selected Bookings
router.post('/bookings/bulk-approve', requireAdmin, async (req: AuthRequest, res: any) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No booking IDs provided for bulk approval.' });
  }

  try {
    const db = await readDb();
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const downloadBase = `${protocol}://${host}`;

    let approvedCount = 0;
    const approvedIds: string[] = [];

    const { sendWhatsAppConfirmation } = await import('../services/whatsapp.ts');

    for (const id of ids) {
      const booking = db.bookings.find((b: any) => b.id === id);
      if (!booking || booking.payment_status === 'paid' || booking.cancelled_at) {
        continue;
      }

      const ticketNum = Math.floor(1000 + Math.random() * 9000);
      const ticket_id = `TK${ticketNum}`;

      booking.payment_status = 'paid';
      booking.ticket_id = ticket_id;
      booking.payment_provider_ref = booking.utr || `UPI_BULK_${ticket_id}`;
      booking.updated_at = new Date().toISOString();

      const event = db.events.find((e: any) => e.id === booking.event_id);
      if (event) {
        event.tickets_sold = (event.tickets_sold || 0) + (booking.quantity || 1);
      }

      const downloadUrl = `${downloadBase}/api/tickets/${booking.id}/download`;

      // Add user notification
      const shortBookingId = booking.id.substring(0, 8).toUpperCase();
      const newNotif = {
        id: crypto.randomUUID(),
        user_id: booking.user_id,
        title: 'Payment Approved - Digital Pass Issued!',
        message: `Your payment for Booking #${shortBookingId} has been verified. Ticket ID: ${ticket_id}. Present your QR code at the door!`,
        read: false,
        created_at: new Date().toISOString(),
      };
      if (!db.notifications) db.notifications = [];
      db.notifications.unshift(newNotif);

      // Trigger WhatsApp
      if (booking.guest_phone) {
        sendWhatsAppConfirmation(booking, event || { title: 'Zyron Event' }, downloadUrl)
          .then(waRes => {
            if (waRes.success) {
              booking.whatsapp_status = 'sent';
              writeDb(db).catch(() => {});
            }
          })
          .catch(err => console.error('[WhatsApp Bulk Error]', err));
      }

      // Send Email
      if (event) {
        sendConfirmationEmail(booking, event).catch(() => {});
      }

      approvedCount++;
      approvedIds.push(booking.id);
    }

    await writeDb(db);
    return res.json({ success: true, approvedCount, approvedIds });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Manual Trigger WhatsApp Reminders
router.post('/trigger-reminders', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const { checkAndSendUpcomingEventReminders } = await import('../services/reminder.ts');
    const result = await checkAndSendUpcomingEventReminders(baseUrl);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Download Attendance CSV Report
router.get('/reports/attendance', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const paidBookings = (db.bookings || []).filter((b: any) => b.payment_status === 'paid' && !b.cancelled_at);

    // Header row
    const rows = [
      [
        'Booking ID',
        'Ticket ID',
        'Event ID',
        'Event Title',
        'Guest Name',
        'Guest Email',
        'Guest Phone',
        'Ticket Tier',
        'Quantity',
        'Total Price (INR)',
        'UTR / Payment Ref',
        'Checked In',
        'Entry Timestamp',
        'Booking Date'
      ]
    ];

    for (const b of paidBookings) {
      const event = (db.events || []).find((e: any) => e.id === b.event_id);
      const totalInr = ((b.total_cents || 0) / 100).toFixed(2);
      const entryTimestamp = b.checked_in && b.checked_in_at 
        ? new Date(b.checked_in_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        : (b.checked_in ? 'Checked In' : 'Not Checked In');
      const bookingDate = b.created_at ? new Date(b.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';

      rows.push([
        b.id,
        b.ticket_id || 'N/A',
        b.event_id || 'N/A',
        event ? event.title : 'Unknown Event',
        b.guest_name || 'N/A',
        b.guest_email || 'N/A',
        b.guest_phone || 'N/A',
        b.tier || 'general',
        String(b.quantity || 1),
        totalInr,
        b.utr || b.payment_provider_ref || 'N/A',
        b.checked_in ? 'YES' : 'NO',
        entryTimestamp,
        bookingDate
      ]);
    }

    const csvString = rows
      .map((row) =>
        row
          .map((field) => {
            const escaped = String(field ?? '').replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zyron_attendance_report_${Date.now()}.csv"`);
    return res.status(200).send(csvString);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
