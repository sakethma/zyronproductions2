import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { events, bookings, galleryItems } from '../../src/db/schema.ts';
import { requireAdmin, AuthRequest } from '../middleware/auth.ts';
import { readDb, writeDb } from '../services/db.ts';

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

export default router;
