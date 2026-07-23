/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';
import { Shield, BarChart3, CalendarDays, Users2, Image as ImageIcon, Plus, Edit, Trash2, XCircle, AlertCircle, TrendingUp, DollarSign, Ticket, RefreshCw, Layers, Download, Scan, CheckCircle2, Mail, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import QRScanner from '../components/QRScanner';
import { Event, Booking, GalleryItem, AdminAnalytics, User, TicketTier, EventStatus } from '../types';

interface AdminProps {
  user: User | null;
  events: Event[];
  refetchEvents: () => void;
  setCurrentRoute: (route: string) => void;
}

type AdminTab = 'analytics' | 'payments' | 'events' | 'guests' | 'gallery' | 'coupons' | 'diagnostics';

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
      const interval = setInterval(fetchAnalytics, 120000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // ----------------- TAB: PAYMENT VERIFICATION (MVP WORKFLOW) -----------------
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actioningPaymentId, setActioningPaymentId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<{ [bookingId: string]: string }>({});
  const [autoApproveToggle, setAutoApproveToggle] = useState(false);
  const [runningAutoApprove, setRunningAutoApprove] = useState(false);
  const [scanningOcrId, setScanningOcrId] = useState<string | null>(null);

  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [triggeringReminders, setTriggeringReminders] = useState(false);

  const isAllSelected = pendingPayments.length > 0 && selectedBookingIds.length === pendingPayments.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBookingIds(pendingPayments.map((b) => b.id));
    } else {
      setSelectedBookingIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedBookingIds((prev) => [...prev, id]);
    } else {
      setSelectedBookingIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedBookingIds.length === 0) return;
    if (!confirm(`Are you sure you want to approve ${selectedBookingIds.length} selected booking(s)? Digital passes & WhatsApp notifications will be issued.`)) return;

    setBulkApproving(true);
    try {
      const res = await apiFetch('/api/admin/bookings/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedBookingIds }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Bulk-Approved ${data.approvedCount} booking(s)! Digital passes & WhatsApp notifications dispatched.`);
        setSelectedBookingIds([]);
        fetchPendingPayments();
        refetchEvents();
      } else {
        triggerToast(data.error || 'Bulk approval failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Bulk approval error.');
    } finally {
      setBulkApproving(false);
    }
  };

  const handleTriggerReminders = async () => {
    setTriggeringReminders(true);
    try {
      const res = await apiFetch('/api/admin/trigger-reminders', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`WhatsApp Reminders Triggered! Sent ${data.sent} reminder(s) out of ${data.checked} upcoming paid booking(s).`);
      } else {
        triggerToast(data.error || 'Trigger reminders failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Trigger reminders error.');
    } finally {
      setTriggeringReminders(false);
    }
  };

  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadAttendanceReport = async () => {
    setDownloadingReport(true);
    try {
      const res = await apiFetch('/api/admin/reports/attendance');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate report');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      triggerToast('Attendance Report exported successfully!');
    } catch (err: any) {
      triggerToast(err.message || 'Error downloading attendance report');
    } finally {
      setDownloadingReport(false);
    }
  };

  const fetchPendingPayments = () => {
    setLoadingPayments(true);
    apiFetch('/api/admin/pending-payments')
      .then((res) => res.json())
      .then((data) => {
        setPendingPayments(Array.isArray(data) ? data : []);
        setLoadingPayments(false);
      })
      .catch(() => setLoadingPayments(false));
  };

  const handleRunAutoApprove = async () => {
    setRunningAutoApprove(true);
    try {
      const res = await apiFetch('/api/admin/auto-approve', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`Auto-Approved ${data.approvedCount} bookings! ${data.flaggedCount} require manual review.`);
        fetchPendingPayments();
        refetchEvents();
      } else {
        triggerToast(data.error || 'Auto-approve process failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Auto-approve error.');
    } finally {
      setRunningAutoApprove(false);
    }
  };

  const handleScanOcr = async (bookingId: string) => {
    setScanningOcrId(bookingId);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/scan-ocr`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        triggerToast(`OCR Complete: Detected UTR ${data.ocrResult.detectedUtr || 'None'}`);
        fetchPendingPayments();
      } else {
        triggerToast(data.error || 'OCR scan failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'OCR scanning error.');
    } finally {
      setScanningOcrId(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchPendingPayments();
    }
  }, [activeTab]);

  const handleApprovePayment = async (bookingId: string) => {
    setActioningPaymentId(bookingId);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/approve`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('Booking approved! Ticket & QR code generated and sent.');
        fetchPendingPayments();
        refetchEvents();
      } else {
        triggerToast(data.error || 'Approval failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Error executing approval.');
    } finally {
      setActioningPaymentId(null);
    }
  };

  const handleRejectPayment = async (bookingId: string) => {
    const reason = rejectionReasons[bookingId] || 'Invalid payment proof or UTR mismatch';
    setActioningPaymentId(bookingId);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerToast('Booking rejected.');
        fetchPendingPayments();
      } else {
        triggerToast(data.error || 'Rejection failed.');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Error executing rejection.');
    } finally {
      setActioningPaymentId(null);
    }
  };

  // ----------------- TAB: COUPONS WORKSPACE -----------------
  const [couponsList, setCouponsList] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  // Coupon form state
  const [couponId, setCouponId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [couponEventId, setCouponEventId] = useState('');

  const fetchCoupons = () => {
    setLoadingCoupons(true);
    apiFetch('/api/admin/coupons')
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setCouponsList(data);
        setLoadingCoupons(false);
      })
      .catch(() => {
        setLoadingCoupons(false);
        triggerToast('Could not load coupon parameters.');
      });
  };

  useEffect(() => {
    if (activeTab === 'coupons') {
      fetchCoupons();
    }
  }, [activeTab]);

  const handleSaveCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !discountValue) {
      triggerToast('All mandatory fields must be completed.');
      return;
    }

    const payload = {
      id: couponId || undefined,
      code: couponCode,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses ? parseInt(maxUses) : null,
      event_id: couponEventId || null,
    };

    apiFetch('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save coupon.');
        }
        triggerToast('Coupon specification registered successfully.');
        setCouponId('');
        setCouponCode('');
        setDiscountType('percentage');
        setDiscountValue('');
        setMaxUses('');
        setCouponEventId('');
        fetchCoupons();
      })
      .catch((err) => {
        triggerToast(err.message || 'Could not serialize coupon records.');
      });
  };

  const handleToggleCoupon = (id: string) => {
    apiFetch(`/api/admin/coupons/${id}/toggle`, { method: 'POST' })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        triggerToast('Coupon status altered.');
        fetchCoupons();
      })
      .catch(() => {
        triggerToast('Failed to modify coupon status.');
      });
  };

  const handleDeleteCoupon = (id: string) => {
    if (!window.confirm('Delete coupon specification permanently? This cannot be undone.')) return;
    apiFetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        triggerToast('Coupon expunged.');
        fetchCoupons();
      })
      .catch(() => {
        triggerToast('Could not expunge coupon specification.');
      });
  };

  const handleEditCouponClick = (c: any) => {
    setCouponId(c.id);
    setCouponCode(c.code);
    setDiscountType(c.discount_type);
    setDiscountValue(c.discount_type === 'fixed' ? (c.discount_value / 100).toString() : c.discount_value.toString());
    setMaxUses(c.max_uses ? c.max_uses.toString() : '');
    setCouponEventId(c.event_id || '');
  };

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
  const [lastScanResult, setLastScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [manualNameInput, setManualNameInput] = useState('');
  const lastScannedRef = useRef<{ code: string; time: number } | null>(null);

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

    const now = Date.now();
    if (lastScannedRef.current && lastScannedRef.current.code === cleanQr && now - lastScannedRef.current.time < 3000) {
      // Ignore repeat scan during 3-second cooldown to avoid rapid double-submitting
      return;
    }
    lastScannedRef.current = { code: cleanQr, time: now };

    let bookingId = '';
    if (cleanQr.startsWith('ZYRON-TICKET-')) {
      bookingId = cleanQr.replace('ZYRON-TICKET-', '');
    } else {
      bookingId = cleanQr;
    }

    if (!bookingId) {
      setLastScanResult({ success: false, message: `Invalid ticket QR format: ${cleanQr}` });
      triggerToast(`Invalid ticket QR format: ${cleanQr}`);
      return;
    }
    setCheckingIn(true);
    setLastScanResult(null);
    try {
      const res = await apiFetch(`/api/admin/bookings/${bookingId}/checkin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setLastScanResult({ success: false, message: data.error || 'Check-in failed' });
        triggerToast(data.error || 'Check-in failed');
      } else {
        setLastScanResult({ success: true, message: `Successfully checked in ${data.booking.guest_name}!` });
        triggerToast(`Checked in ${data.booking.guest_name} successfully!`);
        fetchGuests(selectedEventId);
      }
    } catch (e: any) {
      setLastScanResult({ success: false, message: 'Network error during check-in' });
      triggerToast('Network error during check-in');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleManualCheckInByName = async () => {
    if (!manualNameInput.trim()) {
      triggerToast('Please enter a name to check in.');
      return;
    }
    const searchName = manualNameInput.trim().toLowerCase();
    const matchedBookings = guests.filter(
      (b) => b.guest_name.toLowerCase().includes(searchName) && b.cancelled_at === null
    );

    if (matchedBookings.length === 0) {
      setLastScanResult({ success: false, message: `No active reservation found for name "${manualNameInput}"` });
      triggerToast(`No active reservation found for "${manualNameInput}"`);
      return;
    }

    const pendingBooking = matchedBookings.find((b) => !b.checked_in);
    if (!pendingBooking) {
      const alreadyCheckedIn = matchedBookings[0];
      setLastScanResult({ success: false, message: `"${alreadyCheckedIn.guest_name}" is already checked in.` });
      triggerToast(`"${alreadyCheckedIn.guest_name}" is already checked in.`);
      return;
    }

    setCheckingIn(true);
    setLastScanResult(null);
    try {
      const res = await apiFetch(`/api/admin/bookings/${pendingBooking.id}/checkin`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setLastScanResult({ success: false, message: data.error || 'Manual check-in failed' });
        triggerToast(data.error || 'Manual check-in failed');
      } else {
        setLastScanResult({ success: true, message: `Successfully checked in ${data.booking.guest_name} manually!` });
        triggerToast(`Checked in ${data.booking.guest_name} successfully!`);
        setManualNameInput('');
        fetchGuests(selectedEventId);
      }
    } catch (e: any) {
      setLastScanResult({ success: false, message: 'Network error during check-in' });
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
      const interval = setInterval(() => fetchGuests(selectedEventId), 120000);
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

  // ----------------- TAB 5: E2E SMTP DIAGNOSTICS STATE -----------------
  const [testRecipient, setTestRecipient] = useState(user?.email || '');
  const [testingE2e, setTestingE2e] = useState(false);
  const [e2eResult, setE2eResult] = useState<any>(null);
  const [e2eError, setE2eError] = useState<string | null>(null);

  const handleRunE2eEmailTest = async () => {
    setTestingE2e(true);
    setE2eResult(null);
    setE2eError(null);
    try {
      const response = await apiFetch('/api/test/e2e-email-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testRecipient }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setE2eResult(data);
        triggerToast('SMTP test dispatched successfully!');
      } else {
        setE2eError(data.error || 'SMTP E2E Test execution failed.');
        triggerToast('E2E email test failed.');
      }
    } catch (err: any) {
      setE2eError(err.message || 'Network error executing E2E flow.');
      triggerToast('E2E email test failed.');
    } finally {
      setTestingE2e(false);
    }
  };

  const [resettingBookings, setResettingBookings] = useState(false);

  const handleResetAllBookings = async () => {
    if (!window.confirm("CRITICAL WARNING: This action will permanently DELETE all bookings/reservations from the database and RESET all event sold ticket counts to 0. This cannot be undone.\n\nDo you want to proceed?")) {
      return;
    }

    setResettingBookings(true);
    try {
      const response = await apiFetch('/api/admin/reset-bookings', {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Database reset failed.');
      }
      triggerToast('DATABASE RESET SUCCESSFUL: All bookings cleared.');
      refetchEvents();
      if (selectedEventId) {
        fetchGuests(selectedEventId);
      }
      fetchAdminEvents();
      fetchAnalytics();
    } catch (err: any) {
      triggerToast(err.message || 'Error executing database reset.');
    } finally {
      setResettingBookings(false);
    }
  };

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
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-8 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-serif text-3xl md:text-5xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              Control Portal
            </h1>
            <button
              onClick={handleDownloadAttendanceReport}
              disabled={downloadingReport}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 border border-emerald-500/30 shadow-sm"
              title="Export CSV of all confirmed bookings & entry timestamps"
            >
              <Download className={`h-4 w-4 ${downloadingReport ? 'animate-bounce' : ''}`} />
              <span>{downloadingReport ? 'Exporting Report...' : 'Download Attendance Report'}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
            <span className="text-violet-600 dark:text-violet-500 font-bold">Zyron</span> Productions Admin Workspace • Authenticated as: {user.email}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-hide border border-neutral-200 dark:border-neutral-800 p-1 bg-neutral-50 dark:bg-neutral-900 max-w-full">
          {[
            { id: 'analytics', label: 'Metrics', icon: BarChart3 },
            { id: 'payments', label: 'Pending Approvals', icon: CheckCircle2 },
            { id: 'events', label: 'Events', icon: CalendarDays },
            { id: 'guests', label: 'Guests', icon: Users2 },
            { id: 'gallery', label: 'Gallery', icon: ImageIcon },
            { id: 'coupons', label: 'Coupons', icon: Ticket },
            { id: 'diagnostics', label: 'SMTP & QR Test', icon: Mail },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                id={`admin-tab-btn-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as AdminTab);
                }}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
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

      {/* -------------------- TAB 2: PENDING APPROVALS & PAYMENT PROOF -------------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-neutral-950 p-6 border border-neutral-200 dark:border-neutral-800">
            <div>
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>Pending Payment Verification Queue</span>
                <span className="text-xs font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 px-2 py-0.5 uppercase">
                  {pendingPayments.length} Pending
                </span>
              </h3>
              <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1">
                Review submitted UPI transfer proofs, verify UTR transaction codes, check OCR validation, and approve or reject pass issuances.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Verify & Auto-Approve Toggle */}
              <div className="flex items-center space-x-2 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                <input
                  type="checkbox"
                  id="verify-auto-approve-toggle"
                  checked={autoApproveToggle}
                  onChange={(e) => setAutoApproveToggle(e.target.checked)}
                  className="accent-violet-600 h-4 w-4 cursor-pointer"
                />
                <label htmlFor="verify-auto-approve-toggle" className="text-xs font-mono font-semibold text-neutral-900 dark:text-white cursor-pointer select-none">
                  Verify & Auto-Approve
                </label>
              </div>

              {autoApproveToggle && (
                <button
                  onClick={handleRunAutoApprove}
                  disabled={runningAutoApprove || pendingPayments.length === 0}
                  className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-mono tracking-widest uppercase transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Scan className={`h-3.5 w-3.5 ${runningAutoApprove ? 'animate-spin' : ''}`} />
                  <span>{runningAutoApprove ? 'Processing...' : 'Run Auto-Approve Batch'}</span>
                </button>
              )}

              <button
                onClick={fetchPendingPayments}
                className="flex items-center space-x-2 border border-neutral-900 dark:border-white px-4 py-2 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPayments ? 'animate-spin' : ''}`} />
                <span>Refresh Queue</span>
              </button>
            </div>
          </div>

          {loadingPayments ? (
            <div className="p-12 text-center text-xs font-mono text-neutral-400 animate-pulse border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              Fetching pending payment submissions...
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="p-12 text-center border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">Queue Empty</p>
              <p className="text-xs text-neutral-500 font-mono">No pending payments requiring manual review at this moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bulk Actions Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-6 py-3 font-mono text-xs">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="select-all-payments"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="accent-violet-600 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="select-all-payments" className="font-semibold text-neutral-900 dark:text-white cursor-pointer select-none">
                    Select All ({pendingPayments.length})
                  </label>
                  {selectedBookingIds.length > 0 && (
                    <span className="text-violet-600 dark:text-violet-400 font-bold">
                      • {selectedBookingIds.length} Selected
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {selectedBookingIds.length > 0 && (
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkApproving}
                      className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className={`h-3.5 w-3.5 ${bulkApproving ? 'animate-spin' : ''}`} />
                      <span>{bulkApproving ? 'Approving...' : `Bulk Approve Selected (${selectedBookingIds.length})`}</span>
                    </button>
                  )}

                  <button
                    onClick={handleTriggerReminders}
                    disabled={triggeringReminders}
                    className="flex items-center space-x-1.5 border border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 px-3 py-2 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    title="Run background WhatsApp 24h event reminder check"
                  >
                    <Bell className={`h-3.5 w-3.5 ${triggeringReminders ? 'animate-spin' : ''}`} />
                    <span>{triggeringReminders ? 'Checking...' : 'Trigger 24h WhatsApp Reminders'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {pendingPayments.map((bk) => (
                  <div
                    key={bk.id}
                    className={`border p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start ${
                      bk.is_duplicate_utr || bk.has_amount_mismatch
                        ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/10'
                        : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
                    }`}
                  >
                    {/* Left: Booking & Guest details */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex justify-between items-start border-b border-neutral-100 dark:border-neutral-900 pb-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`select-booking-${bk.id}`}
                            checked={selectedBookingIds.includes(bk.id)}
                            onChange={(e) => handleSelectOne(bk.id, e.target.checked)}
                            className="accent-violet-600 h-4 w-4 cursor-pointer"
                          />
                          <div>
                            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">BOOKING REF</span>
                            <h4 className="font-mono text-base font-bold text-neutral-900 dark:text-white">{bk.id}</h4>
                          </div>
                        </div>
                      <span className="text-[10px] font-mono uppercase px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {bk.payment_status}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-neutral-600 dark:text-neutral-300">
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">EVENT</span>
                        <span className="font-sans font-semibold text-neutral-900 dark:text-white">{bk.event_title || bk.event_id}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">GUEST NAME</span>
                          <span className="font-semibold text-neutral-900 dark:text-white">{bk.guest_name}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">PHONE</span>
                          <span>{bk.guest_phone || 'N/A'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[10px] uppercase">EMAIL</span>
                        <span>{bk.guest_email}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-900">
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">PASS TIER</span>
                          <span className="uppercase font-bold">{bk.tier} ({bk.quantity}x)</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block text-[10px] uppercase">AMOUNT DUE</span>
                          <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(bk.total_cents || bk.total_price_cents)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Proof screenshot & UTR Verification */}
                  <div className="lg:col-span-4 space-y-4 border-t lg:border-t-0 lg:border-l border-neutral-100 dark:border-neutral-900 pt-4 lg:pt-0 lg:pl-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">
                          SUBMITTED UTR / TRANSACTION ID
                        </span>
                        <button
                          onClick={() => handleScanOcr(bk.id)}
                          disabled={scanningOcrId === bk.id || !bk.payment_proof_url}
                          className="text-[10px] font-mono text-violet-600 dark:text-violet-400 hover:underline flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                        >
                          <Scan className={`h-3 w-3 ${scanningOcrId === bk.id ? 'animate-spin' : ''}`} />
                          <span>{scanningOcrId === bk.id ? 'Scanning...' : 'Scan OCR'}</span>
                        </button>
                      </div>

                      <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 font-mono text-sm font-bold tracking-wider text-neutral-900 dark:text-white select-all">
                        {bk.utr || 'No UTR provided'}
                      </div>

                      {/* OCR Results Badge */}
                      {(bk.ocr_detected_utr || bk.ocr_detected_amount) && (
                        <div className="bg-violet-500/10 border border-violet-500/20 p-2.5 font-mono text-[11px] text-violet-700 dark:text-violet-300 space-y-1">
                          <div className="font-bold flex items-center space-x-1">
                            <Scan className="h-3.5 w-3.5" />
                            <span>OCR Scanner Detection:</span>
                          </div>
                          <div>Detected UTR: <strong>{bk.ocr_detected_utr || 'Not found'}</strong></div>
                          <div>Detected Amount: <strong>₹{bk.ocr_detected_amount || 0}</strong></div>
                        </div>
                      )}

                      {/* Warnings & Discrepancies */}
                      {bk.is_duplicate_utr && (
                        <div className="flex items-center space-x-1.5 text-xs text-red-600 dark:text-red-400 font-mono font-semibold bg-red-500/10 p-2 border border-red-500/20">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>DISCREPANCY: Duplicate UTR detected across multiple bookings!</span>
                        </div>
                      )}

                      {bk.has_amount_mismatch && (
                        <div className="flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400 font-mono font-semibold bg-amber-500/10 p-2 border border-amber-500/20">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>DISCREPANCY: Amount mismatch (Expected ₹{Math.round((bk.expected_total_cents || 0) / 100)})</span>
                        </div>
                      )}
                    </div>

                    {/* Proof Screenshot */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">
                        PAYMENT SCREENSHOT PROOF
                      </span>
                      {bk.payment_proof_url ? (
                        <div className="relative group border border-neutral-200 dark:border-neutral-800 overflow-hidden max-h-48 bg-neutral-900 flex items-center justify-center">
                          <img
                            src={bk.payment_proof_url}
                            alt="Payment Proof"
                            className="object-contain max-h-48 w-full cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(bk.payment_proof_url, '_blank')}
                          />
                          <a
                            href={bk.payment_proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 bg-neutral-950/80 text-white text-[10px] font-mono px-2 py-1 uppercase tracking-wider backdrop-blur-xs"
                          >
                            Open Full View ↗
                          </a>
                        </div>
                      ) : (
                        <div className="p-4 text-center font-mono text-xs text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-800">
                          No screenshot uploaded
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="lg:col-span-3 space-y-4 border-t lg:border-t-0 lg:border-l border-neutral-100 dark:border-neutral-900 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between h-full">
                    <div className="space-y-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">
                        ADMIN DECISION
                      </span>

                      <div>
                        <label className="text-[10px] font-mono uppercase text-neutral-400 block mb-1">
                          Rejection Reason (If rejecting)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. UTR mismatch / Invalid screenshot"
                          value={rejectionReasons[bk.id] || ''}
                          onChange={(e) =>
                            setRejectionReasons((prev) => ({ ...prev, [bk.id]: e.target.value }))
                          }
                          className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2 text-xs font-mono text-neutral-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      <button
                        onClick={() => handleApprovePayment(bk.id)}
                        disabled={actioningPaymentId === bk.id}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-xs font-mono tracking-widest uppercase transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{actioningPaymentId === bk.id ? 'Approving...' : 'Approve & Issue Pass'}</span>
                      </button>

                      <button
                        onClick={() => handleRejectPayment(bk.id)}
                        disabled={actioningPaymentId === bk.id}
                        className="w-full bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-600/30 py-2.5 text-xs font-mono tracking-widest uppercase transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Reject Booking</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )}
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
              <div className="flex items-center space-x-2">
                {selectedEventId && guests.length > 0 && (
                  <>
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
                      title="Export CSV for selected event"
                    >
                      <Download className="h-4 w-4" />
                      <span>Filtered CSV</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleDownloadAttendanceReport}
                  disabled={downloadingReport}
                  className="flex items-center space-x-1.5 border border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 transition-colors disabled:opacity-50 font-bold uppercase tracking-wider"
                  title="Download CSV report containing all confirmed bookings & entry timestamps"
                >
                  <Download className={`h-4 w-4 ${downloadingReport ? 'animate-bounce' : ''}`} />
                  <span>{downloadingReport ? 'Exporting...' : 'Attendance Report (All)'}</span>
                </button>
              </div>
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

              {lastScanResult && (
                <div className={`mt-4 w-full max-w-sm p-3 border font-mono text-xs uppercase flex items-start space-x-2.5 ${
                  lastScanResult.success 
                    ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-950 dark:bg-green-950/20 dark:text-green-400' 
                    : 'border-red-200 bg-red-50 text-red-800 dark:border-red-950 dark:bg-red-950/20 dark:text-red-400'
                }`}>
                  <div className="shrink-0 mt-0.5">
                    {lastScanResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <span>{lastScanResult.message}</span>
                </div>
              )}

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

              <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 w-full max-w-sm text-left">
                <h5 className="font-mono text-xs uppercase tracking-wider mb-2 text-neutral-400">Ask for guest name (Manual Check-In)</h5>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualNameInput}
                    onChange={(e) => setManualNameInput(e.target.value)}
                    placeholder="Enter guest name..."
                    className="flex-1 border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-xs text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualCheckInByName();
                      }
                    }}
                  />
                  <button
                    onClick={handleManualCheckInByName}
                    className="px-4 py-1.5 bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono uppercase tracking-wider transition-colors hover:opacity-80"
                  >
                    Check In
                  </button>
                </div>
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

      {/* -------------------- TAB: COUPON MANAGEMENT -------------------- */}
      {activeTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
          
          {/* Left Form: Create or Edit Coupon */}
          <div className="lg:col-span-4 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6 h-fit">
            <div className="space-y-1">
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">
                {couponId ? 'Edit specification' : 'Register coupon'}
              </h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                {couponId ? 'Modify coupon attributes' : 'Establish promotional codes'}
              </p>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4 font-sans text-xs">
              
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">COUPON CODE *</label>
                <input
                  type="text"
                  required
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ZYRON30, METADISCOUNT"
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">DISCOUNT TYPE *</label>
                <select
                  required
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono"
                >
                  <option value="percentage">Percentage Off (%)</option>
                  <option value="fixed">Fixed Off (₹)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">
                  {discountType === 'percentage' ? 'DISCOUNT PERCENTAGE *' : 'DISCOUNT AMOUNT (₹) *'}
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'e.g. 15 (for 15%)' : 'e.g. 500 (for ₹500 off)'}
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">MAXIMUM USAGES (OPTIONAL)</label>
                <input
                  type="number"
                  min="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="e.g. 100 (leave blank for unlimited)"
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">EXPERIENCE BINDING (OPTIONAL)</label>
                <select
                  value={couponEventId}
                  onChange={(e) => setCouponEventId(e.target.value)}
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono"
                >
                  <option value="">Apply to all experiences</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({formatDate(ev.event_date)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 border border-transparent py-3 text-xs font-mono uppercase tracking-widest transition-colors cursor-pointer"
                >
                  {couponId ? 'Save Changes' : 'Establish'}
                </button>
                {couponId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCouponId('');
                      setCouponCode('');
                      setDiscountType('percentage');
                      setDiscountValue('');
                      setMaxUses('');
                      setCouponEventId('');
                    }}
                    className="border border-neutral-200 dark:border-neutral-800 px-4 py-3 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </div>

          {/* Right ledger grid: lists active coupons */}
          <div className="lg:col-span-8 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
            <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Active Promotional Ledger</h3>
            
            {loadingCoupons ? (
              <div className="h-24 flex items-center justify-center font-mono text-xs text-neutral-400">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                <span>Resolving promotional indexes...</span>
              </div>
            ) : couponsList.length === 0 ? (
              <p className="text-xs text-neutral-400 font-mono text-center py-8">Promotional ledger is currently empty.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-neutral-100 dark:border-neutral-900 text-neutral-400">
                    <tr>
                      <th className="py-3 font-normal">CODE</th>
                      <th className="py-3 font-normal">DISCOUNT RATE</th>
                      <th className="py-3 font-normal">LIFETIME USAGES</th>
                      <th className="py-3 font-normal">SCOPE BINDING</th>
                      <th className="py-3 font-normal text-center">STATUS</th>
                      <th className="py-3 font-normal text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {couponsList.map((c) => {
                      const boundEvent = events.find((ev) => ev.id === c.event_id);
                      return (
                        <tr key={c.id} className="text-neutral-800 dark:text-neutral-200">
                          <td className="py-4">
                            <span className="font-bold text-neutral-950 dark:text-white bg-neutral-100 dark:bg-neutral-900 px-2 py-1 text-xs select-all">
                              {c.code}
                            </span>
                          </td>
                          <td className="py-4 font-bold">
                            {c.discount_type === 'percentage' ? `${c.discount_value}% Off` : `₹${(c.discount_value / 100).toLocaleString()} Off`}
                          </td>
                          <td className="py-4">
                            <span>{c.uses}</span>
                            <span className="text-neutral-400 font-light"> / {c.max_uses !== null && c.max_uses !== undefined ? c.max_uses : '∞'}</span>
                          </td>
                          <td className="py-4 max-w-[150px] truncate" title={boundEvent ? boundEvent.title : 'All Experiences'}>
                            {boundEvent ? (
                              <span className="text-violet-600 dark:text-violet-400">{boundEvent.title}</span>
                            ) : (
                              <span className="text-neutral-400 font-light">All experiences</span>
                            )}
                          </td>
                          <td className="py-4 text-center">
                            <button
                              onClick={() => handleToggleCoupon(c.id)}
                              className={`px-2 py-1 text-[9px] uppercase tracking-wider border cursor-pointer font-bold transition-all ${
                                c.active
                                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                                  : 'border-neutral-300 text-neutral-400 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40'
                              }`}
                            >
                              {c.active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleEditCouponClick(c)}
                                className="p-1.5 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                                title="Edit specifications"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(c.id)}
                                className="p-1.5 border border-red-200 hover:bg-red-50/10 text-red-600 transition-colors cursor-pointer"
                                title="Expunge coupon specification"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* -------------------- TAB 5: SMTP & QR CODE DIAGNOSTICS -------------------- */}
      {activeTab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Trigger Control */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
              <div className="space-y-1">
                <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-5 w-5 text-violet-600 dark:text-violet-500" />
                  Brevo &amp; QR Code Dispatcher
                </h3>
                <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">End-to-End Delivery Diagnostics</p>
              </div>

              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-light">
                This module triggers a live simulated reservation transaction, generates a secure unique entry credential, asserts/embeds the exact QR payload structure (<span className="font-mono text-neutral-900 dark:text-white font-semibold">ZYRON-TICKET-&lt;id&gt;</span>), and relays a full-stack HTML email via your configured Brevo REST API credentials.
              </p>

              <div className="space-y-4 font-sans text-xs pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-neutral-400 uppercase font-semibold">RECIPIENT TEST EMAIL</label>
                  <input
                    type="email"
                    required
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="e.g. sakethma007@gmail.com"
                    className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2.5 text-neutral-800 dark:text-white rounded-none outline-none focus:border-neutral-950 dark:focus:border-white font-mono"
                  />
                  <p className="text-[9px] text-neutral-400 italic font-mono">Defaults to your registered admin coordinate.</p>
                </div>

                <button
                  id="btn-trigger-e2e-diagnostic"
                  onClick={handleRunE2eEmailTest}
                  disabled={testingE2e}
                  className="w-full bg-violet-600 hover:bg-violet-700 text-white border border-transparent py-3 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {testingE2e ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Transmitting Relay...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Trigger E2E Verification</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Database Reset Protocol Card */}
            <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-red-600 dark:text-red-500 flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Database Reset Protocol
                </h3>
                <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Permanent Data Removal</p>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed font-light">
                This action permanently expunges all booking and reservation records from the system. It also resets the ticket counter on all experiences back to 0. Use with extreme caution.
              </p>
              <button
                id="btn-reset-all-bookings"
                onClick={handleResetAllBookings}
                disabled={resettingBookings}
                className="w-full bg-red-600 hover:bg-red-700 text-white border border-transparent py-2.5 text-xs font-mono uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
              >
                {resettingBookings ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Clearing All Data...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Reset All Bookings</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Live Logs, Payload Check & QR verification */}
          <div className="lg:col-span-7 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 space-y-6">
            <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <Scan className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              Real-Time Dispatch logs
            </h3>

            {testingE2e && (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-xs font-mono text-neutral-900 dark:text-white tracking-widest uppercase animate-pulse">ESTABLISHING BREVO DISPATCH...</p>
                  <p className="text-[10px] text-neutral-400 font-mono mt-1">Simulating live booking, payload injection and envelope relay</p>
                </div>
              </div>
            )}

            {!testingE2e && !e2eResult && !e2eError && (
              <div className="flex flex-col items-center justify-center py-24 border border-dashed border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-400 font-mono uppercase tracking-widest">SYSTEM STANDBY</p>
                <p className="text-[10px] text-neutral-500 font-light mt-1">Awaiting diagnostic trigger to evaluate email delivery pipeline</p>
              </div>
            )}

            {e2eError && (
              <div className="border border-red-200 dark:border-red-950/40 bg-red-50/50 dark:bg-red-950/10 p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span className="font-bold uppercase tracking-wider">BREVO DISPATCH TIMEOUT / ERROR</span>
                </div>
                <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed break-words">
                  {e2eError}
                </p>
                <div className="border-t border-red-100 dark:border-red-900/30 pt-3 text-[10px] text-neutral-500 leading-normal">
                  💡 Tip: Verify that the <span className="text-neutral-700 dark:text-white">BREVO_API_KEY</span> environment variable is active and correct in your environment variables configuration.
                </div>
              </div>
            )}

            {e2eResult && (
              <div className="space-y-6 font-mono text-xs text-neutral-800 dark:text-neutral-200">
                
                {/* Visual success alert */}
                {e2eResult.simulated ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-4 flex items-start space-x-3 text-amber-600 dark:text-amber-500">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold uppercase tracking-wider">E2E Simulation Mode Active</p>
                      <p className="text-[10px] text-amber-500/80 mt-0.5">Mock reservation processed &amp; persisted in the local directory, but live email was bypassed. Set the BREVO_API_KEY variable to enable real Brevo REST API mail dispatch.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 flex items-center space-x-3 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-bold uppercase tracking-wider">E2E Delivery Confirmed</p>
                      <p className="text-[10px] text-emerald-500/80 mt-0.5">Mock reservation processed and email relayed successfully.</p>
                    </div>
                  </div>
                )}

                {/* Grid for booking details and QR Code verification */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* QR rendering */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-900 p-4">
                    <p className="text-[9px] text-neutral-400 font-bold uppercase mb-2 tracking-wider">Live QR Payload</p>
                    <img
                      src={e2eResult.qr_code_url}
                      alt="Verified Admission QR"
                      className="w-36 h-36 border border-neutral-200 dark:border-neutral-800 p-2 bg-white"
                      referrerPolicy="no-referrer"
                    />
                    <div className="mt-3 text-[9px] text-center text-neutral-400 tracking-wider">
                      DATA PAYLOAD:
                      <p className="text-neutral-800 dark:text-white font-bold select-all break-all mt-0.5 max-w-[150px]">
                        {e2eResult.qr_code_payload}
                      </p>
                    </div>
                  </div>

                  {/* Booking details */}
                  <div className="md:col-span-7 space-y-3.5 border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-800 pt-4 md:pt-0 md:pl-6">
                    <h4 className="font-serif font-bold text-sm text-neutral-900 dark:text-white uppercase tracking-wider">
                      [1] Reservation payload
                    </h4>
                    
                    <div className="space-y-1.5 text-[11px]">
                      <p className="flex justify-between border-b border-neutral-100 dark:border-neutral-900/50 pb-1">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">ID:</span>
                        <span className="text-neutral-900 dark:text-white font-bold">{e2eResult.booking.id}</span>
                      </p>
                      <p className="flex justify-between border-b border-neutral-100 dark:border-neutral-900/50 pb-1">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">GUEST:</span>
                        <span className="text-neutral-900 dark:text-white font-bold">{e2eResult.booking.guest_name}</span>
                      </p>
                      <p className="flex justify-between border-b border-neutral-100 dark:border-neutral-900/50 pb-1">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">EMAIL:</span>
                        <span className="text-neutral-900 dark:text-white font-bold">{e2eResult.booking.guest_email}</span>
                      </p>
                      <p className="flex justify-between border-b border-neutral-100 dark:border-neutral-900/50 pb-1">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">PASS TIER:</span>
                        <span className="text-violet-600 dark:text-violet-400 font-bold uppercase">{e2eResult.booking.tier}</span>
                      </p>
                      <p className="flex justify-between border-b border-neutral-100 dark:border-neutral-900/50 pb-1">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">QUANTITY:</span>
                        <span className="text-neutral-900 dark:text-white font-bold">{e2eResult.booking.quantity}</span>
                      </p>
                      <p className="flex justify-between">
                        <span className="text-neutral-400 uppercase font-bold text-[9px]">TOTAL PAID:</span>
                        <span className="text-neutral-900 dark:text-white font-bold">₹{Math.round(e2eResult.booking.total_cents / 100).toLocaleString()}</span>
                      </p>
                    </div>
                  </div>

                </div>

                {/* Assertion validation */}
                <div className="border border-neutral-200 dark:border-neutral-800 p-4 space-y-2 bg-neutral-50 dark:bg-neutral-900/30">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    [2] QR Payload Integrity Assertion
                  </p>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-500">Assertion Match (ZYRON-TICKET-&lt;id&gt;):</span>
                    <span className="bg-emerald-500/20 text-emerald-600 px-2 py-0.5 font-bold rounded-none text-[10px] uppercase tracking-widest">
                      PASS
                    </span>
                  </div>
                </div>

                {/* SMTP Server details */}
                <div className="border border-neutral-200 dark:border-neutral-800 p-4 space-y-2 bg-neutral-950 text-neutral-300">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider border-b border-neutral-800 pb-1.5 flex justify-between items-center">
                    <span>[3] SMTP Envelope &amp; Handshake Logs</span>
                    {e2eResult.simulated ? (
                      <span className="text-[9px] text-amber-400 font-normal">● SIMULATED ENVELOPE</span>
                    ) : (
                      <span className="text-[9px] text-emerald-400 animate-pulse font-normal">● STABLE SHAKEHAND</span>
                    )}
                  </p>
                  
                  <div className="space-y-1.5 font-mono text-[10px]">
                    <p className="break-all text-neutral-400">
                      <strong className="text-neutral-200">SMTP Message-ID:</strong><br />
                      {e2eResult.smtp_response.messageId}
                    </p>
                    <p className="break-all text-neutral-400 mt-2">
                      <strong className="text-neutral-200">Mail Server Response:</strong><br />
                      <span className={e2eResult.simulated ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>{e2eResult.smtp_response.response}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4 mt-2 pt-2 border-t border-neutral-900">
                      <div>
                        <strong className="text-neutral-200 block text-[9px] text-neutral-400 uppercase">SENDER ENVELOPE</strong>
                        <span className="text-neutral-300 break-all">{e2eResult.smtp_response.envelope.from}</span>
                      </div>
                      <div>
                        <strong className="text-neutral-200 block text-[9px] text-neutral-400 uppercase">RECIPIENT ENVELOPE</strong>
                        <span className="text-neutral-300 break-all">{JSON.stringify(e2eResult.smtp_response.envelope.to)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* [4] Ticket Email Live Preview Frame */}
                {e2eResult.html && (
                  <div className="border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-neutral-50 dark:bg-neutral-900/20">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-800 pb-1.5 flex justify-between items-center">
                      <span>[4] Ticket Email Template Preview</span>
                      <span className="text-[8px] bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-1.5 py-0.5 font-normal">RENDERED TICKET</span>
                    </p>
                    <div className="border border-neutral-200 dark:border-neutral-800 bg-white overflow-hidden shadow-xs">
                      <iframe
                        title="HTML Ticket Email Preview"
                        srcDoc={e2eResult.html}
                        className="w-full h-[360px] border-none bg-white"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                )}

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
