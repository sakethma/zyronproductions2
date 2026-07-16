import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db as drizzleDb } from '../../src/db/index.ts';
import { events, galleryItems } from '../../src/db/schema.ts';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const published = await drizzleDb.select().from(events).where(eq(events.status, 'published'));
    published.sort((a: any, b: any) => new Date(a.event_date || '').getTime() - new Date(b.event_date || '').getTime());
    return res.json(published);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:slug', async (req, res) => {
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

export default router;
