import re

with open('server.ts', 'r') as f:
    content = f.read()

# Replace Gallery Delete
gallery_delete_pattern = r"app\.delete\('/api/admin/gallery/:id', requireAdmin, async \(req: AuthRequest, res: any\) => \{.*?return res\.json\(\{ success: true \}\);\n\s*\} catch \(err: any\) \{.*?\}\);"
new_gallery_delete = """app.delete('/api/admin/gallery/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    await db.delete(galleryItems).where(eq(galleryItems.id, req.params.id));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});"""
content = re.sub(gallery_delete_pattern, new_gallery_delete, content, flags=re.DOTALL)

# Replace Event Delete
event_delete_pattern = r"app\.delete\('/api/admin/events/:id', requireAdmin, async \(req: AuthRequest, res: any\) => \{.*?return res\.json\(\{ success: true \}\);\n\s*\} catch \(err: any\) \{.*?\}\);"
new_event_delete = """app.delete('/api/admin/events/:id', requireAdmin, async (req: AuthRequest, res: any) => {
  try {
    const eventId = req.params.id;
    // Check if event has any active paid/pending bookings
    const activeBookings = await db.select().from(bookings).where(and(eq(bookings.event_id, eventId), eq(bookings.cancelled_at, null)));
    if (activeBookings.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete event with active bookings. Please archive the event instead or cancel existing bookings first.'
      });
    }

    await db.delete(galleryItems).where(eq(galleryItems.event_id, eventId));
    await db.delete(bookings).where(eq(bookings.event_id, eventId));
    await db.delete(events).where(eq(events.id, eventId));

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});"""
content = re.sub(event_delete_pattern, new_event_delete, content, flags=re.DOTALL)

with open('server.ts', 'w') as f:
    f.write(content)
