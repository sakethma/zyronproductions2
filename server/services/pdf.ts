import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export async function generateTicketPdfBuffer(booking: any, event: any): Promise<Buffer> {
  const ticketId = booking.ticket_id || booking.id.substring(0, 8).toUpperCase();
  const bookingRef = booking.id.split('-')[0].toUpperCase();
  
  // Generate QR Code as Data Buffer (PNG)
  const qrData = `ZYRON-TICKET-${booking.id}`;

  const qrImageBuffer = await QRCode.toBuffer(qrData, {
    width: 300,
    margin: 1,
    color: {
      dark: '#171717',
      light: '#ffffff'
    }
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [600, 850],
      margin: 0
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // Dark Background Header
    doc.rect(0, 0, 600, 160).fill('#09090b');

    // Title & Branding
    doc.fillColor('#a855f7').fontSize(24).font('Helvetica-Bold').text('ZYRON PRODUCTIONS', 40, 35);
    doc.fillColor('#71717a').fontSize(10).font('Helvetica').text('OFFICIAL VIP ADMISSION PASS', 40, 65);

    // Event Title
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text(event.title.toUpperCase(), 40, 95, { width: 520 });

    // Main Card Box
    doc.rect(40, 190, 520, 600).lineWidth(1).strokeColor('#e4e4e7').fillAndStroke('#ffffff', '#e4e4e7');

    // Section 1: Ticket & Guest Information
    doc.fillColor('#09090b').fontSize(12).font('Helvetica-Bold').text('GUEST ADMISSION DETAILS', 60, 215);

    doc.moveTo(60, 235).lineTo(540, 235).strokeColor('#f4f4f5').stroke();

    // Key-Value Grid
    let currentY = 250;

    const addRow = (label: string, value: string, highlight = false) => {
      doc.fillColor('#71717a').fontSize(9).font('Helvetica-Bold').text(label.toUpperCase(), 60, currentY);
      doc.fillColor(highlight ? '#7c3aed' : '#09090b')
         .fontSize(highlight ? 13 : 11)
         .font(highlight ? 'Helvetica-Bold' : 'Helvetica')
         .text(value, 200, currentY, { width: 340 });
      currentY += 28;
    };

    addRow('TICKET ID', ticketId, true);
    addRow('BOOKING REF', bookingRef);
    if (booking.utr) {
      addRow('PAYMENT UTR', booking.utr);
    }
    addRow('GUEST NAME', booking.guest_name);
    addRow('GUEST EMAIL', booking.guest_email);
    addRow('GUEST PHONE', booking.guest_phone || 'N/A');
    addRow('PASS TIER', `${booking.quantity}x ${booking.tier.toUpperCase()}`);
    addRow('EVENT DATE', event.event_date || 'TBA');
    addRow('LOCATION', event.location || 'Secret Coordinates');

    currentY += 15;
    doc.moveTo(60, currentY).lineTo(540, currentY).strokeColor('#e4e4e7').stroke();

    // Section 2: QR Code Entry Scanner
    currentY += 25;
    doc.fillColor('#09090b').fontSize(11).font('Helvetica-Bold').text('VENUE ENTRY QR CODE', 60, currentY, { align: 'center', width: 480 });

    currentY += 20;
    doc.image(qrImageBuffer, 210, currentY, { width: 180, height: 180 });

    currentY += 190;
    doc.fillColor('#71717a').fontSize(8).font('Helvetica').text('Present this QR code at the venue gate for instant ticket validation & check-in.', 60, currentY, { align: 'center', width: 480 });

    // Footer
    doc.rect(0, 810, 600, 40).fill('#09090b');
    doc.fillColor('#a1a1aa').fontSize(8).font('Helvetica').text('Zyron Productions © 2026 • Non-transferable admission token • www.zyronproduction.work.gd', 40, 825, { align: 'center', width: 520 });

    doc.end();
  });
}
