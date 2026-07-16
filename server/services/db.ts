import fs from 'fs/promises';
import path from 'path';
import { db as drizzleDb } from '../../src/db/index.ts';
import { users, events, bookings, galleryItems, notifications } from '../../src/db/schema.ts';
import { eq, desc, and, isNull, notInArray, sql } from 'drizzle-orm';

export interface DbState {
  users: any[];
  events: any[];
  bookings: any[];
  gallery_items: any[];
  notifications: any[];
}

export async function readDb(): Promise<DbState> {
  const usersList = await drizzleDb.select().from(users);
  const eventsList = await drizzleDb.select().from(events);
  const bookingsList = await drizzleDb.select().from(bookings);
  const galleryList = await drizzleDb.select().from(galleryItems);
  const notificationsList = await drizzleDb.select().from(notifications);
  
  return {
    users: usersList.map(u => ({ ...u, id: u.uid })),
    events: eventsList,
    bookings: bookingsList,
    gallery_items: galleryList,
    notifications: notificationsList
  };
}

export async function writeDb(data: DbState) {
  const hasSql = !!process.env.SQL_HOST || !!process.env.DATABASE_URL;
  if (!hasSql) {
    const DB_DIR = path.join(process.cwd(), 'data');
    const DB_PATH = path.join(DB_DIR, 'db.json');
    const usersForJson = data.users.map((u: any) => {
      const { id, ...rest } = u;
      return { ...rest, uid: u.uid || id };
    });
    const notificationsForJson = data.notifications.map((n: any) => {
      const isReadVal = n.read !== undefined ? n.read : (n.is_read !== undefined ? n.is_read : false);
      return {
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        read: isReadVal,
        created_at: n.created_at
      };
    });
    const jsonData = {
      users: usersForJson,
      events: data.events,
      bookings: data.bookings,
      gallery_items: data.gallery_items,
      notifications: notificationsForJson
    };
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(jsonData, null, 2), 'utf-8');
    return;
  }

  // Drizzle Transactions for batch operations & performance!
  await drizzleDb.transaction(async (tx) => {
    // 1. DELETE bookings & gallery in batch
    const newBookingIds = data.bookings.map((b: any) => b.id);
    if (newBookingIds.length > 0) {
      await tx.delete(bookings).where(notInArray(bookings.id, newBookingIds));
    } else {
      await tx.delete(bookings);
    }

    const newGalleryIds = data.gallery_items.map((g: any) => g.id);
    if (newGalleryIds.length > 0) {
      await tx.delete(galleryItems).where(notInArray(galleryItems.id, newGalleryIds));
    } else {
      await tx.delete(galleryItems);
    }

    // 2. DELETE events in batch
    const newEventIds = data.events.map((e: any) => e.id);
    if (newEventIds.length > 0) {
      await tx.delete(events).where(notInArray(events.id, newEventIds));
    } else {
      await tx.delete(events);
    }

    // 3. DELETE notifications in batch
    const newNotifIds = data.notifications.map((n: any) => n.id);
    if (newNotifIds.length > 0) {
      await tx.delete(notifications).where(notInArray(notifications.id, newNotifIds));
    } else {
      await tx.delete(notifications);
    }

    // 4. Batch UPSERT events
    if (data.events.length > 0) {
      await tx.insert(events)
        .values(data.events)
        .onConflictDoUpdate({
          target: events.id,
          set: {
            title: sql`EXCLUDED.title`,
            slug: sql`EXCLUDED.slug`,
            teaser: sql`EXCLUDED.teaser`,
            description: sql`EXCLUDED.description`,
            event_date: sql`EXCLUDED.event_date`,
            location: sql`EXCLUDED.location`,
            image_url: sql`EXCLUDED.image_url`,
            capacity: sql`EXCLUDED.capacity`,
            tickets_sold: sql`EXCLUDED.tickets_sold`,
            general_price_cents: sql`EXCLUDED.general_price_cents`,
            vip_price_cents: sql`EXCLUDED.vip_price_cents`,
            group_price_cents: sql`EXCLUDED.group_price_cents`,
            earlybird_price_cents: sql`EXCLUDED.earlybird_price_cents`,
            couple_price_cents: sql`EXCLUDED.couple_price_cents`,
            status: sql`EXCLUDED.status`,
            updated_at: sql`EXCLUDED.updated_at`
          }
        });
    }

    // 5. Batch UPSERT bookings
    if (data.bookings.length > 0) {
      await tx.insert(bookings)
        .values(data.bookings)
        .onConflictDoUpdate({
          target: bookings.id,
          set: {
            user_id: sql`EXCLUDED.user_id`,
            event_id: sql`EXCLUDED.event_id`,
            tier: sql`EXCLUDED.tier`,
            quantity: sql`EXCLUDED.quantity`,
            guest_name: sql`EXCLUDED.guest_name`,
            guest_email: sql`EXCLUDED.guest_email`,
            guest_phone: sql`EXCLUDED.guest_phone`,
            guest_instagram: sql`EXCLUDED.guest_instagram`,
            total_cents: sql`EXCLUDED.total_cents`,
            payment_status: sql`EXCLUDED.payment_status`,
            payment_provider_ref: sql`EXCLUDED.payment_provider_ref`,
            dietary: sql`EXCLUDED.dietary`,
            role_preference: sql`EXCLUDED.role_preference`,
            accessibility: sql`EXCLUDED.accessibility`,
            checked_in: sql`EXCLUDED.checked_in`,
            checked_in_at: sql`EXCLUDED.checked_in_at`,
            cancelled_at: sql`EXCLUDED.cancelled_at`,
            updated_at: sql`EXCLUDED.updated_at`
          }
        });
    }

    // 6. Batch UPSERT gallery items
    if (data.gallery_items.length > 0) {
      await tx.insert(galleryItems)
        .values(data.gallery_items)
        .onConflictDoUpdate({
          target: galleryItems.id,
          set: {
            image_url: sql`EXCLUDED.image_url`,
            caption: sql`EXCLUDED.caption`,
            event_id: sql`EXCLUDED.event_id`,
            sort_order: sql`EXCLUDED.sort_order`
          }
        });
    }

    // 7. Batch UPSERT notifications
    if (data.notifications.length > 0) {
      const notificationsWithMappedRead = data.notifications.map((n: any) => {
        const isReadVal = n.read !== undefined ? n.read : (n.is_read !== undefined ? n.is_read : false);
        return {
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          read: isReadVal,
          created_at: n.created_at
        };
      });
      await tx.insert(notifications)
        .values(notificationsWithMappedRead)
        .onConflictDoUpdate({
          target: notifications.id,
          set: {
            user_id: sql`EXCLUDED.user_id`,
            title: sql`EXCLUDED.title`,
            message: sql`EXCLUDED.message`,
            read: sql`EXCLUDED.read`
          }
        });
    }
  });
}
