/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Shield, BarChart3, CalendarDays, Users2, Image as ImageIcon, Plus, Edit, Trash2, XCircle, AlertCircle, TrendingUp, DollarSign, Ticket, RefreshCw, Layers, Download, Scan, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import QRScanner from '../components/QRScanner';
import { Event, Booking, GalleryItem, AdminAnalytics, User, TicketTier, EventStatus } from '../types';

interface AdminProps {
  user: User | null;
  events: Event[];
  refetchEvents: () => void;
  setCurrentRoute: (route: string) => void;
}

type AdminTab = 'analytics' | 'events' | 'guests' | 'gallery';

export default function Admin({
  user,
  events,
  refetchEvents,
  setCurrentRoute,
}: AdminProps) {
  // Gate check
  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-md py-24 px-4 text-center">
        <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h2 className="font-serif text-2xl font-bold text-neutral-900 dark:text-white mb-2">Admin Lock</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 font-light">
          This section is restricted to administrative orchestrators only. Access has been logged.
        </p>
        <button
          id="gate-back-home"
          onClick={() => setCurrentRoute('/')}
          className="border border-neutral-950 dark:border-white px-6 py-2.5 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
        >
          Return to Portal
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // General Status triggers
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ----------------- TAB 1: ANALYTICS STATE -----------------
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchAnalytics = () => {
    if (!analytics) setLoadingAnalytics(true);
    apiFetch('/api/admin/analytics')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setAnalytics(data);
        setLoadingAnalytics(false);
      })
      .catch(() => {
        setLoadingAnalytics(false);
        triggerToast('Could not load analytical metrics.');
      });
  };

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
      const interval = setInterval(fetchAnalytics, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // ----------------- TAB 2: EVENTS WORKSPACE -----------------
  const [adminEvents, setAdminEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Event Form State
  const [eventId, setEventId] = useState<string>(''); // blank for create
  const [eventTitle, setEventTitle] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [eventTeaser, setEventTeaser] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [eventCapacity, setEventCapacity] = useState<number>(100);
  const [generalPrice, setGeneralPrice] = useState<string>('0');
  const [vipPrice, setVipPrice] = useState<string>('0');
  const [groupPrice, setGroupPrice] = useState<string>('0');
  const [earlybirdPrice, setEarlybirdPrice] = useState<string>('0');
  const [couplePrice, setCouplePrice] = useState<string>('0');
  const [eventStatus, setEventStatus] = useState<EventStatus>('draft');
  const [savingEvent, setSavingEvent] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchAdminEvents = () => {
    if (adminEvents.length === 0) setLoadingEvents(true);
    apiFetch('/api/admin/events')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setAdminEvents(data);
        setLoadingEvents(false);
      })
      .catch(() => {
        setLoadingEvents(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'events') {
      fetchAdminEvents();
    }
  }, [activeTab]);

  const handleEditEventClick = (ev: Event) => {
    setEventId(ev.id);
    setEventTitle(ev.title);
    setEventSlug(ev.slug);
    setEventTeaser(ev.teaser || '');
    setEventDescription(ev.description || '');
    
    // Format date string for input: YYYY-MM-DDTHH:MM
    const dateObj = new Date(ev.event_date);
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
    setEventDate(localISOTime);
    
    setEventLocation(ev.location);
    setEventImageUrl(ev.image_url || '');
    setEventCapacity(ev.capacity);
    setGeneralPrice((ev.general_price_cents / 100).toString());
    setVipPrice((ev.vip_price_cents / 100).toString());
    setGroupPrice((ev.group_price_cents / 100).toString());
    setEarlybirdPrice((ev.earlybird_price_cents / 100 || 0).toString());
    setCouplePrice((ev.couple_price_cents / 100 || 0).toString());
    setEventStatus(ev.status);
  };

  const handleResetEventForm = () => {
    setEventId('');
    setEventTitle('');
    setEventSlug('');
    setEventTeaser('');
    setEventDescription('');
    setEventDate('');
    setEventLocation('');
    setEventImageUrl('');
    setEventCapacity(100);
    setGeneralPrice('0');
    setVipPrice('0');
    setGroupPrice('0');
    setEarlybirdPrice('0');
    setCouplePrice('0');
    setEventStatus('draft');
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle || !eventLocation || !eventDate || !eventCapacity) {
      triggerToast('Required fields are missing.');
      return;
    }

    setSavingEvent(true);
    try {
      const response = await apiFetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: eventId || undefined,
          title: eventTitle,
          slug: eventSlug || undefined,
          teaser: eventTeaser,
          description: eventDescription,
          event_date: new Date(eventDate).toISOString(),
          location: eventLocation,
          image_url: eventImageUrl,
          capacity: eventCapacity,
          general_price: parseFloat(generalPrice) || 0,
          vip_price: parseFloat(vipPrice) || 0,
          group_price: parseFloat(groupPrice) || 0,
          earlybird_price: parseFloat(earlybirdPrice) || 0,
          couple_price: parseFloat(couplePrice) || 0,
          status: eventStatus,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save event');
      }

      triggerToast(eventId ? 'Experience protocol updated.' : 'New experience registered.');
      handleResetEventForm();
      fetchAdminEvents();
      refetchEvents(); // Sync general public list too
    } catch (err: any) {
      triggerToast(err.message || 'Error saving event.');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteConfirmId) return;
    try {
      const response = await apiFetch(`/api/admin/events/${deleteConfirmId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete');
      }
      triggerToast('Event successfully deleted.');
      setDeleteConfirmId(null);
      fetchAdminEvents();
      refetchEvents();
    } catch (err: any) {
      triggerToast(err.message || 'Could not delete event.');
    }
  };

  // ----------------- TAB 3: GUESTS SHEET STATE -----------------
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guests, setGuests] = useState<Booking[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  
  const [showScanner, setShowScanner] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const requestCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      triggerToast('Camera permission granted! You can now scan.');
    } catch (err: any) {
      triggerToast('Camera permission denied or not available.');
    }
  };

  useEffect(() => {
    if (activeTab === 'guests' && events.length > 0) {
      // Auto-select first event if none selected
      if (!selectedEventId) {
        setSelectedEventId(events[0].id);
      }
    }
  }, [activeTab, events]);

  const handleCheckIn = async (qrValue: string) => {
    if (checkingIn) return;
    const cleanQr = qrValue.trim();

    let bookingId = '';
    if (cleanQr.startsWith('ZYRON-TICKET-')) {
      bookingId = cleanQr.replace('ZYRON-TICKET-', '');
    } else {
      bookingId = cleanQr;
    }

    if (!bookingId) {
      triggerToast(`Invalid ticket QR format: ${cleanQr}`);
      return;
    }
    setCheckingIn(true);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/checkin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        triggerToast(data.error || 'Check-in failed');
      } else {
        triggerToast(`Checked in ${data.booking.guest_name} successfully!`);
        fetchGuests(selectedEventId);
        // Keep scanner open briefly for user feedback, then close
        setTimeout(() => setShowScanner(false), 2000);
      }
    } catch (e: any) {
      triggerToast('Network error during check-in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleExportCSV = () => {
    if (guests.length === 0) return;
    const header = ['Ref', 'Name', 'Email', 'Phone', 'Tier', 'Qty', 'Payment', 'Dietary', 'Role', 'Accessibility', 'Checked In'];
    const rows = guests.map(g => [
      g.id.split('-')[0].toUpperCase(),
      `"${g.guest_name}"`,
      `"${g.guest_email}"`,
      `"${g.guest_phone || ''}"`,
      g.tier,
      g.quantity,
      g.payment_status,
      `"${g.dietary || ''}"`,
      `"${g.role_preference || ''}"`,
      `"${g.accessibility || ''}"`,
      g.checked_in ? 'Yes' : 'No'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `guests_${selectedEventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchGuests = (evId: string) => {
    if (!evId) return;
    if (guests.length === 0) setLoadingGuests(true);
    apiFetch(`/api/admin/events/${evId}/guests`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setGuests(data);
        setLoadingGuests(false);
      })
      .catch(() => {
        setLoadingGuests(false);
        triggerToast('Could not fetch guest ledger.');
      });
  };

  useEffect(() => {
    if (selectedEventId && activeTab === 'guests') {
      fetchGuests(selectedEventId);
      const interval = setInterval(() => fetchGuests(selectedEventId), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedEventId, activeTab]);

  // ----------------- TAB 4: GALLERY STATE -----------------
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  // Add item form state
  const [galleryImgUrl, setGalleryImgUrl] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryEventId, setGalleryEventId] = useState('');
  const [gallerySortOrder, setGallerySortOrder] = useState<number>(0);
  const [addingGallery, setAddingGallery] = useState(false);
  const [galleryDelId, setGalleryDelId] = useState<string | null>(null);

  const fetchGallery = () => {
    setLoadingGallery(true);
    apiFetch('/api/gallery')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setGallery(data);
        setLoadingGallery(false);
      })
      .catch(() => {
        setLoadingGallery(false);
      });
  };

  useEffect(() => {
    if (activeTab === 'gallery') {
      fetchGallery();
    }
  }, [activeTab]);

  const handleAddGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryImgUrl) {
      triggerToast('Image URL is required.');
      return;
    }
    setAddingGallery(true);
    try {
      const response = await apiFetch('/api/admin/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: galleryImgUrl,
          caption: galleryCaption,
          event_id: galleryEventId || undefined,
          sort_order: gallerySortOrder,
        }),
      });

      if (!response.ok) throw new Error();
      triggerToast('Visual index item uploaded.');
      setGalleryImgUrl('');
      setGalleryCaption('');
      setGalleryEventId('');
      setGallerySortOrder(0);
      fetchGallery();
    } catch (err) {
      triggerToast('Could not register gallery item.');
    } finally {
      setAddingGallery(false);
    }
  };

  const handleDeleteGalleryItem = async () => {
    if (!galleryDelId) return;
    try {
      const response = await apiFetch(`/api/admin/gallery/${galleryDelId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error();
      triggerToast('Gallery item removed.');
      setGalleryDelId(null);
      fetchGallery();
    } catch (err) {
      triggerToast('Could not remove gallery item.');
    }
  };

  const formatPrice = (cents: number) => {
    return `₹${Math.round(cents / 100).toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="py-12 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
      
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div id="admin-toast-banner" className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border border-neutral-800 dark:border-neutral-200 py-3.5 px-5 font-mono text-xs flex items-center space-x-3 transition-transform duration-300 shadow-md">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Admin Title bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8 mb-10 flex flex-col md:flex-row items-baseline justify-between gap-4">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
            Control Portal
          </h1>
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
            <span className="text-violet-600 dark:text-violet-500 font-bold">Zyron</span> Productions Admin Workspace • Authenticated as: {user.email}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border border-neutral-200 dark:border-neutral-800 p-1 bg-neutral-50 dark:bg-neutral-900">
          {[
            { id: 'analytics', label: 'Metrics', icon: BarChart3 },
            { id: 'events', label: 'Events', icon: CalendarDays },
            { id: 'guests', label: 'Guests', icon: Users2 },
            { id: 'gallery', label: 'Gallery', icon: ImageIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                id={`admin-tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as AdminTab);
                }}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold'
                    : 'text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* -------------------- TAB 1: METRICS / ANALYTICS -------------------- */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {loadingAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="border border-neutral-200 dark:border-neutral-900 p-6 space-y-3 h-28 animate-pulse bg-neutral-50/20"></div>
              ))}
            </div>
          ) : !analytics ? (
            <div className="text-center py-12 text-neutral-400 font-light text-sm">Failed to resolve metrics.</div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Total Revenue */}
                <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <div className="flex items-center justify-between text-neutral-400 font-mono text-[10px] tracking-wider uppercase mb-3">
                    <span>Revenue (Paid)</span>
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
                    {formatPrice(analytics.totalRevenueCents)}
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-2">Conversion: ₹ Cents base</p>
                </div>

                {/* Paid Bookings */}
                <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <div className="flex items-center justify-between text-neutral-400 font-mono text-[10px] tracking-wider uppercase mb-3">
                    <span>Bookings Count</span>
                    <Layers className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
                    {analytics.paidBookingsCount}
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-2">Unique successful checkouts</p>
                </div>

                {/* Tickets Sold vs Capacity */}
                <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <div className="flex items-center justify-between text-neutral-400 font-mono text-[10px] tracking-wider uppercase mb-3">
                    <span>Tickets / Seats</span>
                    <Ticket className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
                    {analytics.ticketsSold} / {analytics.totalCapacity}
                  </h3>
                  <div className="mt-2.5 w-full bg-neutral-100 dark:bg-neutral-900 h-1.5 rounded-none">
                    <div
                      className="bg-neutral-950 dark:bg-white h-full"
                      style={{ width: `${Math.min(100, (analytics.ticketsSold / (analytics.totalCapacity || 1)) * 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-1.5">
                    {analytics.totalCapacity > 0 ? Math.round((analytics.ticketsSold / analytics.totalCapacity) * 100) : 0}% seat conversion rate
                  </p>
                </div>

                {/* Repeat buyer rate */}
                <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
                  <div className="flex items-center justify-between text-neutral-400 font-mono text-[10px] tracking-wider uppercase mb-3">
                    <span>Repeat Buyer Rate</span>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <h3 className="font-serif text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
                    {analytics.repeatBuyerRate}%
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-2">Patrons buying multiple sessions</p>
                </div>

              </div>

              {/* Tier breakdowns and Event ledger */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Event table & Chart */}
                <div className="lg:col-span-8 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-8">
                  <div className="space-y-4">
                    <h4 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Revenue Trends</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.eventStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                          <XAxis dataKey="title" tick={{ fontSize: 10, fontFamily: 'monospace' }} tickMargin={10} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} tickFormatter={(val) => `₹${val/100}`} axisLine={false} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }} 
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', fontSize: '12px', fontFamily: 'monospace' }}
                            formatter={(value: number) => [`₹${value/100}`, 'Revenue']}
                          />
                          <Bar dataKey="revenueCents" fill="#171717" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-neutral-900">
                    <h4 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Experience Conversion ledger</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="border-b border-neutral-100 dark:border-neutral-900 text-neutral-400">
                          <tr>
                            <th className="py-3 font-normal">EVENT</th>
                            <th className="py-3 font-normal">DATE</th>
                            <th className="py-3 font-normal text-right">SEATS</th>
                            <th className="py-3 font-normal text-right">REVENUE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                          {analytics.eventStats.map((st) => (
                            <tr key={st.id} className="text-neutral-800 dark:text-neutral-200">
                              <td className="py-3.5 font-sans font-medium text-neutral-950 dark:text-white">{st.title}</td>
                              <td className="py-3.5">{formatDate(st.event_date)}</td>
                              <td className="py-3.5 text-right font-bold">{st.tickets_sold} / {st.capacity}</td>
                              <td className="py-3.5 text-right font-bold">{formatPrice(st.revenueCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Tier breakdown layout */}
                <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
                  <h4 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Tier Demographics</h4>
                  
                  <div className="space-y-4 font-mono text-xs">
                    {[
                      { label: 'General Admission', value: analytics.tierBreakdown.general, color: 'bg-neutral-950 dark:bg-white' },
                      { label: 'Earlybird Pass', value: analytics.tierBreakdown.earlybird, color: 'bg-neutral-700 dark:bg-neutral-300' },
                      { label: 'Couple Pass', value: analytics.tierBreakdown.couple, color: 'bg-neutral-500 dark:bg-neutral-500' },
                      { label: 'VIP Pass Tier', value: analytics.tierBreakdown.vip, color: 'bg-neutral-400 dark:bg-neutral-600' },
                      { label: 'Group Cabin Tier', value: analytics.tierBreakdown.group, color: 'bg-neutral-200 dark:bg-neutral-800' },
                    ].map((tr) => (
                      <div key={tr.label} className="space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-neutral-500">{tr.label}</span>
                          <span className="font-bold text-neutral-950 dark:text-white">{tr.value} sold</span>
                        </div>
                        <div className="w-full bg-neutral-100 dark:bg-neutral-900 h-2.5 rounded-none">
                          <div
                            className={`h-full ${tr.color}`}
                            style={{
                              width: `${
                                analytics.ticketsSold > 0
                                  ? (tr.value / analytics.ticketsSold) * 100
                                  : 0
                              }%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>
      )}

      {/* -------------------- TAB 2: EVENTS WORKSPACE -------------------- */}
      {activeTab === 'events' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Form Panel */}
          <div className="lg:col-span-5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6 h-fit">
            <div className="space-y-1">
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">
                {eventId ? 'Edit Experience protocol' : 'Orchestrate new event'}
              </h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                {eventId ? `UPDATING EXP ID: ${eventId.substring(0, 8).toUpperCase()}` : 'REGISTER IN THE LIVE DIRECTORY'}
              </p>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4 font-sans text-xs">
              {/* Event Title */}
              <div className="space-y-1">
                <label id="form-title-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">TITLE *</label>
                <input
                  id="form-title-input"
                  type="text"
                  required
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="The Velvet Eclipse"
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none focus:border-neutral-950 dark:focus:border-white outline-none"
                />
              </div>

              {/* Event Slug (optional) */}
              <div className="space-y-1">
                <label id="form-slug-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">SLUG (OPTIONAL)</label>
                <input
                  id="form-slug-input"
                  type="text"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  placeholder="the-velvet-eclipse"
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none focus:border-neutral-950 dark:focus:border-white outline-none"
                />
              </div>

              {/* Teaser */}
              <div className="space-y-1">
                <label id="form-teaser-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">TEASER *</label>
                <input
                  id="form-teaser-input"
                  type="text"
                  required
                  value={eventTeaser}
                  onChange={(e) => setEventTeaser(e.target.value)}
                  placeholder="A slow-tempo dark electronic ballroom session..."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none focus:border-neutral-950 dark:focus:border-white outline-none"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label id="form-desc-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">FULL PROTOCOL SPECIFICATION *</label>
                <textarea
                  id="form-desc-input"
                  rows={4}
                  required
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Full structural description of themes, artists, protocols..."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none focus:border-neutral-950 dark:focus:border-white outline-none resize-none"
                />
              </div>

              {/* Date & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label id="form-date-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">DATE &amp; TIME *</label>
                  <input
                    id="form-date-input"
                    type="datetime-local"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-loc-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">LOCATION *</label>
                  <input
                    id="form-loc-input"
                    type="text"
                    required
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Mansion No. 9, Mumbai"
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Image URL & Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label id="form-img-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">IMAGE URL</label>
                  <input
                    id="form-img-input"
                    type="text"
                    value={eventImageUrl}
                    onChange={(e) => setEventImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-cap-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">CAPACITY *</label>
                  <input
                    id="form-cap-input"
                    type="number"
                    required
                    min={1}
                    max={10000}
                    value={eventCapacity}
                    onChange={(e) => setEventCapacity(parseInt(e.target.value) || 100)}
                    placeholder="150"
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Prices in ₹ */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label id="form-gen-p-lbl" className="text-[9px] font-mono text-neutral-400 uppercase">GENERAL (₹) *</label>
                  <input
                    id="form-gen-p-input"
                    type="number"
                    required
                    min={0}
                    value={generalPrice}
                    onChange={(e) => setGeneralPrice(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-eb-p-lbl" className="text-[9px] font-mono text-neutral-400 uppercase">EARLYBIRD (₹)</label>
                  <input
                    id="form-eb-p-input"
                    type="number"
                    min={0}
                    value={earlybirdPrice}
                    onChange={(e) => setEarlybirdPrice(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-cpl-p-lbl" className="text-[9px] font-mono text-neutral-400 uppercase">COUPLE (₹)</label>
                  <input
                    id="form-cpl-p-input"
                    type="number"
                    min={0}
                    value={couplePrice}
                    onChange={(e) => setCouplePrice(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-vip-p-lbl" className="text-[9px] font-mono text-neutral-400 uppercase">VIP (₹)</label>
                  <input
                    id="form-vip-p-input"
                    type="number"
                    min={0}
                    value={vipPrice}
                    onChange={(e) => setVipPrice(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label id="form-grp-p-lbl" className="text-[9px] font-mono text-neutral-400 uppercase">GROUP (₹)</label>
                  <input
                    id="form-grp-p-input"
                    type="number"
                    min={0}
                    value={groupPrice}
                    onChange={(e) => setGroupPrice(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1">
                <label id="form-status-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">DIRECTORY STATUS</label>
                <select
                  id="form-status-select"
                  value={eventStatus}
                  onChange={(e) => setEventStatus(e.target.value as EventStatus)}
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none"
                >
                  <option value="draft">Draft (Private / Invisible)</option>
                  <option value="published">Published (Public / Active Booking)</option>
                  <option value="archived">Archived (Ended / Lock History)</option>
                </select>
              </div>

              {/* Submit / Reset Actions */}
              <div className="flex gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-900">
                <button
                  id="form-reset-btn"
                  type="button"
                  onClick={handleResetEventForm}
                  className="flex-1 border border-neutral-200 dark:border-neutral-800 text-neutral-400 py-3 font-mono text-xs uppercase hover:text-neutral-950 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
                <button
                  id="form-submit-btn"
                  type="submit"
                  disabled={savingEvent}
                  className="flex-1 bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-3 font-mono text-xs uppercase tracking-widest transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                >
                  {savingEvent ? 'Saving…' : eventId ? 'Update Event' : 'Deploy Event'}
                </button>
              </div>

            </form>
          </div>

          {/* Right Events Ledger */}
          <div className="lg:col-span-7 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
            <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Active events directory</h3>
            
            {loadingEvents ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-900"></div>
                ))}
              </div>
            ) : adminEvents.length === 0 ? (
              <p className="text-xs text-neutral-400 font-mono text-center py-8">Directory is currently empty.</p>
            ) : (
              <div className="space-y-4">
                {adminEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="border border-neutral-100 dark:border-neutral-900 p-4 bg-neutral-50/40 dark:bg-neutral-900/20 flex items-center justify-between gap-4 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-serif text-sm font-semibold text-neutral-950 dark:text-white">{ev.title}</span>
                        <span className={`text-[8px] tracking-widest px-1.5 py-0.5 border ${
                          ev.status === 'published'
                            ? 'border-neutral-900 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                            : 'border-neutral-200 text-neutral-400 dark:border-neutral-800'
                        }`}>
                          {ev.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-1">{ev.location} • {formatDate(ev.event_date)}</p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">Tickets sold: <span className="font-bold text-neutral-800 dark:text-white">{ev.tickets_sold} / {ev.capacity}</span></p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        id={`edit-event-btn-${ev.id}`}
                        onClick={() => handleEditEventClick(ev)}
                        className="p-2 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                        title="Edit specifications"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        id={`delete-event-btn-${ev.id}`}
                        onClick={() => setDeleteConfirmId(ev.id)}
                        className="p-2 border border-red-200 hover:bg-red-50/10 text-red-600 transition-colors cursor-pointer"
                        title="Delete event permanently"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------- TAB 3: GUEST LEDGER -------------------- */}
      {activeTab === 'guests' && (
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-900 gap-4">
            <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Active admission Ledger</h3>
            
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              {/* Event selection dropdown */}
              <div className="flex items-center space-x-3">
                <span className="text-neutral-400">Select Event:</span>
                <select
                  id="guest-ledger-select"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 text-neutral-800 dark:text-white rounded-none outline-none"
                >
                  <option value="">-- Choose Experience --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({formatDate(ev.event_date)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              {selectedEventId && guests.length > 0 && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowScanner(!showScanner)}
                    className="flex items-center space-x-1.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-950 px-3 py-2 text-white hover:bg-neutral-800 transition-colors dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                  >
                    <Scan className="h-4 w-4" />
                    <span>Scan Ticket</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-1.5 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* QR Scanner Area */}
          {showScanner && (
            <div className="border border-neutral-200 dark:border-neutral-800 p-4 bg-neutral-50 dark:bg-neutral-900/50 flex flex-col items-center">
              <h4 className="font-mono text-sm uppercase tracking-wider mb-4">Scan QR Ticket</h4>
              <div className="w-full max-w-sm aspect-square bg-black overflow-hidden relative border border-neutral-800">
                <QRScanner 
                  onScan={(text) => {
                    if (text) {
                      handleCheckIn(text);
                    }
                  }} 
                />
                {checkingIn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm text-white font-mono text-xs uppercase z-10">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Processing...
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-col items-center space-y-2">
                <button
                  onClick={requestCameraPermission}
                  className="px-4 py-2 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-medium uppercase tracking-wider transition-colors hover:opacity-80"
                >
                  Request Camera Permission
                </button>
                <button 
                  onClick={() => setShowScanner(false)}
                  className="text-xs font-mono uppercase text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                >
                  Close Scanner
                </button>
              </div>
            </div>
          )}

          {loadingGuests ? (
            <div className="h-24 flex items-center justify-center font-mono text-xs text-neutral-400">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span>Resolving ledger rows…</span>
            </div>
          ) : guests.length === 0 ? (
            <p className="text-center text-xs font-mono text-neutral-400 py-12">No registered tickets found under this experience session.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-neutral-100 dark:border-neutral-900 text-neutral-400">
                  <tr>
                    <th className="py-3 font-normal">REF / HOLDER</th>
                    <th className="py-3 font-normal">EMAIL &amp; PHONE</th>
                    <th className="py-3 font-normal">TIER &amp; QTY</th>
                    <th className="py-3 font-normal">PAYMENT</th>
                    <th className="py-3 font-normal">PREFERENCE SHEET</th>
                    <th className="py-3 font-normal text-center">CHECK-IN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                  {guests.map((g) => {
                    const isCanceled = g.cancelled_at !== null;
                    return (
                      <tr key={g.id} className={`text-neutral-800 dark:text-neutral-200 ${isCanceled ? 'opacity-40 bg-neutral-50/20' : ''}`}>
                        <td className="py-4">
                          <span className="font-bold text-neutral-950 dark:text-white">{g.id.split('-')[0].toUpperCase()}</span>
                          <p className="font-sans font-medium text-[11px] text-neutral-500 mt-0.5">{g.guest_name}</p>
                        </td>
                        <td className="py-4">
                          <p>{g.guest_email}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{g.guest_phone || 'No phone'}</p>
                        </td>
                        <td className="py-4 font-bold capitalize">
                          {g.tier} × {g.quantity}
                        </td>
                        <td className="py-4">
                          <span className={`px-1.5 py-0.5 border text-[9px] uppercase ${
                            g.payment_status === 'paid'
                              ? 'border-neutral-900 bg-neutral-950 text-white dark:border-white dark:bg-white dark:text-neutral-950'
                              : isCanceled
                              ? 'border-neutral-100 text-neutral-400 dark:border-neutral-800'
                              : 'border-yellow-200 text-yellow-600'
                          }`}>
                            {g.payment_status}
                          </span>
                        </td>
                        <td className="py-4 max-w-xs space-y-1 text-[10px] font-sans font-light leading-normal">
                          {g.dietary && <p>• Dietary: <span className="font-semibold">{g.dietary}</span></p>}
                          {g.role_preference && <p>• Role Preference: <span className="font-semibold">{g.role_preference}</span></p>}
                          {g.accessibility && <p>• Accessibility: <span className="font-semibold">{g.accessibility}</span></p>}
                          {!g.dietary && !g.role_preference && !g.accessibility && <span className="text-neutral-400 font-mono">— None —</span>}
                        </td>
                        <td className="py-4 text-center">
                          {g.checked_in ? (
                            <div className="flex flex-col items-center justify-center text-green-600 dark:text-green-500">
                              <CheckCircle2 className="h-5 w-5 mb-1" />
                              <span className="text-[9px] uppercase">Scanned</span>
                            </div>
                          ) : (
                            <span className="text-neutral-300 dark:text-neutral-700 font-mono text-xl">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------- TAB 4: GALLERY MANAGEMENT -------------------- */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Form: Add item */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6 h-fit">
            <div className="space-y-1">
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Publish image</h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Register photos in visual index</p>
            </div>

            <form onSubmit={handleAddGalleryItem} className="space-y-4 font-sans text-xs">
              
              <div className="space-y-1">
                <label id="gallery-img-url-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">IMAGE URL *</label>
                <input
                  id="gallery-img-url-input"
                  type="text"
                  required
                  value={galleryImgUrl}
                  onChange={(e) => setGalleryImgUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                />
              </div>

              <div className="space-y-1">
                <label id="gallery-cap-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">CAPTION / CONTEXT</label>
                <input
                  id="gallery-cap-input"
                  type="text"
                  value={galleryCaption}
                  onChange={(e) => setGalleryCaption(e.target.value)}
                  placeholder="The opening shadows rehearsing in Delhi silos..."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label id="gallery-ev-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">LINK EXPERIENCE</label>
                  <select
                    id="gallery-ev-select"
                    value={galleryEventId}
                    onChange={(e) => setGalleryEventId(e.target.value)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  >
                    <option value="">No link</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label id="gallery-sort-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">SORT INDEX</label>
                  <input
                    id="gallery-sort-input"
                    type="number"
                    value={gallerySortOrder}
                    onChange={(e) => setGallerySortOrder(parseInt(e.target.value) || 0)}
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-neutral-800 dark:text-white rounded-none outline-none"
                  />
                </div>
              </div>

              <button
                id="gallery-submit-btn"
                type="submit"
                disabled={addingGallery}
                className="w-full bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-3 text-xs font-mono uppercase tracking-widest transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
              >
                {addingGallery ? 'Publishing…' : 'Publish to gallery'}
              </button>

            </form>
          </div>

          {/* Right ledger grid: lists items with Delete trigger */}
          <div className="lg:col-span-8 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
            <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Active Visual index</h3>
            
            {loadingGallery ? (
              <div className="grid grid-cols-3 gap-4 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="aspect-square bg-neutral-100 dark:bg-neutral-900"></div>
                ))}
              </div>
            ) : gallery.length === 0 ? (
              <p className="text-xs text-neutral-400 font-mono text-center py-8">Visual index ledger empty.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {gallery.map((item) => (
                  <div key={item.id} className="group relative aspect-square border border-neutral-100 dark:border-neutral-900 overflow-hidden bg-neutral-50">
                    <img
                      src={item.image_url}
                      alt={item.caption}
                      className="h-full w-full object-cover filter mix-blend-luminosity hover:mix-blend-normal transition-all duration-150"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Floating Delete trigger */}
                    <button
                      id={`del-gallery-item-${item.id}`}
                      onClick={() => setGalleryDelId(item.id)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 duration-150"
                      title="Delete photograph"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    
                    {item.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-neutral-950/80 p-2 text-[10px] text-neutral-300 line-clamp-1">
                        {item.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Confirmation Dialog: Delete Event permanently */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xs">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 max-w-md w-full p-6 md:p-8 space-y-6 text-left">
            <div className="flex items-start space-x-3 text-red-600">
              <Shield className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Delete Experience permanent?</h3>
                <p className="text-xs text-neutral-500 mt-1 font-light leading-relaxed">
                  Warning: Deleting this experience permanently removes its directory listings, linked bookings, and gallery photo relationships. This action is irreversible. To keep logs, consider changing status to archived instead.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                id="dialog-delete-dismiss"
                onClick={() => setDeleteConfirmId(null)}
                className="border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
              >
                No, Go Back
              </button>
              <button
                id="dialog-delete-confirm"
                onClick={handleDeleteEvent}
                className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-xs font-mono uppercase transition-colors cursor-pointer"
              >
                Yes, Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Gallery photograph */}
      {galleryDelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xs">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 max-w-md w-full p-6 md:p-8 space-y-6 text-left">
            <div className="flex items-start space-x-3 text-red-600">
              <Shield className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Remove photo?</h3>
                <p className="text-xs text-neutral-500 mt-1 font-light leading-relaxed">
                  Are you sure you want to delete this photograph from the public visual index gallery?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                id="gallery-del-cancel"
                onClick={() => setGalleryDelId(null)}
                className="border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="gallery-del-confirm"
                onClick={handleDeleteGalleryItem}
                className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-xs font-mono uppercase transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
