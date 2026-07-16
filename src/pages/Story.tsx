/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Camera, Music, Sparkles } from 'lucide-react';

export default function Story() {
  return (
    <div className="relative overflow-hidden">
      {/* Editorial Header */}
      <section className="py-20 md:py-32 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-4xl space-y-6">
          <span className="font-mono text-xs tracking-[0.4em] text-neutral-400 uppercase">
            THE MANIFESTO
          </span>
          <h1 className="font-serif text-4xl md:text-7xl font-semibold tracking-tight text-violet-600 dark:text-violet-500 leading-[1.05]">
            Visions in Deep Black. <br />
            Energy in Ultraviolet.
          </h1>
          <p className="font-sans text-lg md:text-2xl text-neutral-500 dark:text-neutral-400 font-light leading-relaxed max-w-3xl pt-4">
            <span className="text-violet-600 dark:text-violet-500 font-semibold">Zyron</span> Productions was established in Hyderabad to disrupt the standard digital and visual landscape. We believe an experience is not just a screen with pixels or a standard layout; it is an active canvas of dimension, sensory immersion, and cutting-edge curation.
          </p>
        </div>
      </section>

      {/* Narrative Section - Split Columns */}
      <section className="py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <div className="lg:col-span-5 space-y-6">
          <h2 className="font-serif text-3xl font-bold text-neutral-900 dark:text-white">
            Our Principles
          </h2>
          <div className="w-12 h-1 bg-neutral-900 dark:bg-white"></div>
          <p className="text-sm font-mono tracking-wider text-neutral-400 uppercase">
            EST. HYDERABAD, 2026
          </p>
        </div>

        <div className="lg:col-span-7 space-y-8 font-light text-neutral-600 dark:text-neutral-400 text-base leading-relaxed">
          <p>
            The modern digital and social experience has become cluttered with corporate stiffness, rigid templates, and predictable, safe patterns. <span className="text-violet-600 dark:text-violet-500 font-semibold">Zyron</span> rejects the default. We constrain our palette to the cosmos — deep black voids pierced by electric magenta, wet chrome, and liquid violet — letting high-end aesthetics, raw atmospheric energy, and bold 3D elements tell the story.
          </p>
          <p>
            Every universe we build is unique. From high-energy streetwear drops to hyper-immersive digital platforms, we work with the limitless boundaries of the digital environment, never overriding its edge, but amplifying its pulse.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <Music className="h-5 w-5 text-neutral-900 dark:text-white" />
                <h4 className="font-serif text-lg font-semibold text-neutral-900 dark:text-white">Acoustic Precision</h4>
              </div>
              <p className="text-xs leading-relaxed">
                We custom-tune high-fidelity soundscapes. Slow-tempo electronic beats, modular experimental live sets, and cinematic string ensembles form our auditory spine.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <Camera className="h-5 w-5 text-neutral-900 dark:text-white" />
                <h4 className="font-serif text-lg font-semibold text-neutral-900 dark:text-white">Visual Halftone</h4>
              </div>
              <p className="text-xs leading-relaxed">
                Using 2D rasterization, analog halftone projection, and raw shadows, we shape custom visual patterns that merge physical bodies into living art.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Interlude */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative aspect-[21/9] w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950">
          <img
            src="https://images.unsplash.com/photo-1469371670807-013ccf25f16a?q=80&w=1600"
            alt="Atmospheric dinner setup"
            className="w-full h-full object-cover filter mix-blend-luminosity"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-neutral-950/40 flex items-end p-6 md:p-12">
            <div className="text-white space-y-1">
              <p className="font-mono text-[10px] tracking-widest text-neutral-300 uppercase">EXP #003 BANQUET REHEARSAL</p>
              <p className="font-serif text-lg md:text-xl font-medium">Setting the monolithic stone table under twilight</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
