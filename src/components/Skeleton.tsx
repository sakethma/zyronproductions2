import React from 'react';
import { motion } from 'motion/react';

/**
 * An elegant container that breathes with opacity, using Framer Motion
 * combined with our hardware-accelerated CSS shimmer effect.
 */
export function SkeletonPulse({
  className = '',
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0.6 }}
      animate={{ opacity: [0.6, 0.9, 0.6] }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`shimmer-bg rounded-xs ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Skeleton placeholder for the vertical grid Event Cards
 * used in Home.tsx and Events.tsx.
 */
export function EventCardSkeleton() {
  return (
    <div className="border border-neutral-200 dark:border-neutral-900 bg-white dark:bg-neutral-950/40 overflow-hidden flex flex-col h-full">
      {/* Event Image Box */}
      <div className="relative aspect-video w-full bg-neutral-100 dark:bg-neutral-900/40">
        <SkeletonPulse className="absolute inset-0" />
      </div>

      {/* Metadata & Title Box */}
      <div className="p-6 flex flex-col flex-grow space-y-4">
        {/* Date Row */}
        <div className="flex items-center space-x-2">
          <SkeletonPulse className="h-3 w-4" />
          <SkeletonPulse className="h-3 w-28" />
        </div>

        {/* Title */}
        <SkeletonPulse className="h-6 w-3/4" />

        {/* Teaser Paragraph */}
        <div className="space-y-2 flex-grow">
          <SkeletonPulse className="h-3.5 w-full" />
          <SkeletonPulse className="h-3.5 w-[90%]" />
          <SkeletonPulse className="h-3.5 w-[40%]" />
        </div>

        {/* Location Row */}
        <div className="flex items-center space-x-2 pt-2">
          <SkeletonPulse className="h-3.5 w-4" />
          <SkeletonPulse className="h-3.5 w-1/2" />
        </div>

        {/* Price & Actions Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-900/60">
          <SkeletonPulse className="h-3 w-1/3" />
          <SkeletonPulse className="h-4 w-1/4" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for EventDetail.tsx.
 * Beautiful split layout matching the rich page template.
 */
export function EventDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 md:py-20 animate-pulse">
      {/* Return Link skeleton */}
      <div className="flex items-center space-x-2 mb-8">
        <SkeletonPulse className="h-3 w-4" />
        <SkeletonPulse className="h-3 w-28" />
      </div>

      {/* Hero split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
        {/* Left Side: Copy details */}
        <div className="lg:col-span-7 space-y-6">
          <SkeletonPulse className="h-3.5 w-36" />
          <SkeletonPulse className="h-10 md:h-14 w-5/6" />

          {/* Quick Date / Location boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-neutral-100 dark:border-neutral-900 py-5">
            <div className="flex items-start space-x-3">
              <SkeletonPulse className="h-5 w-5 rounded-xs mt-0.5" />
              <div className="space-y-2 flex-grow">
                <SkeletonPulse className="h-3 w-1/3" />
                <SkeletonPulse className="h-4 w-4/5" />
                <SkeletonPulse className="h-3 w-1/2" />
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <SkeletonPulse className="h-5 w-5 rounded-xs mt-0.5" />
              <div className="space-y-2 flex-grow">
                <SkeletonPulse className="h-3 w-1/3" />
                <SkeletonPulse className="h-4 w-4/5" />
                <SkeletonPulse className="h-3 w-1/2" />
              </div>
            </div>
          </div>

          {/* Large description body paragraph skeleton */}
          <div className="space-y-4 pt-4">
            <SkeletonPulse className="h-4 w-full" />
            <SkeletonPulse className="h-4 w-full" />
            <SkeletonPulse className="h-4 w-[95%]" />
            <SkeletonPulse className="h-4 w-[85%]" />
            <SkeletonPulse className="h-4 w-[40%]" />
          </div>
        </div>

        {/* Right Side: Image panel */}
        <div className="lg:col-span-5">
          <div className="border border-neutral-200 dark:border-neutral-800 p-1">
            <div className="aspect-[4/3] w-full bg-neutral-100 dark:bg-neutral-900/60 relative overflow-hidden">
              <SkeletonPulse className="absolute inset-0" />
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-between">
              <SkeletonPulse className="h-3.5 w-1/2" />
              <SkeletonPulse className="h-3.5 w-1/4" />
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Selection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-4">
        {/* Select Tiers */}
        <div className="lg:col-span-7 space-y-4">
          <SkeletonPulse className="h-6 w-40 mb-2" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-neutral-200 dark:border-neutral-800 p-5 flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-grow">
                  <SkeletonPulse className="h-4 w-4 rounded-full" />
                  <div className="space-y-2 flex-grow">
                    <SkeletonPulse className="h-4.5 w-1/3" />
                    <SkeletonPulse className="h-3 w-2/3" />
                  </div>
                </div>
                <SkeletonPulse className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Reservation Card Form */}
        <div className="lg:col-span-5">
          <div className="border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 space-y-6">
            <div className="flex justify-between pb-4 border-b border-neutral-100 dark:border-neutral-900">
              <SkeletonPulse className="h-5 w-1/2" />
              <SkeletonPulse className="h-4 w-1/4" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-1/4" />
                <SkeletonPulse className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-1/3" />
                <SkeletonPulse className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <SkeletonPulse className="h-3 w-1/4" />
                <SkeletonPulse className="h-10 w-full" />
              </div>
            </div>
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-900 space-y-4">
              <div className="flex justify-between items-center">
                <SkeletonPulse className="h-4 w-1/4" />
                <SkeletonPulse className="h-7 w-24" />
              </div>
              <SkeletonPulse className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for horizontal MyBookings card.
 */
export function BookingCardSkeleton() {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
      {/* Event Thumbnail skeleton */}
      <div className="md:col-span-3 aspect-[4/3] bg-neutral-100 dark:bg-neutral-900/40 relative overflow-hidden border border-neutral-200 dark:border-neutral-800">
        <SkeletonPulse className="absolute inset-0" />
      </div>

      {/* Information details */}
      <div className="md:col-span-5 space-y-3">
        <div className="flex space-x-2">
          <SkeletonPulse className="h-4.5 w-24" />
          <SkeletonPulse className="h-4.5 w-16" />
        </div>
        <SkeletonPulse className="h-6 w-3/4" />
        <div className="flex space-x-2 items-center">
          <SkeletonPulse className="h-3.5 w-4" />
          <SkeletonPulse className="h-3.5 w-1/3" />
        </div>
        <div className="space-y-1.5 pt-2">
          <SkeletonPulse className="h-3 w-3/4" />
          <SkeletonPulse className="h-3 w-1/2" />
          <SkeletonPulse className="h-3 w-1/3" />
        </div>
      </div>

      {/* Actions and QR column */}
      <div className="md:col-span-4 flex flex-col items-stretch md:items-end space-y-4 pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-900/60">
        <div className="flex items-center justify-between md:justify-end gap-4 w-full">
          <div className="hidden md:block bg-neutral-100 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 h-24 w-24 p-1">
            <SkeletonPulse className="w-full h-full" />
          </div>
          <div className="space-y-1.5 flex flex-col items-start md:items-end">
            <SkeletonPulse className="h-3 w-16" />
            <SkeletonPulse className="h-7 w-24" />
          </div>
        </div>
        <SkeletonPulse className="h-10 w-full" />
        <SkeletonPulse className="h-8 w-full" />
      </div>
    </div>
  );
}
