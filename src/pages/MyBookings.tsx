/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Ticket, ShieldAlert, CheckCircle, Edit, Trash2, XCircle, HeartHandshake, Utensils, Accessibility, AlertCircle } from 'lucide-react';
import { Booking, PaymentStatus } from '../types';
import { apiFetch } from '../lib/api';
import LoadingOverlay from '../components/LoadingOverlay';

interface MyBookingsProps {
  setCurrentRoute: (route: string) => void;
  setSelectedEventSlug: (slug: string) => void;
}

export default function MyBookings({
  setCurrentRoute,
  setSelectedEventSlug,
}: MyBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dialog States
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [payingBooking, setPayingBooking] = useState<Booking | null>(null);
  const [prefFormId, setPrefFormId] = useState<string | null>(null);
  const [cashfreeConfig, setCashfreeConfig] = useState<{configured: boolean, app_id: string | null, environment: string}>({configured: false, app_id: null, environment: 'SANDBOX'});
  const [activePass, setActivePass] = useState<Booking | null>(null);

  // Preference fields state
  const [dietary, setDietary] = useState('');
  const [rolePreference, setRolePreference] = useState('');
  const [accessibility, setAccessibility] = useState('');
  
  // Status feedback states
  const [submittingPref, setSubmittingPref] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchBookings = () => {
    if (bookings.length === 0) setIsLoading(true);
    apiFetch('/api/bookings/my')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load bookings');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBookings(data);
        } else {
          console.error("Invalid bookings format (expected array):", data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch bookings:", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(() => {
      apiFetch('/api/bookings/my')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setBookings(data);
          }
        })
        .catch(() => {});
    }, 120000);
    apiFetch('/api/config/cashfree').then(r => r.json()).then(data => {
      setCashfreeConfig(data);
    }).catch(() => {});
    return () => clearInterval(interval);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  const handleCompletePayment = async (booking: Booking) => {
    setPayingBooking(booking);
  };

  const loadCashfreeScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Cashfree) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const submitCashfreePayment = async () => {
    if (!payingBooking || !cashfreeConfig.configured) {
      triggerToast("Missing booking or Cashfree configuration");
      return;
    }
    
    setSubmittingPayment(true);
    const res = await loadCashfreeScript();
    if (!res) {
      triggerToast('Failed to load Cashfree SDK. Check your connection.');
      setSubmittingPayment(false);
      return;
    }

    try {
      const orderData = await apiFetch(`/api/bookings/${payingBooking.id}/cashfree-order`, { method: 'POST' }).then(r => r.json());
      if (orderData.error) {
        triggerToast(orderData.error);
        setSubmittingPayment(false);
        return;
      }

      const cashfree = (window as any).Cashfree({
        mode: cashfreeConfig.environment === 'PRODUCTION' ? 'production' : 'sandbox'
      });

      const checkoutOptions = {
        paymentSessionId: orderData.payment_session_id,
        redirectTarget: "_modal",
      };

      cashfree.checkout(checkoutOptions).then(async (result: any) => {
        if (result.error) {
          console.error("Cashfree checkout error:", result.error);
          triggerToast(result.error.message || 'Payment cancelled or failed.');
          setSubmittingPayment(false);
        } else if (result.paymentDetails) {
          try {
            const verifyRes = await apiFetch(`/api/bookings/${payingBooking.id}/verify-cashfree`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: orderData.cf_order_id
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              triggerToast('Payment Completed! Your tickets are active.');
              setPayingBooking(null);
              fetchBookings();
            } else {
              triggerToast(verifyData.error || 'Payment verification failed.');
            }
          } catch (e) {
            triggerToast('Payment verification failed.');
          } finally {
            setSubmittingPayment(false);
          }
        } else if (result.redirect) {
          console.log("Redirecting to Cashfree checkout...");
        }
      }).catch((err: any) => {
        console.error("Cashfree checkout exception:", err);
        triggerToast('Failed to initialize Cashfree checkout: ' + err.message);
        setSubmittingPayment(false);
      });
    } catch (err: any) {
      console.error("Error initializing Cashfree", err);
      triggerToast('Failed to initialize Cashfree checkout: ' + err.message);
      setSubmittingPayment(false);
    }
  };

  const handleSimulatedPayment = async () => {
    if (!payingBooking) return;
    setSubmittingPayment(true);
    try {
      const response = await apiFetch(`/api/bookings/${payingBooking.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_ref: `sim_${Date.now()}` })
      });
      if (!response.ok) {
        throw new Error('Payment failed');
      }
      triggerToast('Simulated Payment Successful! Your reservation is active.');
      setPayingBooking(null);
      fetchBookings();
    } catch (err) {
      triggerToast('Simulated payment failed.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!confirmCancelId) return;
    setSubmittingCancel(true);
    try {
      const response = await apiFetch(`/api/bookings/${confirmCancelId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Could not cancel booking');
      }
      triggerToast('Booking successfully cancelled. Refund issued.');
      setConfirmCancelId(null);
      fetchBookings();
    } catch (err) {
      triggerToast('Could not cancel this booking.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent, bookingId: string) => {
    e.preventDefault();
    setSubmittingPref(true);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dietary, role_preference: rolePreference, accessibility }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }

      triggerToast('Preferences saved successfully.');
      setPrefFormId(null);
      fetchBookings();
    } catch (err) {
      triggerToast('Could not save preferences.');
    } finally {
      setSubmittingPref(false);
    }
  };

  const openPrefForm = (booking: Booking) => {
    setPrefFormId(booking.id);
    setDietary(booking.dietary || '');
    setRolePreference(booking.role_preference || '');
    setAccessibility(booking.accessibility || '');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatPrice = (cents: number) => {
    return `₹${Math.round(cents / 100).toLocaleString()}`;
  };

  const isEventPassed = (dateStr: string) => {
    if (!dateStr) return false;
    const eventDate = new Date(dateStr);
    const today = new Date();
    eventDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return eventDate < today;
  };

  return (
    <div className="py-16 md:py-24 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
      
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div id="toast-banner" className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border border-neutral-800 dark:border-neutral-200 py-3.5 px-5 font-mono text-xs flex items-center space-x-3 transition-transform duration-300 shadow-md">
          <CheckCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 pb-10 mb-12 space-y-3">
        <h1 className="font-serif text-4xl md:text-6xl font-bold tracking-tight text-violet-600 dark:text-violet-500">
          My Bookings
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 font-light max-w-xl text-base leading-relaxed">
          Manage your reserved spots, complete payments, update guest preference sheets, and review admission codes.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
          <p className="font-mono text-xs tracking-wider text-neutral-400 uppercase">Retrieving your bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="border border-neutral-200 dark:border-neutral-800 py-24 text-center">
          <Ticket className="h-12 w-12 text-neutral-300 mx-auto mb-4 animate-bounce" />
          <p className="text-neutral-500 dark:text-neutral-400 font-light font-sans text-sm mb-6">
            You do not have any bookings registered under your account yet.
          </p>
          <button
            id="browse-experiences-bookings"
            onClick={() => setCurrentRoute('/events')}
            className="border border-neutral-950 dark:border-white px-6 py-2.5 text-xs font-mono tracking-widest uppercase hover:bg-neutral-950 hover:text-white dark:hover:bg-white dark:hover:text-neutral-950 transition-colors cursor-pointer"
          >
            Find Experiences
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {bookings.map((booking) => {
            const isCancelled = booking.cancelled_at !== null;
            const isPassed = isEventPassed(booking.event_date || '');
            
            return (
              <div
                key={booking.id}
                className={`border bg-white dark:bg-neutral-950 relative overflow-hidden transition-all duration-150 ${
                  isCancelled
                    ? 'border-neutral-200 dark:border-neutral-900 opacity-60'
                    : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-700'
                }`}
              >
                {/* Horizontal Layout Card */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 items-center">
                  
                  {/* Event Thumbnail */}
                  <div className="md:col-span-3 aspect-[4/3] bg-neutral-100 dark:bg-neutral-900 overflow-hidden border border-neutral-200 dark:border-neutral-800">
                    <img
                      src={booking.event_image_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600'}
                      alt={booking.event_title}
                      className="w-full h-full object-cover filter mix-blend-luminosity"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Booking Primary info */}
                  <div className="md:col-span-5 space-y-3 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      {isCancelled ? (
                        <span className="text-[9px] font-mono tracking-widest bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400 px-2 py-0.5 uppercase">
                          Cancelled
                        </span>
                      ) : isPassed ? (
                        <span className="text-[9px] font-mono tracking-widest bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400 px-2 py-0.5 uppercase">
                          Passed Event
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono tracking-widest bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 uppercase">
                          Upcoming Experience
                        </span>
                      )}

                      {/* Payment Badge */}
                      <span className={`text-[9px] font-mono tracking-widest px-2 py-0.5 uppercase ${
                        booking.payment_status === 'paid'
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : booking.payment_status === 'refunded'
                          ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400'
                      }`}>
                        {booking.payment_status}
                      </span>
                    </div>

                    <h3 
                      id={`booking-title-${booking.id}`}
                      className={`font-serif text-xl font-bold text-neutral-900 dark:text-white cursor-pointer hover:underline ${isCancelled ? 'line-through text-neutral-400 dark:text-neutral-600' : ''}`}
                      onClick={() => {
                        if (booking.event_slug) {
                          setSelectedEventSlug(booking.event_slug);
                          setCurrentRoute(`/events/${booking.event_slug}`);
                        }
                      }}
                    >
                      {booking.event_title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-400 font-mono">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(booking.event_date || '')}</span>
                      </span>
                    </div>

                    <div className="text-xs space-y-0.5 text-neutral-500 dark:text-neutral-400 font-light">
                      <p>Guest: <span className="font-semibold">{booking.guest_name}</span> ({booking.guest_email})</p>
                      <p>Tier: <span className="font-semibold capitalize">{booking.tier} Entry</span> × {booking.quantity}</p>
                      <p className="font-mono text-[11px] pt-1 text-neutral-400">Ref Code: <span className="font-bold text-neutral-900 dark:text-white">{booking.id.split('-')[0].toUpperCase()}</span></p>
                    </div>
                  </div>

                  {/* Payment Summary / Action buttons */}
                  <div className="md:col-span-4 flex flex-col items-stretch md:items-end justify-center space-y-3.5 pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-900">
                    <div className="text-left md:text-right flex items-center justify-between md:justify-end gap-4 w-full">
                      {booking.payment_status === 'paid' && !isCancelled && !isPassed && (
                        <div 
                          onClick={() => setActivePass(booking)}
                          className="bg-white p-2 border border-neutral-200 cursor-pointer hover:scale-105 transition-all duration-150 flex flex-col items-center group shrink-0"
                          title="Click to enlarge"
                        >
                          <QRCodeSVG value={`ZYRON-TICKET-${booking.id}`} size={96} level="Q" />
                          <span className="text-[8px] font-mono text-neutral-400 mt-1 uppercase tracking-wider group-hover:text-neutral-900 transition-colors">Tap to expand</span>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-mono text-neutral-400 uppercase">Paid Amount</p>
                        <p className="font-serif text-xl font-bold text-neutral-900 dark:text-white">
                          {formatPrice(booking.total_cents)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 w-full">
                      {/* Active Actions */}
                      {!isCancelled && !isPassed && (
                        <>
                          {booking.payment_status === 'pending' && (
                            <button
                              id={`pay-btn-${booking.id}`}
                              onClick={() => handleCompletePayment(booking)}
                              className="w-full bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-2.5 text-xs font-semibold tracking-widest uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                            >
                              Complete Payment
                            </button>
                          )}

                          {booking.payment_status === 'paid' && (
                            <div className="flex flex-col gap-1.5 w-full">
                              <button
                                id={`view-ticket-btn-${booking.id}`}
                                onClick={() => setActivePass(booking)}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white py-2.5 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                              >
                                <Ticket className="h-4 w-4" />
                                <span>View Admission Ticket</span>
                              </button>
                            </div>
                          )}

                          <div className="flex w-full">
                            <button
                              id={`pref-btn-${booking.id}`}
                              onClick={() => openPrefForm(booking)}
                              className="w-full flex items-center justify-center space-x-1 border border-neutral-200 dark:border-neutral-800 hover:border-black dark:hover:border-white py-2 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5" />
                              <span>Preferences</span>
                            </button>
                          </div>
                        </>
                      )}

                      {/* Cancelled placeholder */}
                      {isCancelled && (
                        <span className="text-center font-mono text-xs text-neutral-400 uppercase border border-neutral-100 dark:border-neutral-900 py-2.5">
                          Booking Cancelled
                        </span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Inline preferences checklist summaries */}
                {(booking.dietary || booking.role_preference || booking.accessibility) && !isCancelled && (
                  <div className="bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-100 dark:border-neutral-900 px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {booking.dietary && (
                      <span className="flex items-center space-x-1.5">
                        <Utensils className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Dietary: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{booking.dietary}</span></span>
                      </span>
                    )}
                    {booking.role_preference && (
                      <span className="flex items-center space-x-1.5">
                        <HeartHandshake className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Preference: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{booking.role_preference}</span></span>
                      </span>
                    )}
                    {booking.accessibility && (
                      <span className="flex items-center space-x-1.5">
                        <Accessibility className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Accessibility: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{booking.accessibility}</span></span>
                      </span>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Themed Interactive Simulated Payment Modal */}
      {payingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xs">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 max-w-md w-full p-6 md:p-8 space-y-6 text-left">
            <div className="space-y-2">
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white">Checkout</h3>
              <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">Complete your reservation</p>
            </div>

            <div className="border border-neutral-100 dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-900/40 p-4 rounded-sm text-xs space-y-2 font-mono text-neutral-500 dark:text-neutral-400">
              <p>Booking ID: <span className="font-semibold text-neutral-800 dark:text-white">{payingBooking.id.substring(0, 18)}...</span></p>
              <p>Event: <span className="font-semibold text-neutral-800 dark:text-white">{payingBooking.event_title}</span></p>
              <p>Amount: <span className="font-bold text-neutral-900 dark:text-white">{formatPrice(payingBooking.total_cents)}</span></p>
            </div>

            <div className="space-y-4">
              {cashfreeConfig.configured ? (
                <div className="border border-green-200 dark:border-green-900/50 bg-green-50/20 dark:bg-green-900/10 p-3 flex items-start space-x-2.5 text-xs text-green-700 dark:text-green-400 font-sans">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Cashfree Web Gateway is ready to process your transaction securely.</span>
                </div>
              ) : (
                <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-900/10 p-3 flex items-start space-x-2.5 text-xs text-amber-700 dark:text-amber-400 font-sans">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Cashfree is not configured. Falling back to Developer Sandbox Mode.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                id="payment-modal-close-btn"
                onClick={() => setPayingBooking(null)}
                className="border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              {cashfreeConfig.configured ? (
                <button
                  id="payment-modal-pay-btn"
                  onClick={submitCashfreePayment}
                  className="bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 px-5 py-2 text-xs font-mono uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                >
                  Pay via Cashfree
                </button>
              ) : (
                <button
                  id="payment-modal-bypass-btn"
                  onClick={handleSimulatedPayment}
                  className="bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 px-5 py-2 text-xs font-mono uppercase transition-colors cursor-pointer"
                >
                  Simulate Sandboxed Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guest Preferences Sheet Form (Edit mode) */}
      {prefFormId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-xs">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 max-w-lg w-full p-6 md:p-8 space-y-6 text-left">
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-neutral-900 dark:text-white">Guest Preference Sheet</h3>
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">Curate your session experience</p>
            </div>

            <form onSubmit={(e) => handleSavePreferences(e, prefFormId)} className="space-y-4">
              <div className="space-y-1.5">
                <label id="pref-diet-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">DIETARY RESTRICTIONS</label>
                <textarea
                  id="pref-diet-input"
                  rows={2}
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder="Gluten Free, Vegan, Peanut allergies, etc."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label id="pref-role-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">ROLE / EXPERIENCE PREFERENCES</label>
                <textarea
                  id="pref-role-input"
                  rows={2}
                  value={rolePreference}
                  onChange={(e) => setRolePreference(e.target.value)}
                  placeholder="Prefer private lounges, main performance floor, front-row banquets, etc."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label id="pref-access-lbl" className="text-[10px] font-mono text-neutral-400 uppercase">ACCESSIBILITY NOTES (OPTIONAL)</label>
                <textarea
                  id="pref-access-input"
                  rows={2}
                  value={accessibility}
                  onChange={(e) => setAccessibility(e.target.value)}
                  placeholder="Wheelchair access, strobe lighting sensitivity, etc."
                  className="w-full border border-neutral-200 dark:border-neutral-800 bg-transparent px-3 py-2 text-sm text-neutral-800 dark:text-white rounded-none focus:border-neutral-900 dark:focus:border-white outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
                <button
                  id="pref-dismiss-btn"
                  type="button"
                  onClick={() => setPrefFormId(null)}
                  className="border border-neutral-200 dark:border-neutral-800 px-4 py-2 text-xs font-mono uppercase text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="pref-save-btn"
                  type="submit"
                  disabled={submittingPref}
                  className="bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 px-5 py-2 text-xs font-mono uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                >
                  {submittingPref ? 'Saving…' : 'Save Sheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Ticket Pass Modal */}
      {activePass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 max-w-sm w-full p-6 md:p-8 space-y-6 text-center relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-950 dark:bg-white"></div>
            
            <div className="space-y-1">
              <span className="text-[9px] font-mono uppercase bg-neutral-100 dark:bg-neutral-900 px-2 py-1 text-neutral-500 dark:text-neutral-400 tracking-widest">
                Official Admission Pass
              </span>
              <h3 className="font-serif text-xl font-bold text-neutral-900 dark:text-white pt-2 leading-tight">
                {activePass.event_title}
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                {formatDate(activePass.event_date || '')}
              </p>
            </div>

            {/* Huge high-contrast QR Code with high error correction level */}
            <div className="bg-white p-4 inline-block mx-auto border border-neutral-200 shadow-sm">
              <QRCodeSVG 
                value={`ZYRON-TICKET-${activePass.id}`} 
                size={220} 
                level="H" 
                includeMargin={true}
              />
            </div>

            <div className="space-y-3 font-mono text-xs text-neutral-500 dark:text-neutral-400 border-t border-b border-neutral-100 dark:border-neutral-900 py-4 text-left">
              <div className="flex justify-between">
                <span>HOLDER:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{activePass.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span>TIER:</span>
                <span className="font-semibold capitalize text-neutral-900 dark:text-white">{activePass.tier} Entry</span>
              </div>
              <div className="flex justify-between">
                <span>QUANTITY:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{activePass.quantity} Ticket(s)</span>
              </div>
              <div className="flex justify-between">
                <span>REF CODE:</span>
                <span className="font-bold text-neutral-900 dark:text-white">{activePass.id.split('-')[0].toUpperCase()}</span>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-sans text-neutral-400 leading-normal">
                Present this pass at the gate. The QR code contains your encrypted transaction key for admission check-in.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setActivePass(null)}
                  className="w-full bg-neutral-950 hover:bg-white text-white hover:text-neutral-950 border border-neutral-950 py-2.5 text-xs font-mono tracking-widest uppercase transition-all-150 dark:bg-white dark:hover:bg-neutral-950 dark:text-neutral-950 dark:hover:text-white dark:border-white cursor-pointer"
                >
                  Close Ticket Pass
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LoadingOverlay isVisible={submittingPayment} />
    </div>
  );
}
