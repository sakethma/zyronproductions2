/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, Ticket, ShieldCheck, AlertCircle, Users, ArrowLeft } from 'lucide-react';
import { Event, TicketTier, User } from '../types';
import { apiFetch } from '../lib/api';

interface EventDetailProps {
  slug: string;
  user: User | null;
  onBook: (bookingData: {
    event_id: string;
    tier: TicketTier;
    quantity: number;
    guest_name: string;
    guest_email: string;
    guest_phone?: string;
    guest_instagram?: string;
  }) => Promise<any>;
  setCurrentRoute: (route: string) => void;
  events: Event[];
  refetchEvents: () => void;
}

export default function EventDetail({
  slug,
  user,
  onBook,
  setCurrentRoute,
  events,
  refetchEvents,
}: EventDetailProps) {
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<TicketTier>('general');
  const [quantity, setQuantity] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [razorpayConfig, setRazorpayConfig] = useState<{configured: boolean, key_id: string | null}>({configured: false, key_id: null});

  // Guest Details Form State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestInstagram, setGuestInstagram] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  useEffect(() => {
    apiFetch('/api/config/razorpay').then(r => r.json()).then(data => {
      setRazorpayConfig(data);
    }).catch(() => {});
  }, []);

  // Reset pre-fill flag when moving to a different event
  useEffect(() => {
    setHasPrefilled(false);
  }, [slug]);

  // Find the event in the list or refetch
  useEffect(() => {
    const found = events.find((e) => e.slug === slug);
    if (found) {
      setEvent(found);
      setIsLoading(false);
    } else {
      // Direct API fetch if refreshed
      apiFetch(`/api/events/${slug}`)
        .then((res) => {
          if (!res.ok) throw new Error('Event not found');
          return res.json();
        })
        .then((data) => {
          setEvent(data);
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    }
  }, [slug, events]);

  // Restore guest form values from localStorage if returning from redirect
  useEffect(() => {
    if (event && !hasPrefilled) {
      const saved = localStorage.getItem(`pending_booking_${event.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSelectedTier(parsed.tier || 'general');
          setQuantity(parsed.quantity || 1);
          setGuestName(parsed.guest_name || '');
          setGuestEmail(parsed.guest_email || '');
          setGuestPhone(parsed.guest_phone || '');
          // Remove to avoid stales
          localStorage.removeItem(`pending_booking_${event.id}`);
          setHasPrefilled(true);
        } catch (_) {}
      } else if (user) {
        // Pre-fill user info if signed in
        setGuestEmail(user.email);
        setGuestName(user.email.split('@')[0]);
        setHasPrefilled(true);
      }
    }
  }, [event, user, hasPrefilled]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl py-24 px-4 text-center">
        <div className="h-10 w-48 bg-neutral-100 dark:bg-neutral-900 mx-auto animate-pulse mb-8"></div>
        <div className="h-64 bg-neutral-100 dark:bg-neutral-900 animate-pulse mb-8"></div>
        <div className="h-6 w-full bg-neutral-100 dark:bg-neutral-900 animate-pulse"></div>
      </div>
    );
  }

  if (!event || event.status !== 'published') {
    return (
      <div className="mx-auto max-w-2xl py-24 px-4 text-center">
        <AlertCircle className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-white mb-2">Event Not Found</h2>
        <p className="text-sm text-neutral-500 mb-6 font-light">The experience you are looking for may have been archived or is private.</p>
        <button
          id="back-to-events-error"
          onClick={() => setCurrentRoute('/events')}
          className="border border-neutral-900 dark:border-white px-6 py-2.5 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
        >
          Back to Events
        </button>
      </div>
    );
  }

  const remainingTickets = event.capacity - event.tickets_sold;
  const isSoldOut = remainingTickets <= 0;

  // Active tiers filter
  const tiers = [
    { key: 'earlybird' as TicketTier, name: 'Earlybird Pass', price: event.earlybird_price_cents, desc: 'Limited availability early entry pass at a reduced rate.' },
    { key: 'general' as TicketTier, name: 'General Entry', price: event.general_price_cents, desc: 'Standard access to the main ballroom, visual lounges, and ambient experience rooms.' },
    { key: 'couple' as TicketTier, name: 'Couple Pass', price: event.couple_price_cents, desc: 'Discounted entry for two individuals to enjoy the experience together.' },
    { key: 'vip' as TicketTier, name: 'VIP Pass', price: event.vip_price_cents, desc: 'Priority queue, exclusive balcony access, curated masterclass gifting, and complimentary signature cocktails.' },
    { key: 'group' as TicketTier, name: 'Group Entry (6 Pax)', price: event.group_price_cents, desc: 'Shared VIP private seating suite for 6 attendees, complete with private host service and custom visual pairing.' },
  ].filter((t) => t.price > 0);

  const selectedTierData = tiers.find((t) => t.key === selectedTier) || tiers[0];
  const totalCents = selectedTierData ? selectedTierData.price * quantity : 0;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!guestName.trim() || !guestEmail.trim() || !guestPhone.trim() || !guestInstagram.trim()) {
      setErrorMsg('Full Name, Email Address, Phone Number, and Instagram Handle are required.');
      return;
    }

    if (!termsAccepted) {
      setErrorMsg('You must accept the terms and conditions to proceed.');
      return;
    }

    if (!user) {
      // Save form state to localStorage first
      const pendingData = {
        tier: selectedTier,
        quantity,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        guest_instagram: guestInstagram.trim(),
      };
      localStorage.setItem(`pending_booking_${event.id}`, JSON.stringify(pendingData));
      
      // Redirect to login
      setCurrentRoute(`/auth?redirect=/events/${slug}`);
      return;
    }

    setSubmitting(true);
    try {
      const booking = await onBook({
        event_id: event.id,
        tier: selectedTier,
        quantity,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim(),
        guest_instagram: guestInstagram.trim(),
      });

      // Refetch events so tickets_sold goes up
      refetchEvents();
      
      if (!razorpayConfig.configured || !razorpayConfig.key_id) {
        // Dev bypass for testing when Razorpay is not configured
        const bypassRes = await apiFetch(`/api/bookings/${booking.id}/dev-bypass`, { method: 'POST' });
        if (bypassRes.ok) {
           setCurrentRoute(`/booking-success?bookingId=${booking.id}`);
        } else {
           setErrorMsg('Payment gateway is not configured and dev bypass failed.');
           setSubmitting(false);
        }
        return;
      }

      const res = await loadRazorpayScript();
      if (!res) {
        setErrorMsg('Failed to load Razorpay SDK. Check your connection.');
        setSubmitting(false);
        return;
      }

      const orderData = await apiFetch(`/api/bookings/${booking.id}/razorpay-order`, { method: 'POST' }).then(r => r.json());
      if (orderData.error) {
        setErrorMsg(orderData.error);
        setSubmitting(false);
        return;
      }

      const options = {
        key: razorpayConfig.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Zyron Productions",
        description: `Booking for ${event.title}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            const verifyRes = await apiFetch(`/api/bookings/${booking.id}/verify-razorpay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              setCurrentRoute(`/booking-success?bookingId=${booking.id}`);
            } else {
              setErrorMsg(verifyData.error || 'Payment verification failed.');
              setSubmitting(false);
            }
          } catch (e) {
            setErrorMsg('Payment verification failed.');
            setSubmitting(false);
          }
        },
        prefill: {
          name: guestName,
          email: guestEmail,
        },
        theme: {
          color: "#0a0a0a"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        setErrorMsg(response.error.description || 'Payment failed.');
        setSubmitting(false);
      });
      rzp.open();
    } catch (err: any) {
      setErrorMsg(err.message || 'Booking failed. Please try again.');
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return `₹${Math.round(cents / 100).toLocaleString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-20">
      
      {/* Back link */}
      <button
        id="back-link-btn"
        onClick={() => setCurrentRoute('/events')}
        className="flex items-center space-x-2 text-xs font-mono tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white uppercase mb-8 cursor-pointer group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        <span>Return to events</span>
      </button>

      {/* Hero Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
        
        {/* Left Aspect - Text Copy */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center space-x-2 text-neutral-400 font-mono text-xs tracking-wider uppercase">
            <span>LIMITED EXPERIENCE SESSION</span>
          </div>
          
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-violet-600 dark:text-violet-500 leading-tight">
            {event.title}
          </h1>

          {/* Quick Date / Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-neutral-100 dark:border-neutral-900 py-5">
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-neutral-400 uppercase">DATE &amp; TIME</p>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{formatDate(event.event_date)}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Doors open 20:00 IST</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-neutral-400 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-neutral-400 uppercase">LOCATION &amp; VENUE</p>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{event.location}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Venue details shared on checkout</p>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none text-sm leading-relaxed font-light text-neutral-600 dark:text-neutral-400 space-y-4">
            <p className="text-base text-neutral-800 dark:text-neutral-300 font-normal">
              {event.teaser}
            </p>
            {event.description.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        {/* Right Aspect - Hero Image Banner */}
        <div className="lg:col-span-5 h-fit">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full aspect-[4/3] object-cover filter mix-blend-luminosity hover:mix-blend-normal transition-all duration-500"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-400">
              <span><span className="text-violet-600 dark:text-violet-500 font-bold">ZYRON</span> PORTFOLIO EXP #{event.slug.toUpperCase()}</span>
              <span>EST. CAPACITY: {event.capacity}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Ticket Booking Panel */}
      <div id="booking-section" className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Side: Select Ticket Tier */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-white">
            Select ticket tier
          </h2>
          
          <div className="space-y-4">
            {tiers.map((tier) => (
              <label
                id={`tier-label-${tier.key}`}
                key={tier.key}
                className={`block border p-5 cursor-pointer transition-all duration-150 ${
                  selectedTier === tier.key
                    ? 'border-neutral-950 bg-neutral-50/60 dark:border-white dark:bg-neutral-900/40'
                    : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600 bg-white dark:bg-neutral-950'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      id={`tier-radio-${tier.key}`}
                      type="radio"
                      name="ticket-tier"
                      checked={selectedTier === tier.key}
                      onChange={() => {
                        setSelectedTier(tier.key);
                        // Group ticket type starts with 1 quantity or 1 group bundle
                        setQuantity(1);
                      }}
                      className="h-4 w-4 border-neutral-300 text-neutral-950 focus:ring-neutral-950 dark:border-neutral-800 dark:text-white dark:focus:ring-white"
                    />
                    <div className="space-y-0.5">
                      <span className="font-serif text-base font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                        {tier.name}
                        {tier.key === 'vip' && <ShieldCheck className="h-4 w-4 text-neutral-400" />}
                        {tier.key === 'group' && <Users className="h-4 w-4 text-neutral-400" />}
                      </span>
                    </div>
                  </div>
                  <span className="font-serif font-bold text-base text-neutral-950 dark:text-white">
                    {formatPrice(tier.price)}
                  </span>
                </div>
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 pl-7 leading-relaxed font-light">
                  {tier.desc}
                </p>
              </label>
            ))}
          </div>
        </div>

        {/* Right Side: Form details & Checkout validation */}
        <div className="lg:col-span-5">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-900">
              <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Reservation Summary</h3>
              <span className="text-xs font-mono px-2 py-0.5 border border-neutral-200 text-neutral-400 rounded-sm">
                {isSoldOut ? 'Sold Out' : `${remainingTickets} tickets left`}
              </span>
            </div>

            {isSoldOut ? (
              <div className="border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-4 text-center">
                <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-900 dark:text-white mb-1">Session Sold Out</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-light">
                  This experience is currently fully booked. Sign up for our newsletter to get alerted on sudden ticket releases or secondary slots.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="space-y-6">
                
                {/* Quantity Stepper */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label id="qty-lbl" className="text-xs font-mono uppercase text-neutral-400">QUANTITY</label>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      Max 20 tickets
                    </span>
                  </div>
                  <div className="flex items-center">
                    <button
                      id="qty-decrement-btn"
                      type="button"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(quantity - 1)}
                      className="border border-neutral-200 dark:border-neutral-800 h-11 w-11 flex items-center justify-center text-lg hover:border-black dark:hover:border-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      -
                    </button>
                    <div className="border-y border-neutral-200 dark:border-neutral-800 h-11 flex-grow flex items-center justify-center font-mono text-sm font-semibold">
                      {quantity}
                    </div>
                    <button
                      id="qty-increment-btn"
                      type="button"
                      disabled={quantity >= Math.min(20, remainingTickets)}
                      onClick={() => setQuantity(quantity + 1)}
                      className="border border-neutral-200 dark:border-neutral-800 h-11 w-11 flex items-center justify-center text-lg hover:border-black dark:hover:border-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Attendee Details */}
                <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-5">
                  <h4 className="text-xs font-mono uppercase text-neutral-400">Attendee Information</h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label id="label-fullname" className="text-[11px] font-mono text-neutral-400 uppercase">FULL NAME</label>
                      <input
                        id="input-fullname"
                        type="text"
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label id="label-email" className="text-[11px] font-mono text-neutral-400 uppercase">EMAIL ADDRESS</label>
                      <input
                        id="input-email"
                        type="email"
                        required
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        placeholder="alex@rivera.com"
                        className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none"
                      />
                      <p className="text-[10px] text-neutral-400 leading-relaxed font-light mt-0.5">Your tickets and secret coordinates will be sent here.</p>
                    </div>

                    <div className="space-y-1">
                      <label id="label-phone" className="text-[11px] font-mono text-neutral-400 uppercase">PHONE *</label>
                      <input
                        id="input-phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label id="label-instagram" className="text-[11px] font-mono text-neutral-400 uppercase">INSTAGRAM *</label>
                      <input
                        id="input-instagram"
                        type="text"
                        required
                        value={guestInstagram}
                        onChange={(e) => setGuestInstagram(e.target.value)}
                        placeholder="@username"
                        className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Error Box */}
                {errorMsg && (
                  <div className="border border-red-200 dark:border-red-900/50 bg-red-50/10 dark:bg-red-950/10 p-3 flex items-start space-x-2 text-xs text-red-600 dark:text-red-400 font-sans">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Price Summary & Submit */}
                <div className="border-t border-neutral-100 dark:border-neutral-900 pt-5 space-y-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-mono uppercase text-neutral-400">Total Price</span>
                    <span className="font-serif text-2xl font-bold text-neutral-900 dark:text-white">
                      {formatPrice(totalCents)}
                    </span>
                  </div>

                  <label className="flex items-start space-x-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-3.5 w-3.5 border-neutral-300 text-neutral-950 focus:ring-neutral-950 dark:border-neutral-800 dark:text-white dark:focus:ring-white"
                    />
                    <span className="text-[10px] text-neutral-500 font-light leading-relaxed">
                      I accept the terms and conditions, including the strict no-refund policy, age restrictions, and right of admission refusal.
                    </span>
                  </label>

                  <motion.button
                    id="submit-booking-btn"
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-4 text-xs font-semibold tracking-widest uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                    whileInView={{ scale: [1, 1.02, 1], boxShadow: ["0px 0px 0px rgba(255,255,255,0)", "0px 0px 20px rgba(255,255,255,0.4)", "0px 0px 0px rgba(255,255,255,0)"] }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.8, ease: "easeInOut", repeat: 2 }}
                  >
                    {submitting ? 'Booking…' : user ? 'Book Tickets' : 'Sign in to Reserve'}
                  </motion.button>
                  
                  {!user && (
                    <p className="text-[10px] text-center text-neutral-400 font-light font-mono">
                      Guest checkout automatically registers a free secure account so you can update dietary details & retrieve QR passes.
                    </p>
                  )}
                </div>

              </form>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
