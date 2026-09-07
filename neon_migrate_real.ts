import { Pool } from 'pg';
import { db } from './src/db/index.ts';
import { users, events, bookings, galleryItems, notifications, coupons, reservations } from './src/db/schema.ts';

const neonUrl = 'postgresql://neondb_owner:npg_K9lt5sqfFrnH@ep-purple-salad-atdftdz2-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const cleanData = (obj: any) => {
  const out = { ...obj };
  for (const key in out) {
    if (out[key] instanceof Date) {
      out[key] = out[key].toISOString();
    }
  }
  return out;
};

async function run() {
  console.log('Connecting to Neon...');
  const neonPool = new Pool({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });
  
  console.log('Clearing local CloudSQL mock data to prevent conflicts...');
  await db.delete(notifications);
  await db.delete(bookings);
  await db.delete(galleryItems);
  await db.delete(reservations);
  await db.delete(coupons);
  await db.delete(events);
  await db.delete(users);
  
  console.log('Fetching Neon data...');
  
  const tables = [
    { name: 'users', model: users },
    { name: 'events', model: events },
    { name: 'coupons', model: coupons },
    { name: 'reservations', model: reservations },
    { name: 'bookings', model: bookings },
    { name: 'gallery_items', model: galleryItems },
    { name: 'notifications', model: notifications }
  ];

  for (const t of tables) {
    try {
      const rows = (await neonPool.query(`SELECT * FROM ${t.name}`)).rows;
      console.log(`Found ${rows.length} records in Neon for ${t.name}`);
      
      let successCount = 0;
      for (const row of rows) {
        const cleaned = cleanData(row);
        if (t.name === 'users') {
           delete cleaned.id; // avoid sequence clashes
        }
        try {
          await db.insert(t.model).values(cleaned);
          successCount++;
        } catch (err) {
           console.error(`Failed to insert ${t.name} row (id: ${cleaned.id || cleaned.uid}):`, err.message);
        }
      }
      console.log(`Successfully imported ${successCount} records into ${t.name}`);
    } catch (e) {
      console.error(`Error processing table ${t.name}:`, e.message);
    }
  }

  console.log('Migration Complete!');
  process.exit(0);
}
run().catch(console.error);
