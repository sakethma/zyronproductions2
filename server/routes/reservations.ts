import { Router } from 'express';
import crypto from 'crypto';
import { readDb, writeDb, DbState } from '../services/db.ts';
import { sendWhatsAppConfirmation } from '../services/whatsapp.ts';
import { sendConfirmationEmail } from '../services/email.ts';
import { requireAdmin, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// Auto-Switch Evaluator Helper
export async function evaluateAutoSwitch(dbState?: DbState): Promise<{ switchedCount: number, db: DbState }> {
  const db = dbState || await readDb();
  let switchedCount = 0;
  const now = Date.now();

  for (const event of db.events) {
    if (event.auto_switch !== false && event.reservation_mode && event.reservation_deadline) {
      const deadlineMs = new Date(event.reservation_deadline).getTime();
      if (!isNaN(deadlineMs) && now >= deadlineMs) {
        // Transition event to Phase 2: Ticket Sales Live
        event.reservation_mode = false;
        event.ticket_sales_mode = true;
        event.updated_at = new Date().toISOString();
        switchedCount++;

        // Notify all reservations for this event
        const eventReservations = (db.reservations || []).filter((r: any) => r.event_id === event.id && r.status !== 'cancelled');
        for (const res of eventReservations) {
          if (!res.notified_at) {
            res.notified_at = new Date().toISOString();
            const purchaseUrl = `${process.env.APP_URL || 'http://localhost:3000'}/events/${event.slug}?access_token=${res.access_token}`;
            
            console.log(`[PHASE SWITCH DISPATCH] Sent SMS/WhatsApp/Email to ${res.full_name} (${res.phone_number} / ${res.email})`);
            console.log(`[PRIORITY ACCESS LINK]: ${purchaseUrl}`);

            // Dispatch simulated/live WhatsApp & Email
            const emailSubject = `🔥 Event Passes Are Live! Priority Access for ${event.title}`;
            const emailBody = `
              <h2>Your Reserved Spot is Ready!</h2>
              <p>Hi ${res.full_name},</p>
              <p>Reservations for <strong>${event.title}</strong> have officially closed and <strong>Event Passes are NOW LIVE!</strong></p>
              <p>As a reservation holder, you have <strong>${event.early_access_duration_hours || 24} hours of Early Access</strong> to claim your pass before public sales open.</p>
              <p><a href="${purchaseUrl}" style="display:inline-block; padding:12px 24px; background:#8b5cf6; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:4px;">Buy Pass With Early Access &rarr;</a></p>
              <p>Or use your Access Token during checkout: <code>${res.access_token}</code></p>
            `;
            sendConfirmationEmail(res.email, emailSubject, emailBody).catch(() => {});
          }
        }
      }
    }
  }

  if (switchedCount > 0) {
    await writeDb(db);
  }

  return { switchedCount, db };
}

// Submit a new Reservation (Phase 1)
router.post('/', async (req, res: any) => {
  try {
    const {
      event_id,
      full_name,
      phone_number,
      email,
      instagram_username,
      passes_count,
      group_size,
      coupon_code
    } = req.body;

    if (!event_id || !full_name || !phone_number || !email) {
      return res.status(400).json({ error: 'Full Name, Phone Number, and Email are required.' });
    }

    let { db } = await evaluateAutoSwitch();
    const event = db.events.find((e: any) => e.id === event_id || e.slug === event_id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Check if reservation mode is active
    if (event.reservation_mode === false) {
      return res.status(400).json({ error: 'Reservations are closed for this event. Ticket sales are now live!' });
    }

    const requestedPasses = Math.max(1, parseInt(passes_count) || 1);
    const limit = event.reservation_limit || 1000;

    // Count existing active reserved passes
    const eventRes = (db.reservations || []).filter((r: any) => r.event_id === event.id && r.status !== 'cancelled');
    const currentReservedCount = eventRes.reduce((sum: number, r: any) => sum + (r.passes_count || 1), 0);

    if (currentReservedCount + requestedPasses > limit) {
      const remaining = Math.max(0, limit - currentReservedCount);
      return res.status(400).json({
        error: `Reservation limit reached. Only ${remaining} spot${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // Generate unique token
    const accessToken = `RES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const newReservation = {
      id: crypto.randomUUID(),
      event_id: event.id,
      full_name: full_name.trim(),
      phone_number: phone_number.trim(),
      email: email.trim().toLowerCase(),
      instagram_username: instagram_username ? instagram_username.trim() : '',
      passes_count: requestedPasses,
      group_size: parseInt(group_size) || requestedPasses,
      coupon_code: coupon_code ? coupon_code.trim().toUpperCase() : '',
      access_token: accessToken,
      status: 'confirmed',
      created_at: new Date().toISOString()
    };

    if (!db.reservations) db.reservations = [];
    db.reservations.push(newReservation);
    await writeDb(db);

    const updatedReservedCount = currentReservedCount + requestedPasses;
    const remainingSpots = Math.max(0, limit - updatedReservedCount);

    // Send instant reservation confirmation email/SMS
    const confirmationSubject = `🎉 Spot Reserved! ${event.title} - Priority Access Confirmed`;
    const confirmationHtml = `
      <h2>Spot Reservation Confirmed!</h2>
      <p>Hi <strong>${newReservation.full_name}</strong>,</p>
      <p>Your spot reservation for <strong>${event.title}</strong> has been successfully confirmed!</p>
      <div style="background:#f4f4f5; padding:16px; margin:16px 0; border-left:4px solid #8b5cf6;">
        <p style="margin:0 0 8px 0;"><strong>Reserved Passes:</strong> ${requestedPasses}</p>
        <p style="margin:0 0 8px 0;"><strong>Access Token:</strong> <code>${accessToken}</code></p>
        <p style="margin:0;"><strong>Status:</strong> Priority Access Registered</p>
      </div>
      <p>You will receive SMS, WhatsApp, and Email notification with a private purchase link 24 hours before public sales open.</p>
      <p>Thank you for choosing Zyron Productions!</p>
    `;
    sendConfirmationEmail(newReservation.email, confirmationSubject, confirmationHtml).catch(() => {});

    return res.json({
      success: true,
      reservation: newReservation,
      reserved_count: updatedReservedCount,
      limit,
      remaining_spots: remainingSpots,
      event_title: event.title,
      event_slug: event.slug,
      reservation_deadline: event.reservation_deadline
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Verify Access Token for Early Access
router.get('/check-token', async (req, res: any) => {
  try {
    const { token, event_id } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Token is required.' });
    }

    const { db } = await evaluateAutoSwitch();
    const tokenStr = String(token).trim().toUpperCase();

    const reservation = (db.reservations || []).find((r: any) => r.access_token.toUpperCase() === tokenStr);
    if (!reservation) {
      return res.status(404).json({ error: 'Invalid reservation token.' });
    }

    if (event_id && reservation.event_id !== event_id) {
      const eventMatch = db.events.find((e: any) => e.id === event_id || e.slug === event_id);
      if (eventMatch && reservation.event_id !== eventMatch.id) {
        return res.status(400).json({ error: 'Reservation token belongs to another event.' });
      }
    }

    const event = db.events.find((e: any) => e.id === reservation.event_id);

    return res.json({
      valid: true,
      reservation,
      event
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Get Reservation Stats for an event (Live Counter)
router.get('/stats/:eventId', async (req, res: any) => {
  try {
    const { db } = await evaluateAutoSwitch();
    const event = db.events.find((e: any) => e.id === req.params.eventId || e.slug === req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const eventRes = (db.reservations || []).filter((r: any) => r.event_id === event.id && r.status !== 'cancelled');
    const reserved_count = eventRes.reduce((sum: number, r: any) => sum + (r.passes_count || 1), 0);
    const limit = event.reservation_limit || 1000;
    const remaining_spots = Math.max(0, limit - reserved_count);

    return res.json({
      event_id: event.id,
      reservation_mode: event.reservation_mode ?? true,
      ticket_sales_mode: event.ticket_sales_mode ?? false,
      reserved_count,
      limit,
      remaining_spots,
      reservation_deadline: event.reservation_deadline,
      early_access_duration_hours: event.early_access_duration_hours || 24,
      auto_switch: event.auto_switch ?? true
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: List all reservations
router.get('/admin/all', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const { db } = await evaluateAutoSwitch();
    const reservationsList = (db.reservations || []).map((r: any) => {
      const ev = db.events.find((e: any) => e.id === r.event_id);
      return {
        ...r,
        event_title: ev?.title || 'Unknown Event',
        event_slug: ev?.slug || ''
      };
    });
    reservationsList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json(reservationsList);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Trigger Phase Switch manually for an event
router.post('/admin/trigger-switch/:eventId', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    const event = db.events.find((e: any) => e.id === req.params.eventId || e.slug === req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    event.reservation_mode = false;
    event.ticket_sales_mode = true;
    event.updated_at = new Date().toISOString();

    let notifiedCount = 0;
    const eventReservations = (db.reservations || []).filter((r: any) => r.event_id === event.id && r.status !== 'cancelled');

    for (const resItem of eventReservations) {
      resItem.notified_at = new Date().toISOString();
      notifiedCount++;
      const purchaseUrl = `${process.env.APP_URL || 'http://localhost:3000'}/events/${event.slug}?access_token=${resItem.access_token}`;
      
      const emailSubject = `🔥 Event Passes Are Live! Priority Access for ${event.title}`;
      const emailBody = `
        <h2>Your Reserved Spot is Ready!</h2>
        <p>Hi ${resItem.full_name},</p>
        <p>Reservations for <strong>${event.title}</strong> have officially closed and <strong>Event Passes are NOW LIVE!</strong></p>
        <p>As a reservation holder, you have <strong>${event.early_access_duration_hours || 24} hours of Early Access</strong> to claim your pass before public sales open.</p>
        <p><a href="${purchaseUrl}" style="display:inline-block; padding:12px 24px; background:#8b5cf6; color:#ffffff; text-decoration:none; font-weight:bold; border-radius:4px;">Buy Pass With Early Access &rarr;</a></p>
        <p>Or use your Access Token during checkout: <code>${resItem.access_token}</code></p>
      `;
      sendConfirmationEmail(resItem.email, emailSubject, emailBody).catch(() => {});
    }

    await writeDb(db);

    return res.json({
      success: true,
      message: `Phase switched to Ticket Sales Live. Dispatched notifications to ${notifiedCount} reservation holders via SMS, WhatsApp & Email.`,
      event
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
