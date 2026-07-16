/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sun, Moon, Menu, X, Instagram, LogOut, User, Calendar, Images, BookOpen, ShieldAlert } from 'lucide-react';
import { User as AuthUser } from '../types';

interface HeaderProps {
  user: AuthUser | null;
  onSignOut: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  currentRoute: string;
  setCurrentRoute: (route: string) => void;
}

export default function Header({
  user,
  onSignOut,
  darkMode,
  setDarkMode,
  currentRoute,
  setCurrentRoute,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Events', route: '/events', icon: Calendar },
    { label: 'Gallery', route: '/gallery', icon: Images },
    { label: 'Story', route: '/story', icon: BookOpen },
  ];

  if (user) {
    navLinks.push({ label: 'My Bookings', route: '/my-bookings', icon: User });
    if (user.role === 'admin') {
      navLinks.push({ label: 'Admin', route: '/admin', icon: ShieldAlert });
    }
  }

  const handleNavClick = (route: string) => {
    setCurrentRoute(route);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-[1002] w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 transition-colors duration-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo / Wordmark */}
        <div className="flex items-center">
          <button
            id="header-logo-btn"
            onClick={() => handleNavClick('/')}
            className="font-serif text-xl font-bold tracking-tight text-neutral-900 dark:text-white cursor-pointer"
          >
            <span className="text-violet-600 dark:text-violet-500">ZYRON</span> <span className="font-sans text-xs tracking-[0.2em] font-normal text-neutral-400 dark:text-neutral-500 ml-1">PRODUCTIONS</span>
          </button>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = currentRoute === link.route || currentRoute.startsWith(link.route + '/');
            return (
              <button
                id={`nav-${link.label.toLowerCase().replace(' ', '-')}`}
                key={link.route}
                onClick={() => handleNavClick(link.route)}
                className={`flex items-center space-x-1.5 text-sm font-medium tracking-wide transition-colors duration-150 cursor-pointer ${
                  isActive
                    ? 'text-neutral-950 dark:text-white border-b border-neutral-950 dark:border-white pb-1 mt-1'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 pb-1 mt-1'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden md:flex items-center space-x-4">
          <a
            id="instagram-link"
            href="https://instagram.com/zyron.hyd"
            target="_blank"
            rel="noreferrer"
            className="text-neutral-400 hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-white transition-colors duration-150"
            aria-label="Instagram"
          >
            <Instagram className="h-5 w-5" />
          </a>

          {/* Auth Button */}
          {user ? (
            <div className="flex items-center space-x-3 pl-2 border-l border-neutral-200 dark:border-neutral-800">
              <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 truncate max-w-[120px]" title={user.email}>
                {user.email.split('@')[0]}
              </span>
              <button
                id="signout-btn"
                onClick={onSignOut}
                className="flex items-center space-x-1 border border-neutral-200 hover:border-neutral-950 px-3 py-1.5 text-xs font-medium tracking-wide transition-colors bg-transparent text-neutral-800 dark:text-neutral-300 dark:border-neutral-800 dark:hover:border-white hover:text-neutral-950 dark:hover:text-white cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              id="signin-nav-btn"
              onClick={() => handleNavClick('/auth')}
              className="bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 px-4 py-1.5 text-xs font-medium tracking-wide transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center space-x-2">
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Slide-In Sheet Mock) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-[1001] bg-white dark:bg-neutral-950 transition-all duration-300 border-t border-neutral-100 dark:border-neutral-900 overflow-y-auto">
          <div className="flex flex-col space-y-2 p-6 h-full min-h-[calc(100vh-4rem)]">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = currentRoute === link.route || currentRoute.startsWith(link.route + '/');
              return (
                <button
                  id={`mobile-nav-${link.label.toLowerCase().replace(' ', '-')}`}
                  key={link.route}
                  onClick={() => handleNavClick(link.route)}
                  className={`flex items-center space-x-3 py-3 px-4 text-left text-base font-medium tracking-wide border-b border-neutral-100 dark:border-neutral-900 transition-colors ${
                    isActive
                      ? 'text-neutral-950 dark:text-white bg-neutral-50 dark:bg-neutral-900'
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </button>
              );
            })}

            {/* User Session Info Mobile */}
            <div className="pt-6 mt-auto border-t border-neutral-200 dark:border-neutral-800 pb-12 flex flex-col space-y-4">
              <a
                id="instagram-mobile"
                href="https://instagram.com/zyron.hyd"
                target="_blank"
                rel="noreferrer"
                className="flex items-center space-x-3 text-neutral-500 dark:text-neutral-400"
              >
                <Instagram className="h-5 w-5" />
                <span>Follow on Instagram</span>
              </a>

              {user ? (
                <div className="flex flex-col space-y-3">
                  <div className="text-xs font-mono text-neutral-400 dark:text-neutral-500 px-1">
                    Logged in as: {user.email}
                  </div>
                  <button
                    id="mobile-signout"
                    onClick={() => {
                      onSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center space-x-2 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 py-2.5 text-sm font-medium transition-colors hover:border-black dark:hover:border-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  id="mobile-signin"
                  onClick={() => handleNavClick('/auth')}
                  className="w-full bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 py-3 text-sm font-medium tracking-wide transition-all duration-150"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
