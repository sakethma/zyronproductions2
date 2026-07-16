CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"tier" text NOT NULL,
	"quantity" integer NOT NULL,
	"guest_name" text NOT NULL,
	"guest_email" text NOT NULL,
	"guest_phone" text,
	"guest_instagram" text,
	"total_cents" integer NOT NULL,
	"payment_status" text NOT NULL,
	"payment_provider_ref" text,
	"dietary" text,
	"role_preference" text,
	"accessibility" text,
	"cancelled_at" text,
	"checked_in" boolean DEFAULT false NOT NULL,
	"checked_in_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"teaser" text NOT NULL,
	"description" text NOT NULL,
	"event_date" text NOT NULL,
	"location" text NOT NULL,
	"image_url" text NOT NULL,
	"capacity" integer NOT NULL,
	"tickets_sold" integer DEFAULT 0 NOT NULL,
	"general_price_cents" integer NOT NULL,
	"vip_price_cents" integer NOT NULL,
	"group_price_cents" integer NOT NULL,
	"earlybird_price_cents" integer NOT NULL,
	"couple_price_cents" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"event_id" text,
	"sort_order" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"password_hash" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_uid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_uid_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uid") ON DELETE no action ON UPDATE no action;