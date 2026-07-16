/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Instagram, Mail, MapPin } from 'lucide-react';

interface FooterProps {
  setCurrentRoute: (route: string) => void;
}

export default function Footer({ setCurrentRoute }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50 py-16 dark:border-neutral-800 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          
          {/* Brand Blurb */}
          <div className="flex flex-col space-y-4">
            <h3 className="font-serif text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              <span className="text-violet-600 dark:text-violet-500">ZYRON</span> <span className="font-sans text-xs font-normal tracking-[0.2em] text-neutral-400">PRODUCTIONS</span>
            </h3>
            <p className="text-sm leading-relaxed max-w-sm">
              We create ultra-polished, hyper-sensory themed parties and live electronic events designed around minimalist aesthetics, rich shadows, and pristine soundscapes.
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <a
                id="footer-instagram"
                href="https://instagram.com/zyron.hyd"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-400 hover:text-violet-600 dark:text-neutral-500 dark:hover:text-violet-500 transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <span className="text-xs font-mono text-neutral-400">@zyron.hyd</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col space-y-4">
            <h4 className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Navigation</h4>
            <div className="flex flex-col space-y-2.5">
              {['Events', 'Gallery', 'Story'].map((item) => (
                <button
                  id={`footer-nav-${item.toLowerCase()}`}
                  key={item}
                  onClick={() => setCurrentRoute(`/${item.toLowerCase()}`)}
                  className="text-sm text-left hover:text-neutral-950 dark:hover:text-white transition-colors w-fit cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Contact Details */}
          <div className="flex flex-col space-y-4">
            <h4 className="text-xs font-mono tracking-widest text-neutral-400 uppercase">Contact</h4>
            <div className="flex flex-col space-y-3 text-sm">
              <div className="flex items-center space-x-2.5">
                <Mail className="h-4 w-4 text-neutral-400" />
                <a id="footer-email-link" href="mailto:zyroninbox@gmail.com" className="hover:text-violet-600 dark:hover:text-violet-500 transition-colors">
                  zyroninbox@gmail.com
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-16 border-t border-neutral-200 dark:border-neutral-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-mono text-neutral-400">
            &copy; {currentYear} Zyron Productions. All rights reserved.
          </p>
          </div>
      </div>
    </footer>
  );
}
