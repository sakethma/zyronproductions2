import { db } from './src/db/index.js';
import { bookings, users } from './src/db/schema.js';

const data = [
  {"Booking ID":"79459435-1795-4b85-8bd8-c0371ceec2c1","Ticket ID":"TK1252","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Varun Sandesh","Guest Email":"sandeshvarun730@gmail.com","Guest Phone":"9666967775","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1007.16","UTR / Payment Ref":"UPI_MANUAL_TK1252","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"21/8/2026, 11:44:30 am"},
  {"Booking ID":"f1cf5e82-10d2-4644-a15d-fb08d89ee7fa","Ticket ID":"TK1514","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Abhinay","Guest Email":"gattupallyabhi@gmail.com","Guest Phone":"+91 95027 87999","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1199.00","UTR / Payment Ref":"123456789","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"21/8/2026, 7:10:23 am"},
  {"Booking ID":"51f855c2-020f-429d-ae5b-f2d18fe1cca3","Ticket ID":"TK2977","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Yoga","Guest Email":"ysrishmi@gmail.com","Guest Phone":"7013820549","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK2977","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:49:19 pm"},
  {"Booking ID":"9957f59b-90c3-496c-996a-86eb7d3c8b09","Ticket ID":"TK2407","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Akarsh Sharma","Guest Email":"akarsh9521@gmail.com","Guest Phone":"7799868800","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1199.00","UTR / Payment Ref":"623496586739","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"22/8/2026, 8:41:49 pm"},
  {"Booking ID":"63057503-c1ad-4f09-b356-e9efef531799","Ticket ID":"TK8496","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Suhas d","Guest Email":"suhasdandge9999@gmail.com","Guest Phone":"+918019493737","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1199.00","UTR / Payment Ref":"622051953683","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"8/8/2026, 10:29:51 pm"},
  {"Booking ID":"a6a6b722-23f8-4618-bb38-7e212eb5fd63","Ticket ID":"TK3058","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Jaswanth Ebeneazer","Guest Email":"akarsh9521@gmail.com","Guest Phone":"7799868800","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1199.00","UTR / Payment Ref":"128345338030","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"22/8/2026, 8:46:23 pm"},
  {"Booking ID":"aebdf3de-baa5-461d-93b3-283e28e96e5f","Ticket ID":"TK3398","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Sumaira","Guest Email":"summiqueen26@gmail.com","Guest Phone":"7661849940","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1175.16","UTR / Payment Ref":"UPI_MANUAL_TK3398","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"4/9/2026, 8:28:57 pm"},
  {"Booking ID":"369094de-b252-41e3-93a1-7345cf2557b3","Ticket ID":"TK3464","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Nishanth","Guest Email":"ysrishmi@gmail.com","Guest Phone":"8978289463","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK3464","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:48:40 pm"},
  {"Booking ID":"6baedcf4-7e78-4836-87de-0bcca906e654","Ticket ID":"TK4530","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Abhinav","Guest Email":"akarsh9521@gmail.com","Guest Phone":"7799868800","Ticket Tier":"earlybird","Quantity":"1","Total Price (INR)":"1199.00","UTR / Payment Ref":"128447788985","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"24/8/2026, 8:10:19 pm"},
  {"Booking ID":"63e0bbbf-ef57-4a0a-aac5-ee9b77d565c7","Ticket ID":"TK8552","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Tanmay","Guest Email":"ysrishmi@gmail.com","Guest Phone":"9701426763","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK8552","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:49:37 pm"},
  {"Booking ID":"52a15ebe-e5e9-4049-ae35-b5d8c8f172bf","Ticket ID":"TK9829","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Srishmi","Guest Email":"ysrishmi@gmail.com","Guest Phone":"7842659595","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK9829","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:48:16 pm"},
  {"Booking ID":"0453c22d-5ab8-4727-b4c2-80126228d9fe","Ticket ID":"TK3669","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Pranavi","Guest Email":"ysrishmi@gmail.com","Guest Phone":"90351 33104","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK3669","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:50:17 pm"},
  {"Booking ID":"39504981-bcd6-4a86-b79c-a7f9af857645","Ticket ID":"TK4005","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Samuel","Guest Email":"ysrishmi@gmail.com","Guest Phone":"77939 34434","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK4005","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:48:58 pm"},
  {"Booking ID":"7204603a-54a7-4230-98f2-5f7def97af10","Ticket ID":"TK8505","Event ID":"e0614b73-065f-4496-80b6-b6a529da4f23","Event Title":"Third Dimension","Guest Name":"Tejashwini","Guest Email":"ysrishmi@gmail.com","Guest Phone":"90351 33104","Ticket Tier":"general","Quantity":"1","Total Price (INR)":"1203.14","UTR / Payment Ref":"UPI_MANUAL_TK8505","Checked In":"NO","Entry Timestamp":"Not Checked In","Booking Date":"6/9/2026, 8:49:54 pm"}
];

async function run() {
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

  console.log('Inserting new bookings from JSON...');
  for (const record of data) {
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
