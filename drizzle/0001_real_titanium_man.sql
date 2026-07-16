CREATE TABLE "coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"event_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_cents" integer;