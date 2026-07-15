/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { GalleryItem } from '../types';

interface LightboxProps {
  item: GalleryItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Lightbox({ item, onClose, onPrev, onNext }: LightboxProps) {
  // Keypress event listener for navigation and escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    // Lock scrolling on background
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      id="lightbox-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button top right */}
      <button
        id="lightbox-close-btn"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full bg-neutral-900/80 p-3 text-white hover:bg-neutral-800 transition-colors focus:outline-none cursor-pointer"
        aria-label="Close Lightbox"
      >
        <X className="h-6 w-6" />
      </button>

      <div className="relative flex w-full max-w-5xl flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Navigation Left */}
        <button
          id="lightbox-prev-btn"
          onClick={onPrev}
          className="absolute left-2 md:-left-16 top-1/2 -translate-y-1/2 z-40 rounded-full bg-neutral-900/80 p-3 text-white hover:bg-neutral-800 transition-all focus:outline-none cursor-pointer"
          aria-label="Previous Image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Main Image Container */}
        <div className="flex max-h-[75vh] w-full items-center justify-center overflow-hidden border border-neutral-800 bg-neutral-950">
          <img
            id="lightbox-main-img"
            src={item.image_url}
            alt={item.caption || 'Gallery item'}
            className="h-full max-h-[75vh] w-full object-contain pointer-events-none select-none transition-transform duration-300"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Navigation Right */}
        <button
          id="lightbox-next-btn"
          onClick={onNext}
          className="absolute right-2 md:-right-16 top-1/2 -translate-y-1/2 z-40 rounded-full bg-neutral-900/80 p-3 text-white hover:bg-neutral-800 transition-all focus:outline-none cursor-pointer"
          aria-label="Next Image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Text Details */}
        {item.caption && (
          <div className="mt-4 w-full text-center max-w-2xl px-4">
            <p className="font-sans text-sm text-neutral-300 tracking-wide font-light leading-relaxed">
              {item.caption}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
