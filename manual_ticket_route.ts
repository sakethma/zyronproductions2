import fs from 'fs';

const file = 'server/routes/admin.ts';
let code = fs.readFileSync(file, 'utf-8');

const routeStr = `
// Manual Ticket Generator Endpoint
router.post('/bookings/manual', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const { event_id, guest_name, guest_email, guest_phone, tier, quantity, send_email } = req.body;
    
    if (!event_id || !guest_name || !guest_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const [event] = await drizzleDb.select().from(events).where(eq(events.id, event_id)).limit(1);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const bookingId = crypto.randomUUID();
    const ticketId = 'TK' + Math.floor(1000 + Math.random() * 9000);

    const [newBooking] = await drizzleDb.insert(bookings).values({
      id: bookingId,
      user_id: req.user?.uid || 'admin-manual',
      event_id,
      tier: tier || 'general',
      quantity: parseInt(quantity) || 1,
      guest_name,
      guest_email,
      guest_phone: guest_phone || '',
      total_cents: 0,
      payment_status: 'completed',
      payment_provider_ref: 'MANUAL_GENERATED',
      ticket_id: ticketId,
      utr: 'MANUAL_GENERATED',
      checked_in: false,
    }).returning();

    if (send_email) {
      try {
        await sendConfirmationEmail(newBooking, event);
      } catch (e) {
        console.error('Failed to send confirmation email for manual booking:', e);
      }
    }

    return res.json({ success: true, booking: newBooking });
  } catch (err: any) {
    console.error('Manual booking error:', err);
    return res.status(500).json({ error: err.message });
  }
});
`;

if (!code.includes('/bookings/manual')) {
  // insert before the end of file (export default router)
  code = code.replace('export default router;', routeStr + '\nexport default router;');
  fs.writeFileSync(file, code);
  console.log('Inserted route');
} else {
  console.log('Route already exists');
}
