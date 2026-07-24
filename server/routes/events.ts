import { Router } from 'express';
import { readDb } from '../services/db.ts';
import { evaluateAutoSwitch } from './reservations.ts';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { db } = await evaluateAutoSwitch();
    const published = db.events.filter((e: any) => e.status === 'published');
    
    // Attach reserved_count for each event
    const reservationsList = db.reservations || [];
    const enriched = published.map((ev: any) => {
      const evRes = reservationsList.filter((r: any) => r.event_id === ev.id && r.status !== 'cancelled');
      const reserved_count = evRes.reduce((sum: number, r: any) => sum + (r.passes_count || 1), 0);
      return {
        ...ev,
        reserved_count,
        reservation_mode: ev.reservation_mode ?? true,
        ticket_sales_mode: ev.ticket_sales_mode ?? false,
        reservation_limit: ev.reservation_limit ?? 1000,
        early_access_duration_hours: ev.early_access_duration_hours ?? 24,
        auto_switch: ev.auto_switch ?? true
      };
    });

    enriched.sort((a: any, b: any) => new Date(a.event_date || '').getTime() - new Date(b.event_date || '').getTime());
    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { db } = await evaluateAutoSwitch();
    const event = db.events.find((e: any) => e.slug === req.params.slug || e.id === req.params.slug);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const reservationsList = db.reservations || [];
    const evRes = reservationsList.filter((r: any) => r.event_id === event.id && r.status !== 'cancelled');
    const reserved_count = evRes.reduce((sum: number, r: any) => sum + (r.passes_count || 1), 0);

    const enriched = {
      ...event,
      reserved_count,
      reservation_mode: event.reservation_mode ?? true,
      ticket_sales_mode: event.ticket_sales_mode ?? false,
      reservation_limit: event.reservation_limit ?? 1000,
      early_access_duration_hours: event.early_access_duration_hours ?? 24,
      auto_switch: event.auto_switch ?? true
    };

    return res.json(enriched);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
