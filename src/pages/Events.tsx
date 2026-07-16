/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, MapPin, ArrowRight, ArrowUpDown } from 'lucide-react';
import { Event } from '../types';

interface EventsProps {
  events: Event[];
  isLoading: boolean;
  setCurrentRoute: (route: string) => void;
  setSelectedEventSlug: (slug: string) => void;
}

export default function Events({
  events,
  isLoading,
  setCurrentRoute,
  setSelectedEventSlug,
}: EventsProps) {
  const publishedEvents = events.filter((e) => e.status === 'published');
  const [sortOrder, setSortOrder] = useState<'soonest' | 'latest'>('soonest');

  // Handle Sort
  const sortedEvents = [...publishedEvents].sort((a, b) => {
    const timeA = new Date(a.event_date).getTime();
    const timeB = new Date(b.event_date).getTime();
    return sortOrder === 'soonest' ? timeA - timeB : timeB - timeA;
  });

  const handleEventClick = (slug: string) => {
    setSelectedEventSlug(slug);
    setCurrentRoute(`/events/${slug}`);
  };

  const formatPrice = (cents: number) => {
    return `₹${Math.round(cents / 100).toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="py-16 md:py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-neutral-200 dark:border-neutral-800 pb-10 mb-12 gap-6">
        <div className="space-y-3">
          <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-violet-600 dark:text-violet-500">
            Experiences
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 font-light max-w-xl text-base leading-relaxed">
            Our calendar of themed sessions, warehouse raves, and minimalist banquets. Complete entry details and reservations are available below.
          </p>
        </div>

        {/* Sort Filter */}
        <div className="flex items-center space-x-2">
          <button
            id="toggle-sort-order"
            onClick={() => setSortOrder(sortOrder === 'soonest' ? 'latest' : 'soonest')}
            className="flex items-center space-x-2 border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs font-mono tracking-widest text-neutral-800 dark:text-neutral-200 uppercase hover:border-black dark:hover:border-white transition-all-150 cursor-pointer"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Sort: {sortOrder === 'soonest' ? 'Soonest First' : 'Latest First'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">Gathering upcoming experiences...</p>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="border border-neutral-200 dark:border-neutral-800 py-24 text-center">
          <p className="text-neutral-500 dark:text-neutral-400 font-light font-sans text-sm">
            No events available right now — check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sortedEvents.map((event) => {
            const isSoldOut = event.capacity === event.tickets_sold;
            return (
              <div
                key={event.id}
                onClick={() => handleEventClick(event.slug)}
                className="group border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 cursor-pointer overflow-hidden flex flex-col h-full hover:border-neutral-950 dark:hover:border-white transition-all duration-150"
              >
                {/* Event Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                  <img
                    src={event.image_url} loading="lazy"
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-103"
                    referrerPolicy="no-referrer"
                  />
                  {isSoldOut ? (
                    <span className="absolute top-3 right-3 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 px-2 py-1 text-[10px] font-mono tracking-widest uppercase">
                      Sold Out
                    </span>
                  ) : (
                    <span className="absolute top-3 right-3 bg-white/90 text-neutral-950 border border-neutral-200 dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-white px-2 py-1 text-[10px] font-mono tracking-widest uppercase">
                      {event.capacity - event.tickets_sold} remaining
                    </span>
                  )}
                </div>

                {/* Event Metadata */}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center space-x-1.5 text-[11px] font-mono tracking-wider text-neutral-400 uppercase mb-3">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(event.event_date)}</span>
                  </div>
                  
                  <h3 className="font-serif text-xl font-semibold text-neutral-900 dark:text-white group-hover:text-neutral-500 transition-colors mb-3">
                    {event.title}
                  </h3>
                  
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-light leading-relaxed mb-6 line-clamp-3 flex-grow">
                    {event.teaser}
                  </p>

                  <div className="flex items-center space-x-1.5 text-xs font-mono text-neutral-400 mb-5">
                    <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{event.location}</span>
                  </div>

                  {/* Actions/Price Bar */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-900">
                    <span className="font-mono text-xs text-neutral-400">
                      From {formatPrice(Math.min(event.general_price_cents, event.vip_price_cents || Infinity))}
                    </span>
                    <span className="text-xs font-mono text-neutral-900 dark:text-white group-hover:underline flex items-center space-x-1">
                      <span>{isSoldOut ? 'Sold Out' : 'Reserve Spot'}</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
