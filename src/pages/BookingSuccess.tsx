/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, Calendar, MapPin, ArrowRight, ArrowLeft, Mail, Ticket, AlertTriangle } from 'lucide-react';
import { Booking } from '../types';
import { apiFetch } from '../lib/api';

interface BookingSuccessProps {
  bookingId: string;
  setCurrentRoute: (route: string) => void;
}

export default function BookingSuccess({
  bookingId,
  setCurrentRoute,
}: BookingSuccessProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setErrorState(true);
      setIsLoading(false);
      return;
    }

    // Since we're logged in, fetching our bookings and finding it is the safest/simplest RLS simulation
    apiFetch('/api/bookings/my')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: Booking[]) => {
        const found = data.find((b) => b.id === bookingId);
        if (found) {
          setBooking(found);
        } else {
          setErrorState(true);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setErrorState(true);
        setIsLoading(false);
      });
  }, [bookingId]);

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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg py-24 px-4 text-center">
        <div className="h-10 w-10 bg-neutral-100 dark:bg-neutral-900 mx-auto animate-bounce mb-6 rounded-full"></div>
        <div className="h-6 w-48 bg-neutral-100 dark:bg-neutral-900 mx-auto animate-pulse mb-3"></div>
        <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-900 mx-auto animate-pulse"></div>
      </div>
    );
  }

  if (errorState || !booking) {
    return (
      <div className="mx-auto max-w-md py-24 px-4 text-center">
        <AlertTriangle className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-white mb-2">We couldn't find that booking</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8 font-light leading-relaxed">
          The booking reference code is invalid, missing, or belongs to another account. Please sign in with the correct account to access tickets.
        </p>
        <button
          id="err-back-to-events"
          onClick={() => setCurrentRoute('/events')}
          className="w-full border border-neutral-950 dark:border-white text-neutral-950 dark:text-white py-3 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
        >
          Browse Experiences
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 md:p-12 space-y-8 text-center relative overflow-hidden">
        
        {/* Absolute header accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-950 dark:bg-white"></div>

        {/* Success header */}
        <div className="space-y-3 flex flex-col items-center">
          <CheckCircle className="h-14 w-14 text-neutral-950 dark:text-white" />
          <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-white">
            Reservation Locked
          </h1>
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
            Admission Reference: {booking.id.split('-')[0].toUpperCase()}
          </p>
        </div>

        {/* Confirmation info card */}
        <div className="border border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/20 p-6 space-y-4 text-left">
          <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white border-b border-neutral-200 dark:border-neutral-800 pb-3">
            {booking.event_title}
          </h3>

          <div className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center space-x-2.5">
              <Calendar className="h-4.5 w-4.5 text-neutral-400 shrink-0" />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{formatDate(booking.event_date || '')}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 text-xs space-y-1 text-neutral-500 dark:text-neutral-400 font-light">
            <p>Admission Holder: <span className="font-semibold text-neutral-900 dark:text-white">{booking.guest_name}</span></p>
            <p>Seat Tier: <span className="font-semibold capitalize text-neutral-900 dark:text-white">{booking.tier} Entry</span></p>
            <p>Count: <span className="font-semibold text-neutral-900 dark:text-white">{booking.quantity} Ticket(s)</span></p>
            <p>Total Paid: <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(booking.total_cents)}</span></p>
          </div>
        </div>

        {/* Informational details block */}
        <div className="space-y-4 border-t border-neutral-100 dark:border-neutral-900 pt-6">
          <div className="flex items-start space-x-3 text-left">
            <Mail className="h-5 w-5 text-neutral-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-white">Secret coordinates incoming</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-light mt-0.5">
                We have dispatched a booking confirmation receipt to <span className="font-semibold">{booking.guest_email}</span>. A secondary dispatch with secret entry maps, code coordinates, and structural protocols will be sent 24 hours prior to the experience.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-neutral-100 dark:border-neutral-900">
          <button
            id="success-view-bookings-btn"
            onClick={() => setCurrentRoute('/my-bookings')}
            className="flex-1 bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-3 text-xs font-mono tracking-widest uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
          >
            Manage Bookings
          </button>
          
          <button
            id="success-back-to-events-btn"
            onClick={() => setCurrentRoute('/events')}
            className="flex-1 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white py-3 text-xs font-mono tracking-widest uppercase transition-colors cursor-pointer"
          >
            Explore More
          </button>
        </div>

      </div>
    </div>
  );
}
