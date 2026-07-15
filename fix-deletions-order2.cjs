const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldWriteDb = code.substring(code.indexOf('async function writeDb'), code.indexOf('// Ignore initDb'));

const newWriteDb = `async function writeDb(data: DbState) {
  // 1. DELETE bookings & gallery
  const existingBookings = await db.select().from(bookings);
  const newBookingIds = data.bookings.map((b: any) => b.id);
  for (const b of existingBookings) {
    if (!newBookingIds.includes(b.id)) {
      await db.delete(bookings).where(eq(bookings.id, b.id));
    }
  }
  
  const existingGallery = await db.select().from(galleryItems);
  const newGalleryIds = data.gallery_items.map((g: any) => g.id);
  for (const gi of existingGallery) {
    if (!newGalleryIds.includes(gi.id)) {
      await db.delete(galleryItems).where(eq(galleryItems.id, gi.id));
    }
  }

  // 2. DELETE events
  const existingEvents = await db.select().from(events);
  const newEventIds = data.events.map((e: any) => e.id);
  for (const ev of existingEvents) {
    if (!newEventIds.includes(ev.id)) {
      await db.delete(events).where(eq(events.id, ev.id));
    }
  }

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
fs.writeFileSync('server.ts', code);
