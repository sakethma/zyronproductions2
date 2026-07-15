import re

with open('server.ts.bak', 'r') as f:
    content = f.read()

# Replace readDb and writeDb definitions
new_db_helpers = """
import { db } from './src/db/index.ts';
import { users, events, bookings, galleryItems, notifications } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';

async function readDb() {
  const usersList = await db.select().from(users);
  const eventsList = await db.select().from(events);
  const bookingsList = await db.select().from(bookings);
  const galleryList = await db.select().from(galleryItems);
  const notificationsList = await db.select().from(notifications);
  
  return {
    users: usersList.map(u => ({ ...u, id: u.uid })),
    events: eventsList,
    bookings: bookingsList,
    gallery_items: galleryList,
    notifications: notificationsList
  };
}

async function writeDb(data: any) {
  // Sync events
  for (const ev of data.events) {
    const existing = await db.select().from(events).where(eq(events.id, ev.id));
    if (existing.length === 0) {
      await db.insert(events).values(ev);
    } else {
      await db.update(events).set(ev).where(eq(events.id, ev.id));
    }
  }
  
  // Sync bookings
  for (const b of data.bookings) {
    const existing = await db.select().from(bookings).where(eq(bookings.id, b.id));
    if (existing.length === 0) {
      await db.insert(bookings).values(b);
    } else {
      await db.update(bookings).set(b).where(eq(bookings.id, b.id));
    }
  }
  
  // Sync gallery
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
"""

# Replace initDb, readDb, writeDb, Auth Middleware
content = re.sub(r'async function initDb\(\).*?// Auth Middleware', new_db_helpers + '\n// Auth Middleware', content, flags=re.DOTALL)

# Remove the old Auth Middleware since we have it in src/middleware/auth.ts
content = re.sub(r'async function getAuthUser.*?async function requireAdmin.*?}', '', content, flags=re.DOTALL)

# Replace (req: any, res: any) with (req: AuthRequest, res) for requireAuth routes
content = content.replace('req: any, res', 'req: AuthRequest, res')

with open('server.ts', 'w') as f:
    f.write(content)
