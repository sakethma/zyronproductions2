const fs = require('fs');

let code = fs.readFileSync('server.ts.bak', 'utf-8');

const prefix = `
import { db } from './src/db/index.ts';
import { users, events, bookings, galleryItems, notifications } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from './src/middleware/auth.ts';

// Compatibility types
interface DbState {
  users: any[];
  events: any[];
  bookings: any[];
  gallery_items: any[];
  notifications: any[];
}

async function readDb(): Promise<DbState> {
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

async function writeDb(data: DbState) {
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

// Ignore initDb
async function initDb() {}
`;

// Extract before line 64 and after line 317
const lines = code.split('\n');
const before = lines.slice(0, 63).join('\n');
const after = lines.slice(317).join('\n');

// Wait! In the 'before' part, remove old imports if they conflict or just add imports
let finalCode = before + '\n' + prefix + '\n' + after;

// Replace `req: any` with `req: AuthRequest` in requireAuth/requireAdmin routes
finalCode = finalCode.replace(/requireAuth, async \(req: any, res/g, 'requireAuth, async (req: AuthRequest, res');
finalCode = finalCode.replace(/requireAdmin, async \(req: any, res/g, 'requireAdmin, async (req: AuthRequest, res');

// Same for standard routes where req type is missing
finalCode = finalCode.replace(/requireAuth, async \(req, res\)/g, 'requireAuth, async (req: AuthRequest, res: any)');
finalCode = finalCode.replace(/requireAdmin, async \(req, res\)/g, 'requireAdmin, async (req: AuthRequest, res: any)');


fs.writeFileSync('server.ts', finalCode);
