const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldWriteDb = code.substring(code.indexOf('async function writeDb'), code.indexOf('// Ignore initDb'));

const newWriteDb = `async function writeDb(data: DbState) {
  // Safe UPSERT only - no global deletions to prevent concurrent data loss!
  
  // 3. INSERT/UPDATE events
  for (const ev of data.events) {
    const existing = await db.select().from(events).where(eq(events.id, ev.id));
    if (existing.length === 0) {
      await db.insert(events).values(ev);
    } else {
      await db.update(events).set(ev).where(eq(events.id, ev.id));
    }
  }
  
  // 4. INSERT/UPDATE bookings
  for (const b of data.bookings) {
    const existing = await db.select().from(bookings).where(eq(bookings.id, b.id));
    if (existing.length === 0) {
      await db.insert(bookings).values(b);
    } else {
      await db.update(bookings).set(b).where(eq(bookings.id, b.id));
    }
  }
  
  // 5. INSERT/UPDATE gallery
  for (const gi of data.gallery_items) {
    const existing = await db.select().from(galleryItems).where(eq(galleryItems.id, gi.id));
    if (existing.length === 0) {
      await db.insert(galleryItems).values(gi);
    } else {
      await db.update(galleryItems).set(gi).where(eq(galleryItems.id, gi.id));
    }
  }
}
`;
code = code.replace(oldWriteDb, newWriteDb);

// Now patch the 2 delete endpoints to manually delete from DB

// 1. Delete Gallery Item
const oldGalleryDelete = `app.delete('/api/admin/gallery/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db = await readDb();
    db.gallery_items = db.gallery_items.filter((item: any) => item.id !== req.params.id);
    await writeDb(db);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});`;
const newGalleryDelete = `app.delete('/api/admin/gallery/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    await db.delete(galleryItems).where(eq(galleryItems.id, req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});`;
code = code.replace(oldGalleryDelete, newGalleryDelete);

// 2. Delete Event
const oldEventDelete = `app.delete('/api/admin/events/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const db_obj = await readDb();
    const eventId = req.params.id;

    // Check if event has any active paid/pending bookings
    const activeBookings = db_obj.bookings.filter((b: any) => b.event_id === eventId && b.cancelled_at === null);
    if (activeBookings.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete event with active bookings. Please archive the event instead or cancel existing bookings first.'
      });
    }

    // Cascade delete gallery items or bookings which are cancelled
    db_obj.events = db_obj.events.filter((e: any) => e.id !== eventId);
    db_obj.bookings = db_obj.bookings.filter((b: any) => b.event_id !== eventId);
    db_obj.gallery_items = db_obj.gallery_items.filter((gi: any) => gi.event_id !== eventId);

    await writeDb(db_obj);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});`;

// Wait, I need to match the original delete event accurately.
// Since my regex replacements might have changed the code, I will use generic string replacement.
