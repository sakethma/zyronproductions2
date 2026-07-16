/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, MapPin, ArrowRight, Clock } from 'lucide-react';
import { Event } from '../types';
import CanvasBackground from '../components/CanvasBackground';

interface HomeProps {
  events: Event[];
  isLoading: boolean;
  setCurrentRoute: (route: string) => void;
  setSelectedEventSlug: (slug: string) => void;
}

export default function Home({
  events,
  isLoading,
  setCurrentRoute,
  setSelectedEventSlug,
}: HomeProps) {
  const publishedEvents = events.filter((e) => e.status === 'published');
  
  // Find the next upcoming published event
  const now = new Date();
  const upcomingEvents = publishedEvents
    .filter((e) => new Date(e.event_date) > now)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  const featuredEvent = upcomingEvents[0] || null;

  // Countdown state
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!featuredEvent) return;

    const calculateTimeLeft = () => {
      const difference = new Date(featuredEvent.event_date).getTime() - Date.now();
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000); // Ticking live every second!

    return () => clearInterval(interval);
  }, [featuredEvent]);

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
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex min-h-[85vh] items-center justify-center bg-neutral-950 text-white py-24 px-4">
        {/* Subtle noise overlay */}
        <div className="noise-bg absolute inset-0 z-0"></div>
        
        {/* Animated Background */}
        <CanvasBackground />

        {/* Gradient dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent z-10"></div>

        <div className="relative z-20 mx-auto max-w-4xl text-center flex flex-col items-center">
          <span className="font-mono text-xs tracking-[0.35em] text-neutral-400 uppercase mb-4 block">
            <span className="text-violet-600 dark:text-violet-500 font-bold">ZYRON</span> PRODUCTIONS PRESENTS
          </span>
          <h1 
            className="text-7xl md:text-9xl leading-none mb-8 uv-chrome-text uppercase"
            style={{ transform: 'perspective(500px) rotateX(15deg)' }}
          >
            THIRD DIMENSION
          </h1>
          <p className="font-sans text-lg md:text-xl text-neutral-300 max-w-2xl font-light leading-relaxed mb-12">
            An independent creative community hosting hyper-polished, monochrome themed parties and premium visual-audio showcases in secret urban spaces.
          </p>
        </div>
      </section>

      {/* Countdown Card (Only if featured upcoming event exists) */}
      {featuredEvent && (
        <section className="relative z-30 -mt-16 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-8 transition-all duration-300">
            <div className="space-y-4 text-left max-w-md">
              <div className="flex items-center space-x-2 text-neutral-400 font-mono text-xs tracking-wider uppercase">
                <Clock className="h-4.5 w-4.5 animate-pulse text-neutral-900 dark:text-white" />
                <span>Next Upcoming Experience</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">
                {featuredEvent.title}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-light line-clamp-2">
                {featuredEvent.teaser}
              </p>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-1 text-xs text-neutral-400 font-mono">
                <span className="flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{formatDate(featuredEvent.event_date)}</span>
                </span>
              </div>
            </div>

            {/* Countdown Numbers */}
            <div className="grid grid-cols-4 gap-4 md:gap-6 text-center">
              {[
                { label: 'days', value: timeLeft.days },
                { label: 'hours', value: timeLeft.hours },
                { label: 'mins', value: timeLeft.minutes },
                { label: 'secs', value: timeLeft.seconds },
              ].map((item) => (
                <div key={item.label} className="flex flex-col p-3 md:p-4 border border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/40 min-w-[70px] md:min-w-[90px]">
                  <span className="font-serif text-2xl md:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">
                    {String(item.value).padStart(2, '0')}
                  </span>
                  <span className="font-sans text-[10px] tracking-widest text-neutral-400 dark:text-neutral-500 uppercase mt-1">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Action */}
            <div className="w-full lg:w-auto mt-4 lg:mt-0 flex justify-center">
              <motion.button
                id={`countdown-book-${featuredEvent.slug}`}
                onClick={() => handleEventClick(featuredEvent.slug)}
                className="w-full lg:w-auto bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 px-8 py-4 text-xs font-semibold tracking-widest uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer flex items-center justify-center space-x-2"
                whileInView={{ scale: [1, 1.05, 1], boxShadow: ["0px 0px 0px rgba(255,255,255,0)", "0px 0px 20px rgba(255,255,255,0.4)", "0px 0px 0px rgba(255,255,255,0)"] }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.8, ease: "easeInOut", repeat: 2 }}
              >
                <span>Book Ticket</span>
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </section>
      )}

      {/* Featured Events Grid */}
      <section className="py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-baseline justify-between mb-16 gap-4">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <span className="text-violet-600 dark:text-violet-500">Events</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-md font-light text-sm">
              Explore upcoming curated themes. Space is strictly limited to ensure sound quality and intimate crowd dynamics.
            </p>
          </div>
          <button
            id="view-all-events-btn"
            onClick={() => setCurrentRoute('/events')}
            className="group flex items-center space-x-1.5 text-xs font-mono tracking-widest text-neutral-900 hover:text-neutral-500 dark:text-white dark:hover:text-neutral-400 uppercase transition-colors cursor-pointer"
          >
            <span>View All Events</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 w-full space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">Loading curation roster...</p>
          </div>
        ) : publishedEvents.length === 0 ? (
          <div className="border border-neutral-200 dark:border-neutral-800 p-16 text-center">
            <p className="text-neutral-500 dark:text-neutral-400 font-light font-sans text-sm">
              No upcoming experiences scheduled at this moment. Join our community on Instagram for announcements.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {publishedEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event.slug)}
                className="group border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 cursor-pointer overflow-hidden flex flex-col h-full hover:border-neutral-900 dark:hover:border-white transition-all-150"
              >
                {/* Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  {event.capacity === event.tickets_sold && (
                    <span className="absolute top-3 right-3 bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 px-2 py-1 text-[10px] font-mono tracking-widest uppercase">
                      Sold Out
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="text-[11px] font-mono tracking-wider text-neutral-400 uppercase mb-2">
                    {formatDate(event.event_date)}
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-neutral-900 dark:text-white group-hover:text-neutral-500 transition-colors mb-2.5">
                    {event.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-light leading-relaxed mb-6 line-clamp-2 flex-grow">
                    {event.teaser}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-900">
                    <span className="font-mono text-xs text-neutral-400">
                      From {formatPrice(Math.min(event.general_price_cents, event.vip_price_cents || Infinity))}
                    </span>
                    <span className="text-xs font-mono text-neutral-900 dark:text-white group-hover:underline flex items-center space-x-1">
                      <span>Reserve</span>
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bottom Call To Action */}
      <section className="py-24 px-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950/20 text-center">
        <h2 className="font-serif text-2xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white mb-6">
          Ready to experience <span className="text-violet-600 dark:text-violet-500">Zyron</span>?
        </h2>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md mx-auto justify-center">
          <button
            id="browse-events-bottom-btn"
            onClick={() => setCurrentRoute('/events')}
            className="w-full sm:w-auto bg-neutral-950 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-950 border border-neutral-950 dark:border-white font-medium px-8 py-4 text-sm tracking-widest uppercase transition-colors cursor-pointer"
          >
            Browse Events
          </button>
          <button
            id="story-bottom-btn"
            onClick={() => setCurrentRoute('/story')}
            className="w-full sm:w-auto bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-950 dark:text-white border border-neutral-300 dark:border-neutral-700 font-medium px-8 py-4 text-sm tracking-widest uppercase transition-colors cursor-pointer"
          >
            Our Story
          </button>
        </div>
      </section>
    </div>
  );
}
