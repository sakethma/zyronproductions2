import { db } from './src/db/index.ts';
import { users, events, bookings, galleryItems, notifications, coupons, reservations } from './src/db/schema.ts';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const dbPath = path.join(process.cwd(), 'data', 'db.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  
  if (data.users && data.users.length > 0) {
    console.log('Migrating users:', data.users.length);
    for (const user of data.users) {
      await db.insert(users).values({
        id: undefined, // serial
        uid: user.uid,
        email: user.email,
        role: user.role,
        password_hash: user.password_hash,
      }).onConflictDoNothing();
    }
  }

  if (data.events && data.events.length > 0) {
    console.log('Migrating events:', data.events.length);
    for (const ev of data.events) {
      await db.insert(events).values(ev).onConflictDoNothing();
    }
  }

  if (data.reservations && data.reservations.length > 0) {
    console.log('Migrating reservations:', data.reservations.length);
    for (const res of data.reservations) {
      await db.insert(reservations).values(res).onConflictDoNothing();
    }
  }

  if (data.bookings && data.bookings.length > 0) {
    console.log('Migrating bookings:', data.bookings.length);
    for (const bk of data.bookings) {
      await db.insert(bookings).values(bk).onConflictDoNothing();
    }
  }

  if (data.gallery_items && data.gallery_items.length > 0) {
    console.log('Migrating gallery items:', data.gallery_items.length);
    for (const gi of data.gallery_items) {
      await db.insert(galleryItems).values(gi).onConflictDoNothing();
    }
  }

  if (data.notifications && data.notifications.length > 0) {
    console.log('Migrating notifications:', data.notifications.length);
    for (const notif of data.notifications) {
      await db.insert(notifications).values(notif).onConflictDoNothing();
    }
  }

  if (data.coupons && data.coupons.length > 0) {
    console.log('Migrating coupons:', data.coupons.length);
    for (const coupon of data.coupons) {
      await db.insert(coupons).values(coupon).onConflictDoNothing();
    }
  }

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(console.error);
