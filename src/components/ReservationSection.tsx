import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Users, Ticket, CheckCircle2, ShieldCheck, Sparkles, Send, Tag, MessageSquare, AlertCircle } from 'lucide-react';
import { Event } from '../types';
import { apiFetch } from '../lib/api';

interface ReservationSectionProps {
  event: Event;
  onPassesLiveClick?: () => void;
  onAccessTokenVerified?: (reservation: any) => void;
}

export default function ReservationSection({
  event,
  onPassesLiveClick,
  onAccessTokenVerified
}: ReservationSectionProps) {
  // Phase 1 Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [passesCount, setPassesCount] = useState<number>(1);
  const [groupSize, setGroupSize] = useState<number>(1);
  const [couponCode, setCouponCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedReservation, setConfirmedReservation] = useState<any | null>(null);

  // Live Counter & Stats State
  const [reservedCount, setReservedCount] = useState<number>(event.reserved_count || 0);
  const limit = event.reservation_limit || 1000;
  const remainingSpots = Math.max(0, limit - reservedCount);

  // Phase 2 Access Token Input State
  const [accessTokenInput, setAccessTokenInput] = useState('');
  const [verifyingToken, setVerifyingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [verifiedReservation, setVerifiedReservation] = useState<any | null>(null);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  const isReservationMode = event.reservation_mode ?? true;

  // Poll live stats every 15 seconds
  useEffect(() => {
    const fetchStats = () => {
      apiFetch(`/api/reservations/stats/${event.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.reserved_count === 'number') {
            setReservedCount(data.reserved_count);
          }
        })
        .catch(() => {});
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [event.id]);

  // Calculate remaining countdown
  useEffect(() => {
    const deadlineStr = event.reservation_deadline || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const targetDate = new Date(deadlineStr).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [event.reservation_deadline]);

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !phone.trim() || !email.trim()) {
      setErrorMsg('Full Name, Phone Number, and Email are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          email: email.trim(),
          instagram_username: instagram.trim(),
          passes_count: passesCount,
          group_size: groupSize,
          coupon_code: couponCode.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Reservation submission failed.');
      }

      setConfirmedReservation(data.reservation);
      if (typeof data.reserved_count === 'number') {
        setReservedCount(data.reserved_count);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while confirming your reservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAccessToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessTokenInput.trim()) return;

    setVerifyingToken(true);
    setTokenError(null);

    try {
      const res = await apiFetch(`/api/reservations/check-token?token=${encodeURIComponent(accessTokenInput.trim())}&event_id=${event.id}`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid reservation token.');
      }

      setVerifiedReservation(data.reservation);
      if (onAccessTokenVerified) {
        onAccessTokenVerified(data.reservation);
      }
    } catch (err: any) {
      setTokenError(err.message || 'Verification failed. Please check your access token.');
    } finally {
      setVerifyingToken(false);
    }
  };

  const reservedPercent = Math.min(100, Math.round((reservedCount / limit) * 100));

  return (
    <div className="w-full bg-neutral-900/80 border border-violet-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden my-8">
      {/* Background Decorative Ambient Glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-violet-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {isReservationMode ? (
        /* ==================== PHASE 1: RESERVE YOUR SPOT ==================== */
        <div className="space-y-8 relative z-10">
          {/* Header & Status Badge */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-mono uppercase tracking-widest mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Status: Reservations Open</span>
              </div>
              <h2 className="font-serif text-2xl md:text-3xl font-bold text-white tracking-tight">
                Reserve Your Spot
              </h2>
              <p className="text-xs text-neutral-400 font-sans mt-1">
                Guarantee priority early access for <strong className="text-white">{event.title}</strong> before public sales open.
              </p>
            </div>

            <div className="bg-neutral-950/60 border border-white/10 rounded-xl p-4 flex items-center space-x-4">
              <Clock className="w-6 h-6 text-violet-400 shrink-0" />
              <div>
                <span className="text-[10px] font-mono uppercase text-neutral-400 block tracking-wider">
                  Reservations Close In
                </span>
                <div className="font-mono text-sm md:text-base font-bold text-white tracking-wider">
                  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                </div>
              </div>
            </div>
          </div>

          {/* Live Reserved Counter & Progress Bar */}
          <div className="bg-neutral-950/40 border border-white/5 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center text-xs font-mono">
              <div className="flex items-center space-x-2 text-neutral-300">
                <Users className="w-4 h-4 text-violet-400" />
                <span>Reserved Spots: <strong className="text-white text-sm">{reservedCount}</strong> / {limit}</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">
                {remainingSpots} Spots Left
              </span>
            </div>

            <div className="w-full bg-neutral-800/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/5">
              <div
                className="bg-gradient-to-r from-violet-600 to-fuchsia-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${reservedPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Confirmation View vs Form View */}
          <AnimatePresence mode="wait">
            {confirmedReservation ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-6 md:p-8 text-center space-y-6"
              >
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-2xl font-bold text-white">
                    Your reservation has been confirmed.
                  </h3>
                  <p className="text-sm text-emerald-300/90 font-sans max-w-md mx-auto">
                    You'll receive priority access before public ticket sales open.
                  </p>
                </div>

                <div className="bg-neutral-950/80 border border-white/10 rounded-xl p-4 max-w-md mx-auto text-left space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-neutral-400 border-b border-white/5 pb-2">
                    <span>RESERVATION ID:</span>
                    <span className="text-white">{confirmedReservation.id.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400 border-b border-white/5 pb-2">
                    <span>NAME:</span>
                    <span className="text-white">{confirmedReservation.full_name}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400 border-b border-white/5 pb-2">
                    <span>PASSES RESERVED:</span>
                    <span className="text-violet-400 font-bold">{confirmedReservation.passes_count}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>ACCESS TOKEN:</span>
                    <span className="text-emerald-400 font-bold font-mono tracking-wider">{confirmedReservation.access_token}</span>
                  </div>
                </div>

                <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl max-w-md mx-auto text-xs text-violet-200 space-y-1">
                  <p className="font-semibold">⚡ What Happens Next?</p>
                  <p className="text-neutral-300">
                    When reservations close in <strong>{timeLeft.days}d {timeLeft.hours}h</strong>, you will receive an <strong>SMS, WhatsApp, and Email</strong> with your private purchase link for 24-hour early access.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmitReservation}
                className="space-y-5"
              >
                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="rahul@example.com"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Instagram Username */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Instagram Username (Optional)</label>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      placeholder="@rahul_sharma"
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Number of Passes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Number of Passes *</label>
                    <select
                      value={passesCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setPassesCount(val);
                        if (groupSize < val) setGroupSize(val);
                      }}
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none transition-colors"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                        <option key={n} value={n} className="bg-neutral-900 text-white">
                          {n} Pass{n > 1 ? 'es' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group Size */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono uppercase text-neutral-300">Group Size *</label>
                    <select
                      value={groupSize}
                      onChange={(e) => setGroupSize(parseInt(e.target.value) || passesCount)}
                      className="w-full bg-neutral-950/80 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none transition-colors"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((n) => (
                        <option key={n} value={n} className="bg-neutral-900 text-white">
                          {n} Person{n > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reserve Now Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || remainingSpots <= 0}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3.5 px-6 rounded-lg text-sm tracking-wider uppercase font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Reserving...' : 'Reserve Now'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* ==================== PHASE 2: EVENT PASSES LIVE ==================== */
        <div className="space-y-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-widest mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Status: Event Passes Live</span>
              </div>
              <h2 className="font-serif text-3xl font-bold text-white tracking-tight">
                Event Passes Live
              </h2>
              <p className="text-xs text-neutral-400 font-sans mt-1 max-w-xl">
                Every reservation holder receives SMS, WhatsApp, and Email with a private purchase link. Reservation holders get <strong>24 hours of Early Access</strong> before public sales open to everyone.
              </p>
            </div>

            <button
              onClick={onPassesLiveClick}
              className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-mono text-sm font-bold tracking-widest uppercase px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 cursor-pointer shrink-0"
            >
              <Ticket className="w-5 h-5" />
              <span>Buy Pass</span>
            </button>
          </div>

          {/* Access Token Verification Box for Early Access */}
          <div className="bg-neutral-950/80 border border-violet-500/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-3 text-violet-300 font-mono text-xs uppercase tracking-wider">
              <ShieldCheck className="w-5 h-5 text-violet-400" />
              <span>Have a Private Reservation Access Token?</span>
            </div>

            {verifiedReservation ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-300 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Early Access Unlocked for {verifiedReservation.full_name}!</span>
                </div>
                <p className="text-neutral-300">
                  Reserved Passes: <strong>{verifiedReservation.passes_count}</strong>. Proceed to select your pass tier below.
                </p>
              </div>
            ) : (
              <form onSubmit={handleVerifyAccessToken} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={accessTokenInput}
                  onChange={(e) => setAccessTokenInput(e.target.value.toUpperCase())}
                  placeholder="Enter Access Token (e.g. RES-L9X8A1-4B2)"
                  className="flex-1 bg-neutral-900 border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 font-mono uppercase focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={verifyingToken || !accessTokenInput.trim()}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                >
                  {verifyingToken ? 'Verifying...' : 'Unlock Priority Pass'}
                </button>
              </form>
            )}

            {tokenError && (
              <p className="text-xs text-red-400 font-mono">{tokenError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
