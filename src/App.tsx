/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import { apiFetch } from './lib/api';

// Pages
import Home from './pages/Home';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Gallery from './pages/Gallery';
import Story from './pages/Story';
import Auth from './pages/Auth';
import MyBookings from './pages/MyBookings';
import BookingSuccess from './pages/BookingSuccess';
import Admin from './pages/Admin';
import Preloader from './components/Preloader';

import { Event, User, TicketTier } from './types';

// Route wrappers to convert React Router params into old props
function EventDetailWrapper({ user, onBook, setCurrentRoute, events, refetchEvents }: any) {
  const { slug } = useParams();
  return (
    <EventDetail
      slug={slug || ''}
      user={user}
      onBook={onBook}
      setCurrentRoute={setCurrentRoute}
      events={events}
      refetchEvents={refetchEvents}
    />
  );
}

function AuthWrapper({ onSignInSuccess, setCurrentRoute }: any) {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  return (
    <Auth
      onSignInSuccess={onSignInSuccess}
      setCurrentRoute={setCurrentRoute}
      redirectUrl={redirect}
    />
  );
}

function BookingSuccessWrapper({ setCurrentRoute }: any) {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId') || '';
  return (
    <BookingSuccess
      bookingId={bookingId}
      setCurrentRoute={setCurrentRoute}
    />
  );
}

export default function App() {
  const location = useLocation();
  const currentRoute = location.pathname + location.search;
  const navigate = useNavigate();
  const setCurrentRoute = (route: string) => {
    navigate(route);
  };

  const [selectedEventSlug, setSelectedEventSlug] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(true); // default to a high-end twilight dark theme!

  // Force dark mode class and prevent white theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Check Current Session Auth on Mount
  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          localStorage.removeItem('dev_token');
          setUser(null);
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Not JSON response');
        }
        return res.json();
      })
      .then((data) => {
        if (data && data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem('dev_token');
          setUser(null);
        }
      })
      .catch(() => {
        // network or other error
      });
  }, []);

  // Fetch Public Events list
  const fetchEvents = () => {
    if (events.length === 0) setIsLoadingEvents(true);
    apiFetch('/api/events')
      .then((res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Not JSON response');
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setEvents(data);
        } else {
          console.error("Invalid events data format (expected array):", data);
        }
        setIsLoadingEvents(false);
      })
      .catch((err) => {
        console.error("Failed to fetch events:", err);
        setIsLoadingEvents(false);
      });
  };

  useEffect(() => {
    fetchEvents();
    
    // Poll for real-time updates every 2 minutes
    const intervalId = setInterval(() => {
      apiFetch('/api/events')
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            throw new Error('Not JSON response');
          }
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setEvents(data);
          }
        })
        .catch(() => {});
    }, 120000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Handle Logout
  const handleSignOut = async () => {
    try {
      localStorage.removeItem('dev_token');
      await apiFetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setCurrentRoute('/');
    } catch (_) {}
  };

  // Handle Booking creation
  const handleBookTicket = async (bookingData: {
    event_id: string;
    tier: TicketTier;
    quantity: number;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    guest_instagram?: string;
    coupon_code?: string;
    additional_guests?: string;
  }) => {
    const response = await apiFetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Booking request failed');
    }
    return data;
  };

  const renderActivePage = () => {
    return (
      <Routes>
        <Route
          path="/"
          element={
            <Home
              events={events}
              isLoading={isLoadingEvents}
              setCurrentRoute={setCurrentRoute}
              setSelectedEventSlug={setSelectedEventSlug}
            />
          }
        />
        <Route
          path="/events"
          element={
            <Events
              events={events}
              isLoading={isLoadingEvents}
              setCurrentRoute={setCurrentRoute}
              setSelectedEventSlug={setSelectedEventSlug}
            />
          }
        />
        <Route
          path="/events/:slug"
          element={
            <EventDetailWrapper
              user={user}
              onBook={handleBookTicket}
              setCurrentRoute={setCurrentRoute}
              events={events}
              refetchEvents={fetchEvents}
            />
          }
        />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/story" element={<Story />} />
        <Route
          path="/auth"
          element={
            <AuthWrapper
              onSignInSuccess={(u: any) => setUser(u)}
              setCurrentRoute={setCurrentRoute}
            />
          }
        />
        <Route
          path="/my-bookings"
          element={
            <MyBookings
              setCurrentRoute={setCurrentRoute}
              setSelectedEventSlug={setSelectedEventSlug}
            />
          }
        />
        <Route
          path="/booking-success"
          element={
            <BookingSuccessWrapper
              setCurrentRoute={setCurrentRoute}
            />
          }
        />
        <Route
          path="/admin"
          element={
            <Admin
              user={user}
              events={events}
              refetchEvents={fetchEvents}
              setCurrentRoute={setCurrentRoute}
            />
          }
        />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-md py-24 px-4 text-center animate-fade-in">
              <h1 className="font-serif text-8xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none mb-4">404</h1>
              <p className="text-base text-neutral-500 mb-8 font-light">The coordinates you entered do not exist on our map.</p>
              <button
                id="btn-error-redirect"
                onClick={() => setCurrentRoute('/')}
                className="border border-neutral-950 dark:border-white text-neutral-950 dark:text-white px-6 py-2.5 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-all cursor-pointer animate-pulse"
              >
                Return Home
              </button>
            </div>
          }
        />
      </Routes>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50 transition-colors duration-150">
      <Preloader />
      
      {/* Primary Navigation Bar */}
      <Header
        user={user}
        onSignOut={handleSignOut}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentRoute={currentRoute}
        setCurrentRoute={setCurrentRoute}
      />

      {/* Main Container Stage */}
      <main className="flex-grow">
        {renderActivePage()}
      </main>

      {/* Global Footer */}
      <Footer setCurrentRoute={setCurrentRoute} />
    </div>
  );
}
