/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Images, AlertCircle } from 'lucide-react';
import { GalleryItem } from '../types';
import Lightbox from '../components/Lightbox';
import { apiFetch } from '../lib/api';

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/api/gallery')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch gallery');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setItems(data);
        } else {
          console.error("Invalid gallery items format (expected array):", data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const handlePrev = () => {
    if (selectedIdx === null || items.length === 0) return;
    setSelectedIdx((prev) => (prev === 0 ? items.length - 1 : (prev ?? 0) - 1));
  };

  const handleNext = () => {
    if (selectedIdx === null || items.length === 0) return;
    setSelectedIdx((prev) => (prev === items.length - 1 ? 0 : (prev ?? 0) + 1));
  };

  return (
    <div className="py-16 md:py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-10 mb-12 space-y-3">
        <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-violet-600 dark:text-violet-500">
          Visual Index
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 font-light max-w-xl text-base leading-relaxed">
          Unfiltered high-contrast moments captured across our secret events, warehouse installations, and acoustic halls. Styled strictly in monochrome.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="aspect-square bg-neutral-100 dark:bg-neutral-900 animate-pulse border border-neutral-200 dark:border-neutral-800"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="border border-neutral-200 dark:border-neutral-800 py-24 text-center">
          <AlertCircle className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
          <p className="text-neutral-500 dark:text-neutral-400 font-light font-sans text-sm">
            The visual index is currently empty. Gallery photos will be posted post-session.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => setSelectedIdx(idx)}
              className="group relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              <img
                src={item.image_url}
                alt={item.caption || 'Gallery photo'}
               
                className="h-full w-full object-cover filter mix-blend-luminosity hover:mix-blend-normal transition-all duration-300"
                referrerPolicy="no-referrer"
              />
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-neutral-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4">
                <p className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
                  EXP #{item.id.slice(0, 5).toUpperCase()}
                </p>
                {item.caption && (
                  <p className="text-xs text-white line-clamp-2 leading-relaxed font-light">
                    {item.caption}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Trigger overlay */}
      {selectedIdx !== null && items[selectedIdx] && (
        <Lightbox
          item={items[selectedIdx]}
          onClose={() => setSelectedIdx(null)}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
