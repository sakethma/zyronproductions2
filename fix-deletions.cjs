const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newWriteDb = `
async function writeDb(data: DbState) {
  // 1. Sync events
  const existingEvents = await db.select().from(events);
  const newEventIds = data.events.map((e: any) => e.id);
  for (const ev of existingEvents) {
    if (!newEventIds.includes(ev.id)) {
      await db.delete(events).where(eq(events.id, ev.id));
    }
  }
  for (const ev of data.events) {
    const existing = await db.select().from(events).where(eq(events.id, ev.id));
    if (existing.length === 0) {
      await db.insert(events).values(ev);
    } else {
      await db.update(events).set(ev).where(eq(events.id, ev.id));
    }
  }
  
  // 2. Sync bookings
  const existingBookings = await db.select().from(bookings);
  const newBookingIds = data.bookings.map((b: any) => b.id);
  for (const b of existingBookings) {
    if (!newBookingIds.includes(b.id)) {
      await db.delete(bookings).where(eq(bookings.id, b.id));
    }
  }
  for (const b of data.bookings) {
    const existing = await db.select().from(bookings).where(eq(bookings.id, b.id));
    if (existing.length === 0) {
      await db.insert(bookings).values(b);
    } else {
      await db.update(bookings).set(b).where(eq(bookings.id, b.id));
    }
  }
  
  // 3. Sync gallery
  const existingGallery = await db.select().from(galleryItems);
  const newGalleryIds = data.gallery_items.map((g: any) => g.id);
  
  for (const gi of existingGallery) {
    if (!newGalleryIds.includes(gi.id)) {
      await db.delete(galleryItems).where(eq(galleryItems.id, gi.id));
    }
  }
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

// Extract old writeDb
const startIdx = code.indexOf('async function writeDb');
const endIdx = code.indexOf('// Ignore initDb');
const oldWriteDb = code.substring(startIdx, endIdx);

code = code.replace(oldWriteDb, newWriteDb);
fs.writeFileSync('server.ts', code);
