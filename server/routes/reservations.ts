import { Router } from 'express';
import crypto from 'crypto';
import { eq, or, sql, inArray } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { reservations } from '../../src/db/schema.ts';
import { readDb, writeDb, DbState } from '../services/db.ts';
import { sendWhatsAppConfirmation } from '../services/whatsapp.ts';
import { sendConfirmationEmail, sendMail } from '../services/email.ts';
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
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                        <tr>
                          <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                            <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                            <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Live Electronic Music & Modular Installations</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 24px 28px 12px 28px; text-align: center;">
                            <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                              🚨 TICKETS NOW LIVE
                            </div>
                            <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                              Priority Access is ACTIVE!
                            </h1>
                            <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                              Reservations for <strong style="color: #e4e4e7;">${event.title}</strong> have officially closed and <strong>Event Passes are NOW LIVE!</strong>
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 16px 28px;">
                            <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                              <tr>
                                <td>
                                  <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                                    Your Exclusive Window
                                  </div>
                                  <p style="margin: 14px 0 0 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                                    As a reservation holder, you have <strong>Priority Access</strong> to claim your pass.
                                  </p>
                                  <div style="margin-top: 16px; padding: 12px; background-color: #09090b; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center;">
                                    <span style="font-family: monospace; font-size: 10px; color: #71717a; display: block; margin-bottom: 4px;">ACCESS TOKEN</span>
                                    <strong style="font-family: monospace; font-size: 16px; color: #c084fc; letter-spacing: 2px;">${res.access_token}</strong>
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 28px 28px 28px; text-align: center;">
                            <a href="${purchaseUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 12px; font-family: monospace; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45); transition: all 0.2s ease;">
                              CLAIM YOUR PASS NOW &rarr;
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
            sendMail({ to: res.email, subject: emailSubject, html: emailBody }).catch(() => {});
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                <tr>
                  <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                    <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                    <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Priority Access System</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 28px 12px 28px; text-align: center;">
                    <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                      ✓ Spot Reserved Successfully
                    </div>
                    <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                      Hi ${newReservation.full_name},
                    </h1>
                    <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                      Your pre-sale spot reservation for <strong style="color: #e4e4e7;">${event.title}</strong> has been confirmed.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 28px;">
                    <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                      <tr>
                        <td>
                          <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                            Reservation Details
                          </div>
                          <table role="presentation" width="100%" style="margin-top: 14px; font-size: 13px; line-height: 1.8;">
                            <tr>
                              <td style="color: #71717a; font-family: monospace; width: 40%;">PRIORITY TOKEN:</td>
                              <td style="color: #c084fc; font-family: monospace; font-weight: 800; font-size: 16px; letter-spacing: 1px;">${accessToken}</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">RESERVED PASSES:</td>
                              <td style="color: #f4f4f5; font-family: monospace; font-weight: 700;">${requestedPasses} Pass(es)</td>
                            </tr>
                            <tr>
                              <td style="color: #71717a; font-family: monospace;">EVENT LOCATION:</td>
                              <td style="color: #a1a1aa;">${event.location}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 28px 24px 28px; text-align: center;">
                    <p style="margin: 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                      You will receive an automated email &amp; WhatsApp message as soon as ticket sales go live, giving you <strong style="color: #c084fc;">Priority Access</strong> to claim your pass!
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
    sendMail({ to: newReservation.email, subject: confirmationSubject, html: confirmationHtml }).catch((err) => {
      console.error('Reservation confirmation email error:', err);
    });

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

// User endpoint: List active spot reservations for logged-in or provided email
router.get('/my', async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    let userEmail = '';

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split('Bearer ')[1];
        const jwt = (await import('jsonwebtoken')).default;
        const { getJwtSecret } = await import('../middleware/auth.ts');
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        userEmail = decoded.email?.toLowerCase().trim() || '';
      } catch (e) {
        // Invalid token
      }
    }

    if (!userEmail && req.query.email) {
      userEmail = String(req.query.email).toLowerCase().trim();
    }

    if (!userEmail) {
      return res.json([]);
    }

    const myReservations = (db.reservations || [])
      .filter((r: any) => r.email && r.email.toLowerCase().trim() === userEmail)
      .map((r: any) => {
        const ev = (db.events || []).find((e: any) => e.id === r.event_id);
        return {
          ...r,
          event_title: ev?.title || 'Unknown Event',
          event_image: ev?.image_url || '',
          event_slug: ev?.slug || '',
          event_date: ev?.event_date || '',
          event_location: ev?.location || ''
        };
      });

    myReservations.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return res.json(myReservations);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Delete single reservation
router.delete('/admin/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  const reqTime = new Date().toISOString();
  const resId = String(req.params.id || '').trim().toLowerCase();
  const userId = req.user?.uid || req.user?.id || 'Unknown/Admin';
  const payload = { params: req.params, body: req.body, query: req.query };

  console.log(`[DELETE_RESERVATION_PAYLOAD][ADMIN] Time: ${reqTime} | User ID: ${userId} | Target ID: "${resId}" | Payload:`, JSON.stringify(payload));

  try {
    const db = await readDb();
    const initialLen = (db.reservations || []).length;

    const matchedReservation = (db.reservations || []).find(
      (r: any) =>
        String(r.id || '').trim().toLowerCase() === resId ||
        String(r.access_token || '').trim().toLowerCase() === resId
    );

    if (matchedReservation) {
      console.log(`[DELETE_RESERVATION_MATCH][ADMIN] Target found in-memory DB: ID=${matchedReservation.id}, Email=${matchedReservation.email}, Token=${matchedReservation.access_token}`);
    } else {
      console.warn(`[DELETE_RESERVATION_WARN][ADMIN] Target "${resId}" not found in in-memory DB array (Length: ${initialLen})`);
    }

    db.reservations = (db.reservations || []).filter(
      (r: any) =>
        String(r.id || '').trim().toLowerCase() !== resId &&
        String(r.access_token || '').trim().toLowerCase() !== resId
    );

    let drizzleResult = null;
    try {
      drizzleResult = await drizzleDb.delete(reservations).where(
        or(
          sql`LOWER(${reservations.id}) = ${resId}`,
          sql`LOWER(${reservations.access_token}) = ${resId}`
        )
      );
      console.log(`[DELETE_RESERVATION_DRIZZLE][ADMIN] Drizzle DB delete query executed successfully for target "${resId}"`);
    } catch (dbErr: any) {
      console.error(`[DELETE_RESERVATION_DRIZZLE_ERROR][ADMIN] Drizzle DB delete failed for target "${resId}":`, dbErr?.message || dbErr);
    }

    if (db.reservations.length === initialLen) {
      console.warn(`[DELETE_RESERVATION_PARTIAL][ADMIN] Reservation "${resId}" not present in JSON array. Processed DB query anyway.`);
      await writeDb(db);
      return res.json({ success: true, message: 'Reservation processed for deletion.' });
    }

    await writeDb(db);
    console.log(`[DELETE_RESERVATION_SUCCESS][ADMIN] Reservation "${resId}" successfully removed from DB and memory. Remaining count: ${db.reservations.length}`);
    return res.json({ success: true, message: 'Reservation deleted successfully.' });
  } catch (err: any) {
    console.error(`[DELETE_RESERVATION_FAIL][ADMIN] Error deleting reservation "${resId}":`, err?.stack || err?.message || err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Batch delete selected reservations
router.post('/admin/batch-delete', requireAdmin, async (req: AuthRequest, res: any) => {
  const reqTime = new Date().toISOString();
  const userId = req.user?.uid || req.user?.id || 'Unknown/Admin';
  const { ids } = req.body || {};
  const payload = { params: req.params, body: req.body, query: req.query };

  console.log(`[BATCH_DELETE_RESERVATION_PAYLOAD][ADMIN] Time: ${reqTime} | User ID: ${userId} | Payload:`, JSON.stringify(payload));

  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      console.warn(`[BATCH_DELETE_RESERVATION_INVALID] Received empty or non-array 'ids' parameter.`);
      return res.status(400).json({ error: 'Array of reservation IDs is required.' });
    }

    const db = await readDb();
    const lowerIdSet = new Set(ids.map((id: any) => String(id).trim().toLowerCase()));
    const initialLen = (db.reservations || []).length;

    console.log(`[BATCH_DELETE_RESERVATION_TARGETS] Unique normalized target IDs (${lowerIdSet.size}):`, Array.from(lowerIdSet));

    db.reservations = (db.reservations || []).filter(
      (r: any) =>
        !lowerIdSet.has(String(r.id || '').trim().toLowerCase()) &&
        !lowerIdSet.has(String(r.access_token || '').trim().toLowerCase())
    );
    const deletedCount = initialLen - db.reservations.length;

    try {
      const idArray = Array.from(lowerIdSet);
      if (idArray.length > 0) {
        for (const targetId of idArray) {
          await drizzleDb.delete(reservations).where(
            or(
              sql`LOWER(${reservations.id}) = ${targetId}`,
              sql`LOWER(${reservations.access_token}) = ${targetId}`
            )
          );
        }
        console.log(`[BATCH_DELETE_RESERVATION_DRIZZLE] Drizzle DB batch delete completed for ${idArray.length} items.`);
      }
    } catch (dbErr: any) {
      console.error('[BATCH_DELETE_RESERVATION_DRIZZLE_ERROR] Drizzle batch delete warning:', dbErr?.message || dbErr);
    }

    await writeDb(db);
    console.log(`[BATCH_DELETE_RESERVATION_SUCCESS] Successfully deleted ${deletedCount} reservation(s) from memory DB. Remaining total: ${db.reservations.length}`);
    return res.json({ success: true, deletedCount, message: `Successfully deleted ${deletedCount} reservation(s).` });
  } catch (err: any) {
    console.error('[BATCH_DELETE_RESERVATION_FAIL] Error during batch delete:', err?.stack || err?.message || err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Resend confirmation or priority access email for a single reservation
router.post('/admin/resend-email/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  const targetId = String(req.params.id || '').trim().toLowerCase();
  try {
    const db = await readDb();
    const reservation = (db.reservations || []).find(
      (r: any) =>
        String(r.id || '').trim().toLowerCase() === targetId ||
        String(r.access_token || '').trim().toLowerCase() === targetId
    );

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation record not found.' });
    }

    const event = (db.events || []).find((e: any) => e.id === reservation.event_id);
    if (!event) {
      return res.status(404).json({ error: 'Associated event not found.' });
    }

    let emailSubject = '';
    let emailBody = '';

    if (event.reservation_mode) {
      // Phase 1 Style: Spot Reserved
      emailSubject = `🎉 Spot Reserved! ${event.title} - Priority Access Confirmed`;
      emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                  <tr>
                    <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                      <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                      <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Priority Access System</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 28px 12px 28px; text-align: center;">
                      <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                        ✓ Spot Reserved Successfully
                      </div>
                      <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                        Hi ${reservation.full_name},
                      </h1>
                      <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                        Your pre-sale spot reservation for <strong style="color: #e4e4e7;">${event.title}</strong> has been confirmed.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 28px;">
                      <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                        <tr>
                          <td>
                            <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                              Reservation Details
                            </div>
                            <table role="presentation" width="100%" style="margin-top: 14px; font-size: 13px; line-height: 1.8;">
                              <tr>
                                <td style="color: #71717a; font-family: monospace; width: 40%;">PRIORITY TOKEN:</td>
                                <td style="color: #c084fc; font-family: monospace; font-weight: 800; font-size: 16px; letter-spacing: 1px;">${reservation.access_token}</td>
                              </tr>
                              <tr>
                                <td style="color: #71717a; font-family: monospace;">RESERVED PASSES:</td>
                                <td style="color: #f4f4f5; font-family: monospace; font-weight: 700;">${reservation.passes_count} Pass(es)</td>
                              </tr>
                              <tr>
                                <td style="color: #71717a; font-family: monospace;">EVENT LOCATION:</td>
                                <td style="color: #a1a1aa;">${event.location}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 28px 24px 28px; text-align: center;">
                      <p style="margin: 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                        You will receive an automated email &amp; WhatsApp message as soon as ticket sales go live, giving you <strong style="color: #c084fc;">Priority Access</strong> to claim your pass!
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
    } else {
      // Phase 2 Style: Priority Access Now Live
      const purchaseUrl = `${process.env.APP_URL || 'http://localhost:3000'}/events/${event.slug}?access_token=${reservation.access_token}`;
      emailSubject = `🔥 Event Passes Are Live! Priority Access for ${event.title}`;
      emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                  <tr>
                    <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                      <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                      <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Live Electronic Music & Modular Installations</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 28px 12px 28px; text-align: center;">
                      <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                        🚨 TICKETS NOW LIVE
                      </div>
                      <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                        Priority Access is ACTIVE!
                      </h1>
                      <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                        Reservations for <strong style="color: #e4e4e7;">${event.title}</strong> have officially closed and <strong>Event Passes are NOW LIVE!</strong>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 28px;">
                      <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                        <tr>
                          <td>
                            <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                              Your Exclusive Window
                            </div>
                            <p style="margin: 14px 0 0 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                              As a reservation holder, you have <strong>Priority Access</strong> to claim your pass.
                            </p>
                            <div style="margin-top: 16px; padding: 12px; background-color: #09090b; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center;">
                              <span style="font-family: monospace; font-size: 10px; color: #71717a; display: block; margin-bottom: 4px;">ACCESS TOKEN</span>
                              <strong style="font-family: monospace; font-size: 16px; color: #c084fc; letter-spacing: 2px;">${reservation.access_token}</strong>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 28px 28px 28px; text-align: center;">
                      <a href="${purchaseUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 12px; font-family: monospace; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45); transition: all 0.2s ease;">
                        CLAIM YOUR PASS NOW &rarr;
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
    }

    const emailRes = await sendMail({
      to: reservation.email,
      subject: emailSubject,
      html: emailBody
    });

    if (!emailRes.success) {
      return res.status(500).json({ error: emailRes.error || 'Failed to dispatch email via SMTP service.' });
    }

    // Mark as notified if this was a passes live resend
    if (!event.reservation_mode && !reservation.notified_at) {
      reservation.notified_at = new Date().toISOString();
      await writeDb(db);
    }

    return res.json({ success: true, message: `Successfully resent notification email to ${reservation.email}` });
  } catch (err: any) {
    console.error(`[ADMIN_RESEND_EMAIL_FAIL] Error:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Explicitly switch reservation phase and notify unnotified reservation holders
router.post('/admin/trigger-switch/:eventId', requireAdmin, async (req: AuthRequest, res: any) => {
  const eventId = String(req.params.eventId || '').trim();
  try {
    const db = await readDb();
    const event = (db.events || []).find((e: any) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Move to Phase 2: Ticket sales live
    event.reservation_mode = false;
    event.ticket_sales_mode = true;
    event.updated_at = new Date().toISOString();

    const eventReservations = (db.reservations || []).filter(
      (r: any) => r.event_id === event.id && r.status !== 'cancelled'
    );

    let sentCount = 0;
    for (const r of eventReservations) {
      if (!r.notified_at) {
        r.notified_at = new Date().toISOString();
        const purchaseUrl = `${process.env.APP_URL || 'http://localhost:3000'}/events/${event.slug}?access_token=${r.access_token}`;
        
        const emailSubject = `🔥 Event Passes Are Live! Priority Access for ${event.title}`;
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                    <tr>
                      <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                        <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                        <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Live Electronic Music & Modular Installations</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px 28px 12px 28px; text-align: center;">
                        <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                          🚨 TICKETS NOW LIVE
                        </div>
                        <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                          Priority Access is ACTIVE!
                        </h1>
                        <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                          Pre-sales for <strong style="color: #e4e4e7;">${event.title}</strong> have opened and <strong>Event Passes are NOW LIVE!</strong>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 16px 28px;">
                        <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                          <tr>
                            <td>
                              <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                                Your Exclusive Window
                              </div>
                              <p style="margin: 14px 0 0 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                                As a reservation holder, you have <strong>Priority Access</strong> to claim your pass.
                              </p>
                              <div style="margin-top: 16px; padding: 12px; background-color: #09090b; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center;">
                                <span style="font-family: monospace; font-size: 10px; color: #71717a; display: block; margin-bottom: 4px;">ACCESS TOKEN</span>
                                <strong style="font-family: monospace; font-size: 16px; color: #c084fc; letter-spacing: 2px;">${r.access_token}</strong>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 28px 28px 28px; text-align: center;">
                        <a href="${purchaseUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 12px; font-family: monospace; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45); transition: all 0.2s ease;">
                          CLAIM YOUR PASS NOW &rarr;
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
        
        sendMail({ to: r.email, subject: emailSubject, html: emailBody }).catch((err) => {
          console.error(`[TRIGGER_SWITCH_EMAIL_ERR] Failed to send to ${r.email}:`, err);
        });
        sentCount++;
      }
    }

    await writeDb(db);
    return res.json({
      success: true,
      message: `Successfully transitioned event to Phase 2. Priority access notifications sent to ${sentCount} un-notified reservation holder(s).`
    });
  } catch (err: any) {
    console.error(`[ADMIN_TRIGGER_SWITCH_FAIL] Error:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: Send bulk "Passes Live" emails explicitly to all active reservation holders
router.post('/admin/send-passes-live-bulk', requireAdmin, async (req: AuthRequest, res: any) => {
  const { eventId, forceResend } = req.body || {};
  if (!eventId) {
    return res.status(400).json({ error: 'An event ID is required for bulk dispatcher.' });
  }

  try {
    const db = await readDb();
    const event = (db.events || []).find((e: any) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ error: 'Target event not found.' });
    }

    // Move to Phase 2 if not already there, representing that reservations are over & passes are live
    let updatedPhase = false;
    if (event.reservation_mode || !event.ticket_sales_mode) {
      event.reservation_mode = false;
      event.ticket_sales_mode = true;
      event.updated_at = new Date().toISOString();
      updatedPhase = true;
    }

    // Filter reservations for this event that are active
    const eventReservations = (db.reservations || []).filter(
      (r: any) => r.event_id === event.id && r.status !== 'cancelled'
    );

    if (eventReservations.length === 0) {
      if (updatedPhase) await writeDb(db);
      return res.json({
        success: true,
        count: 0,
        message: 'No reservations found to notify, but ticket sales mode has been activated successfully.'
      });
    }

    let sentCount = 0;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
    const appUrl = `${protocol}://${host}`;

    for (const r of eventReservations) {
      if (forceResend || !r.notified_at) {
        r.notified_at = new Date().toISOString();
        const purchaseUrl = `${appUrl}/events/${event.slug}?access_token=${r.access_token}`;
        
        const emailSubject = `🔥 Event Passes Are Live! Priority Access for ${event.title}`;
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; -webkit-font-smoothing: antialiased;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #09090b; padding: 32px 16px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" style="max-width: 580px; background-color: #121215; border: 1px solid #27272a; border-top: 3px solid #a855f7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);">
                    <tr>
                      <td style="padding: 32px 28px 20px 28px; text-align: center; background-color: #0d0d10; border-bottom: 1px solid #1f1f23;">
                        <div style="font-family: monospace; font-size: 20px; font-weight: 800; color: #c084fc; letter-spacing: 4px; text-transform: uppercase;">ZYRON PRODUCTIONS</div>
                        <div style="font-family: monospace; font-size: 10px; color: #71717a; letter-spacing: 2px; margin-top: 6px; text-transform: uppercase;">Live Electronic Music & Modular Installations</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px 28px 12px 28px; text-align: center;">
                        <div style="display: inline-block; background-color: #2e1065; color: #d8b4fe; border: 1px solid #7e22ce; padding: 6px 16px; border-radius: 9999px; font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px;">
                          🚨 TICKETS NOW LIVE
                        </div>
                        <h1 style="margin: 0 0 10px 0; color: #ffffff; font-size: 22px; font-weight: 700; font-family: Georgia, serif; line-height: 1.3;">
                          Priority Access is ACTIVE!
                        </h1>
                        <p style="margin: 0; color: #a1a1aa; font-size: 14px; line-height: 1.5;">
                          Pre-sales for <strong style="color: #e4e4e7;">${event.title}</strong> have opened and <strong>Event Passes are NOW LIVE!</strong>
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 16px 28px;">
                        <table role="presentation" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px;">
                          <tr>
                            <td>
                              <div style="font-family: monospace; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 12px; border-bottom: 1px solid #27272a; font-weight: 700;">
                                Your Exclusive Window
                              </div>
                              <p style="margin: 14px 0 0 0; color: #d4d4d8; font-size: 13px; line-height: 1.6;">
                                As a reservation holder, you have <strong>Priority Access</strong> to claim your pass.
                              </p>
                              <div style="margin-top: 16px; padding: 12px; background-color: #09090b; border: 1px dashed #3f3f46; border-radius: 6px; text-align: center;">
                                <span style="font-family: monospace; font-size: 10px; color: #71717a; display: block; margin-bottom: 4px;">ACCESS TOKEN</span>
                                <strong style="font-family: monospace; font-size: 16px; color: #c084fc; letter-spacing: 2px;">${r.access_token}</strong>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 28px 28px 28px; text-align: center;">
                        <a href="${purchaseUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%); color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 800; font-size: 12px; font-family: monospace; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 18px rgba(124, 58, 237, 0.45); transition: all 0.2s ease;">
                          CLAIM YOUR PASS NOW &rarr;
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px 28px; background-color: #0d0d10; border-top: 1px solid #1f1f23; text-align: center;">
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
        
        sendMail({ to: r.email, subject: emailSubject, html: emailBody }).catch((err) => {
          console.error(`[BULK_EMAIL_DISPATCH_ERR] Failed to send to ${r.email}:`, err);
        });
        sentCount++;
      }
    }

    await writeDb(db);
    return res.json({
      success: true,
      count: sentCount,
      message: `Bulk notification dispatch initiated. Sent "Passes Live" emails to ${sentCount} reservation holder(s) for "${event.title}".`
    });
  } catch (err: any) {
    console.error(`[ADMIN_SEND_PASSES_LIVE_BULK_FAIL] Error:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// User endpoint: Delete / Cancel single spot reservation
router.delete('/:id', async (req: AuthRequest, res: any) => {
  const reqTime = new Date().toISOString();
  const resId = String(req.params.id || '').trim().toLowerCase();
  const userId = req.user?.uid || req.user?.id || 'Guest/Anonymous';
  const payload = { params: req.params, body: req.body, query: req.query };

  console.log(`[DELETE_RESERVATION_PAYLOAD][USER] Time: ${reqTime} | User ID: ${userId} | Target ID/Token: "${resId}" | Payload:`, JSON.stringify(payload));

  try {
    const db = await readDb();
    const initialLen = (db.reservations || []).length;

    const matchedReservation = (db.reservations || []).find(
      (r: any) =>
        String(r.id || '').trim().toLowerCase() === resId ||
        String(r.access_token || '').trim().toLowerCase() === resId
    );

    if (matchedReservation) {
      console.log(`[DELETE_RESERVATION_MATCH][USER] Target found: ID=${matchedReservation.id}, Email=${matchedReservation.email}, EventID=${matchedReservation.event_id}`);
    } else {
      console.warn(`[DELETE_RESERVATION_NOT_FOUND][USER] Target "${resId}" not found in memory DB (Total records: ${initialLen})`);
    }

    db.reservations = (db.reservations || []).filter(
      (r: any) =>
        String(r.id || '').trim().toLowerCase() !== resId &&
        String(r.access_token || '').trim().toLowerCase() !== resId
    );

    try {
      await drizzleDb.delete(reservations).where(
        or(
          sql`LOWER(${reservations.id}) = ${resId}`,
          sql`LOWER(${reservations.access_token}) = ${resId}`
        )
      );
      console.log(`[DELETE_RESERVATION_DRIZZLE][USER] Drizzle DB user delete query executed for "${resId}"`);
    } catch (dbErr: any) {
      console.error(`[DELETE_RESERVATION_DRIZZLE_ERROR][USER] Drizzle user delete error for "${resId}":`, dbErr?.message || dbErr);
    }

    if (db.reservations.length === initialLen) {
      console.warn(`[DELETE_RESERVATION_404][USER] Spot reservation record not found for "${resId}". Returning 404.`);
      return res.status(404).json({ error: 'Spot reservation record not found.' });
    }

    await writeDb(db);
    console.log(`[DELETE_RESERVATION_SUCCESS][USER] Reservation "${resId}" cancelled and deleted successfully.`);
    return res.json({ success: true, message: 'Spot reservation successfully cancelled and deleted.' });
  } catch (err: any) {
    console.error(`[DELETE_RESERVATION_FAIL][USER] Error processing user cancellation for "${resId}":`, err?.stack || err?.message || err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
