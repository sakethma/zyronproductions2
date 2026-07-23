/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppRole = 'admin' | 'user';
export type EventStatus = 'draft' | 'published' | 'archived';
export type TicketTier = 'general' | 'vip' | 'group' | 'earlybird' | 'couple';
export type PaymentStatus = 'pending' | 'pending_verification' | 'paid' | 'failed' | 'refunded';

export interface Event {
  id: string;
  title: string;
  slug: string;
  teaser: string;
  description: string;
  event_date: string; // ISO String
  location: string;
  image_url: string;
  capacity: number;
  tickets_sold: number;
  general_price_cents: number;
  vip_price_cents: number;
  group_price_cents: number;
  earlybird_price_cents: number;
  couple_price_cents: number;
  status: EventStatus;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  user_id: string;
  event_id: string;
  tier: TicketTier;
  quantity: number;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  guest_instagram?: string;
  total_cents: number;
  payment_status: PaymentStatus;
  payment_provider_ref?: string;
  ticket_id?: string;
  utr?: string;
  payment_proof_url?: string;
  ocr_detected_utr?: string;
  ocr_detected_amount?: number;
  rejection_reason?: string;
  whatsapp_status?: string;
  is_duplicate_utr?: boolean;
  dietary?: string;
  role_preference?: string;
  accessibility?: string;
  cancelled_at?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  created_at: string;
  updated_at: string;
  
  // Joined for ease of display on frontend
  event_title?: string;
  event_slug?: string;
  event_date?: string;
  event_location?: string;
  event_image_url?: string;
}

export interface GalleryItem {
  id: string;
  image_url: string;
  caption?: string;
  event_id?: string;
  sort_order: number;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

export interface AdminAnalytics {
  totalRevenueCents: number;
  paidBookingsCount: number;
  ticketsSold: number;
  totalCapacity: number;
  tierBreakdown: {
    general: number;
    vip: number;
    group: number;
    earlybird: number;
    couple: number;
  };
  repeatBuyerRate: number; // percentage (0 to 100)
  eventStats: Array<{
    id: string;
    title: string;
    event_date: string;
    tickets_sold: number;
    capacity: number;
    revenueCents: number;
  }>;
}
