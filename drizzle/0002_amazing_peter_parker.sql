ALTER TABLE "bookings" ADD COLUMN "ticket_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "utr" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_proof_url" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ocr_detected_utr" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ocr_detected_amount" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "whatsapp_status" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reminder_sent_at" text;