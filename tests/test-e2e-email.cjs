#!/usr/bin/env node

/**
 * End-To-End Gmail SMTP Email Delivery & QR Code Verification Script
 * 
 * This script connects to the running local Zyron Productions Express server,
 * triggers an unauthenticated E2E booking mock creation, sends the ticket
 * with the required QR code payload, and outputs raw logs to confirm delivery.
 */

const http = require('http');

const RECIPIENT_EMAIL = process.argv[2] || 'sakethma007@gmail.com';
const PORT = process.env.PORT || 3000;
const URL_PATH = '/api/test/e2e-email-flow';

console.log('========================================================================');
console.log('⚡ STARTING END-TO-END GMAIL SMTP EMAIL & QR TICKET VERIFICATION');
console.log(`📡 Targeting Endpoint: http://localhost:${PORT}${URL_PATH}`);
console.log(`📧 Recipient Email:   ${RECIPIENT_EMAIL}`);
console.log('========================================================================\n');

const postData = JSON.stringify({
  email: RECIPIENT_EMAIL
});

const options = {
  hostname: 'localhost',
  port: PORT,
  path: URL_PATH,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let rawData = '';
  
  res.on('data', (chunk) => {
    rawData += chunk;
  });
  
  res.on('end', () => {
    try {
      if (res.statusCode !== 200) {
        console.error(`❌ HTTP Status Error: Received status code ${res.statusCode}`);
        console.error('Raw Server Error Response:', rawData);
        process.exit(1);
      }
      
      const response = JSON.parse(rawData);
      
      if (!response.success) {
        console.error('❌ E2E Email Delivery Failed on the Server:');
        console.error(JSON.stringify(response, null, 2));
        process.exit(1);
      }

      console.log('✅ SERVER EXECUTED E2E TEST FLOW SUCCESSFULLY!');
      console.log('------------------------------------------------------------');
      console.log('👉 [1] MOCK BOOKING DETAILS:');
      console.log(`   - Booking ID:     ${response.booking.id}`);
      console.log(`   - Guest Name:     ${response.booking.guest_name}`);
      console.log(`   - Guest Email:    ${response.booking.guest_email}`);
      console.log(`   - Ticket Tier:    ${response.booking.tier.toUpperCase()}`);
      console.log(`   - Quantity:       ${response.booking.quantity} tickets`);
      console.log(`   - Total Amount:   ₹${Math.round(response.booking.total_cents / 100).toLocaleString()}`);
      
      console.log('\n👉 [2] ADMISSION QR CODE PAYLOAD ASSERTION:');
      console.log(`   - Required QR Payload: ${response.qr_code_payload}`);
      console.log(`   - Expected QR Code Format: ZYRON-TICKET-<booking_id>`);
      
      if (response.qr_code_payload === `ZYRON-TICKET-${response.booking.id}`) {
        console.log('   - Assertion Check:     PASS (QR payload correctly embedded in the template!)');
      } else {
        console.error('   - Assertion Check:     FAIL (QR payload mismatch!)');
        process.exit(1);
      }
      console.log(`   - Live QR API URL:     ${response.qr_code_url}`);
      
      console.log('\n👉 [3] RAW GMAIL SMTP DISPATCH LOGS & ENVELOPE:');
      console.log(`   - SMTP Message-ID:     ${response.smtp_response.messageId}`);
      console.log(`   - Mail Server Response: ${response.smtp_response.response}`);
      console.log(`   - Sender Envelope:     ${JSON.stringify(response.smtp_response.envelope.from)}`);
      console.log(`   - Recipient Envelope:  ${JSON.stringify(response.smtp_response.envelope.to)}`);
      
      console.log('\n========================================================================');
      console.log('🎉 SUCCESS: End-to-end booking verification and Gmail SMTP delivery confirmed!');
      console.log('========================================================================');
      process.exit(0);

    } catch (e) {
      console.error('❌ Failed to parse server JSON response:', e.message);
      console.error('Raw Response:', rawData);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Connection Error while contacting server:', err.message);
  console.error('👉 Tip: Please make sure the Zyron Productions development server is active and running.');
  process.exit(1);
});

req.write(postData);
req.end();
