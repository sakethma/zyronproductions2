import { db } from './src/db/index.js';
import { bookings, users } from './src/db/schema.js';
import fs from 'fs';

async function run() {
  console.log('Reading CSV...');
  const fileContent = fs.readFileSync('bookings_upload.csv', 'utf8');
  const lines = fileContent.trim().split('\n');
  const headers = lines[0].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(h => h.replace(/^"|"$/g, '')) || [];
  
  const records = lines.slice(1).map(line => {
    // Regex to split by comma, respecting quotes
    const values = line.match(/(".*?"|[^",]*)(?=\s*,|\s*$)/g) || [];
    const record: any = {};
    headers.forEach((h, i) => {
      record[h] = values[i] ? values[i].replace(/^"|"$/g, '') : '';
    });
    return record;
  });

  console.log(`Found ${records.length} records in CSV.`);

  // 1. Ensure we have an admin or a fallback user
  let fallbackUser = await db.select().from(users).limit(1);
  let userId = 'admin-uuid-1';
  if (fallbackUser.length === 0) {
    console.log('No users found. Creating fallback user...');
    await db.insert(users).values({
      uid: userId,
      email: 'admin@zyron.in',
      role: 'admin',
    });
  } else {
    userId = fallbackUser[0].uid;
  }

  console.log('Clearing existing bookings (test data)...');
  await db.delete(bookings);

  console.log('Inserting new bookings from CSV...');
  for (const record of records) {
    if (!record['Booking ID']) continue;
    
    const totalCents = Math.round(parseFloat(record['Total Price (INR)']) * 100);
    
    // Parse date (e.g. 21/8/2026, 11:44:30 am -> assumes DD/MM/YYYY)
    let createdAt = new Date().toISOString();
    try {
      const parts = record['Booking Date'].split(', ');
      if (parts.length === 2) {
        const [d, m, y] = parts[0].split('/');
        const timeParts = parts[1].split(' ');
        const [hh, mm, ss] = timeParts[0].split(':');
        let hour = parseInt(hh, 10);
        if (timeParts[1].toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (timeParts[1].toLowerCase() === 'am' && hour === 12) hour = 0;
        
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), hour, parseInt(mm), parseInt(ss));
        createdAt = dateObj.toISOString();
      }
    } catch (e) {
      console.error('Date parse error for', record['Booking Date']);
    }

    const checkInAt = record['Entry Timestamp'] === 'Not Checked In' ? null : record['Entry Timestamp'];
    const isCheckedIn = record['Checked In']?.toUpperCase() === 'YES';

    await db.insert(bookings).values({
      id: record['Booking ID'],
      user_id: userId,
      event_id: record['Event ID'],
      tier: record['Ticket Tier'],
      quantity: parseInt(record['Quantity'] || '1', 10),
      guest_name: record['Guest Name'],
      guest_email: record['Guest Email'],
      guest_phone: record['Guest Phone'],
      total_cents: totalCents,
      payment_status: 'completed', // Assume completed if in this CSV
      payment_provider_ref: record['UTR / Payment Ref'],
      ticket_id: record['Ticket ID'],
      utr: record['UTR / Payment Ref'],
      checked_in: isCheckedIn,
      checked_in_at: checkInAt,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  console.log('Successfully imported bookings!');
  process.exit(0);
}

run().catch(console.error);
