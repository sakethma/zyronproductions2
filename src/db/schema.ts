import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase UID or 'admin-uuid-1'
  email: text('email').notNull(),
  role: text('role').notNull().default('user'),
  password_hash: text('password_hash'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  teaser: text('teaser').notNull(),
  description: text('description').notNull(),
  event_date: text('event_date').notNull(),
  location: text('location').notNull(),
  image_url: text('image_url').notNull(),
  capacity: integer('capacity').notNull(),
  tickets_sold: integer('tickets_sold').notNull().default(0),
  general_price_cents: integer('general_price_cents').notNull(),
  vip_price_cents: integer('vip_price_cents').notNull(),
  group_price_cents: integer('group_price_cents').notNull(),
  earlybird_price_cents: integer('earlybird_price_cents').notNull(),
  couple_price_cents: integer('couple_price_cents').notNull(),
  status: text('status').notNull(),
  doors_open: text('doors_open'),
  reservation_mode: boolean('reservation_mode').notNull().default(true),
  ticket_sales_mode: boolean('ticket_sales_mode').notNull().default(false),
  reservation_limit: integer('reservation_limit').notNull().default(1000),
  reservation_deadline: text('reservation_deadline'),
  early_access_duration_hours: integer('early_access_duration_hours').notNull().default(24),
  auto_switch: boolean('auto_switch').notNull().default(true),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const reservations = pgTable('reservations', {
  id: text('id').primaryKey(),
  event_id: text('event_id').notNull().references(() => events.id),
  full_name: text('full_name').notNull(),
  phone_number: text('phone_number').notNull(),
  email: text('email').notNull(),
  instagram_username: text('instagram_username'),
  passes_count: integer('passes_count').notNull().default(1),
  group_size: integer('group_size').notNull().default(1),
  coupon_code: text('coupon_code'),
  access_token: text('access_token').notNull().unique(),
  status: text('status').notNull().default('confirmed'),
  notified_at: text('notified_at'),
  created_at: text('created_at').notNull(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.uid),
  event_id: text('event_id').notNull().references(() => events.id),
  tier: text('tier').notNull(),
  quantity: integer('quantity').notNull(),
  guest_name: text('guest_name').notNull(),
  guest_email: text('guest_email').notNull(),
  guest_phone: text('guest_phone'),
  guest_instagram: text('guest_instagram'),
  total_cents: integer('total_cents').notNull(),
  payment_status: text('payment_status').notNull(),
  payment_provider_ref: text('payment_provider_ref'),
  ticket_id: text('ticket_id'),
  utr: text('utr'),
  payment_proof_url: text('payment_proof_url'),
  ocr_detected_utr: text('ocr_detected_utr'),
  ocr_detected_amount: integer('ocr_detected_amount'),
  rejection_reason: text('rejection_reason'),
  whatsapp_status: text('whatsapp_status'),
  reminder_sent: boolean('reminder_sent').notNull().default(false),
  reminder_sent_at: text('reminder_sent_at'),
  dietary: text('dietary'),
  role_preference: text('role_preference'),
  accessibility: text('accessibility'),
  cancelled_at: text('cancelled_at'),
  checked_in: boolean('checked_in').notNull().default(false),
  checked_in_at: text('checked_in_at'),
  coupon_code: text('coupon_code'),
  discount_cents: integer('discount_cents'),
  additional_guests: text('additional_guests'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});

export const galleryItems = pgTable('gallery_items', {
  id: text('id').primaryKey(),
  image_url: text('image_url').notNull(),
  caption: text('caption'),
  event_id: text('event_id').references(() => events.id),
  sort_order: integer('sort_order').notNull(),
  created_at: text('created_at').notNull(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.uid),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  created_at: text('created_at').notNull(),
});

export const coupons = pgTable('coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  discount_type: text('discount_type').notNull(), // 'percentage' | 'fixed'
  discount_value: integer('discount_value').notNull(), // percent value or absolute cents value
  max_uses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  event_id: text('event_id'), // optional event constraint
  active: boolean('active').notNull().default(true),
  created_at: text('created_at').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  notifications: many(notifications)
}));

export const eventsRelations = relations(events, ({ many }) => ({
  bookings: many(bookings),
  galleryItems: many(galleryItems),
  reservations: many(reservations)
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  event: one(events, {
    fields: [reservations.event_id],
    references: [events.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.user_id],
    references: [users.uid],
  }),
  event: one(events, {
    fields: [bookings.event_id],
    references: [events.id],
  }),
}));
