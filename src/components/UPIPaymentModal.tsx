import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Upload, ArrowLeft, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { Booking } from '../types';
import { apiFetch } from '../lib/api';

interface UPIPaymentModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UPIPaymentModal({ booking, onClose, onSuccess }: UPIPaymentModalProps) {
  const [step, setStep] = useState<'qr' | 'proof' | 'submitted'>('qr');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<string>('');
  const [guestName, setGuestName] = useState(booking.guest_name || '');
  const [guestEmail, setGuestEmail] = useState(booking.guest_email || '');
  const [guestPhone, setGuestPhone] = useState(booking.guest_phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upiId = 'zyronproductions@axl';
  const payeeName = 'ZYRON PRODUCTIONS';
  const amountRs = Math.round(booking.total_cents / 100);
  const bookingDisplayId = booking.id.length > 10 ? `EVT${booking.id.substring(0, 6).toUpperCase()}` : booking.id.toUpperCase();
  const passTierName = (booking.tier || 'GENERAL').toUpperCase();
  const passQuantity = booking.quantity || 1;

  // Dynamic PhonePe & UPI Payment payload string matching selected pass amount
  const noteText = `Zyron ${passTierName} Pass x${passQuantity}`;
  const upiPayload = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amountRs}&tr=${bookingDisplayId}&tn=${encodeURIComponent(noteText)}&cu=INR`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setError('Image file size must be less than 8MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utr.trim()) {
      setError('Please enter your 12-digit UTR / Transaction Reference Number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/bookings/${booking.id}/submit-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          utr: utr.trim(),
          screenshot,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim(),
          guest_phone: guestPhone.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit payment proof.');
      }

      setStep('submitted');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Something went wrong while submitting proof.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md max-h-[90vh] my-auto bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-y-auto text-white font-sans">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-400">ZYRON UPI Payment Gateway</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP 1: Show UPI QR Code & Booking Details */}
        {step === 'qr' && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs font-mono uppercase text-purple-400 tracking-wider">Booking Reference</span>
              <h3 className="text-2xl font-mono font-bold tracking-tight text-white">{bookingDisplayId}</h3>
              <p className="text-sm text-neutral-400 font-light">{booking.event_title || 'Event Pass Access'}</p>
            </div>

            {/* Selected Pass Summary & Price Box */}
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-400 uppercase">Selected Pass</span>
                <span className="text-purple-300 font-bold uppercase">{passQuantity}x {passTierName} PASS</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                <span className="text-xs uppercase font-mono text-neutral-400">Total Amount</span>
                <span className="text-xl font-mono font-bold text-emerald-400">₹{amountRs.toLocaleString()}</span>
              </div>
            </div>

            {/* PhonePe Style Payment Poster Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-black border border-purple-900/50 rounded-2xl shadow-2xl text-white relative overflow-hidden space-y-4">
              
              {/* PhonePe Header */}
              <div className="flex flex-col items-center space-y-1.5 text-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#5f259f] flex items-center justify-center font-bold font-serif text-white text-lg shadow-md">
                    पे
                  </div>
                  <span className="text-xl font-bold tracking-tight font-sans text-white">PhonePe</span>
                </div>
                <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-purple-400">
                  ACCEPTED HERE
                </span>
                <span className="text-[11px] font-sans text-neutral-400 font-medium">
                  Scan any QR using PhonePe App
                </span>
              </div>

              {/* QR Box */}
              <div className="p-4 bg-white rounded-xl shadow-2xl relative text-black flex flex-col items-center">
                <QRCodeSVG
                  value={upiPayload}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
                {/* Center PhonePe Badge overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-9 h-9 rounded-full bg-[#1b102e] border-2 border-white flex items-center justify-center text-white font-serif font-bold text-sm shadow-lg">
                    पे
                  </div>
                </div>
              </div>

              {/* Account Holder Name */}
              <div className="text-center pt-1">
                <h4 className="font-mono text-sm font-extrabold uppercase tracking-widest text-neutral-100">
                  {payeeName}
                </h4>
                <p className="text-[10px] text-neutral-500 font-mono mt-1">
                  Verified Official Merchant UPI • {upiId}
                </p>
              </div>

            </div>

            {/* Quick App Launcher / Copy Strip */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono uppercase text-neutral-400 flex justify-between items-center">
                <span>Official Merchant VPA</span>
                <span className="text-purple-400 font-semibold">PhonePe / BHIM</span>
              </label>
              <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="font-mono text-xs font-semibold text-purple-300 truncate mr-2">{upiId}</span>
                <button
                  type="button"
                  onClick={copyUpiId}
                  className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer shrink-0"
                >
                  {copiedUpi ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy UPI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Deep Link Quick App Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={upiPayload}
                  className="py-2 px-3 bg-purple-950/80 hover:bg-purple-900 border border-purple-800/60 rounded-xl text-center text-purple-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Pay via PhonePe</span>
                </a>
                <a
                  href={upiPayload}
                  className="py-2 px-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-center text-neutral-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Pay via GPay / Any</span>
                </a>
              </div>
            </div>

            {/* Next Action */}
            <button
              onClick={() => setStep('proof')}
              className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-500 font-mono text-xs font-bold tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>I've Paid — Upload Proof</span>
              <Upload className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Submit UTR & Screenshot */}
        {step === 'proof' && (
          <form onSubmit={handleSubmitProof} className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('qr')}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h3 className="font-serif text-lg font-bold text-white">Payment Proof Verification</h3>
                <p className="text-xs text-neutral-400 font-light">Submit your 12-digit UTR & screenshot to confirm</p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* UTR Input */}
              <div>
                <label className="text-xs font-mono uppercase text-neutral-300 block mb-1">
                  12-Digit UTR / Transaction Ref No. <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 421657893421"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-200"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-200"
                  />
                </div>
              </div>

              {/* Screenshot File Upload */}
              <div>
                <label className="text-xs font-mono uppercase text-neutral-300 block mb-1">
                  Payment Screenshot (Optional / Recommended)
                </label>
                <div className="border-2 border-dashed border-neutral-800 hover:border-purple-500/50 rounded-xl p-4 text-center bg-neutral-950/50 transition-colors relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {screenshot ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={screenshot} alt="Payment Proof" className="max-h-32 rounded-lg border border-neutral-700 object-contain" />
                      <span className="text-xs text-emerald-400 font-mono">✓ Screenshot Attached</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-neutral-400">
                      <Upload className="h-6 w-6 text-purple-400 mb-1" />
                      <span className="text-xs font-mono font-medium text-neutral-300">Click or Drag & Drop Payment Screenshot</span>
                      <span className="text-[10px] text-neutral-500">PNG, JPG or WEBP (Max 8MB)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-mono text-xs font-bold tracking-widest uppercase rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {submitting ? (
                <span>Submitting Proof...</span>
              ) : (
                <>
                  <span>Submit Payment Proof</span>
                  <ShieldCheck className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: Submitted / Confirmation State */}
        {step === 'submitted' && (
          <div className="p-8 text-center space-y-5">
            <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-mono uppercase tracking-widest inline-block">
                Status: Pending Verification
              </span>
              <h3 className="font-serif text-2xl font-bold text-white">Proof Submitted Successfully!</h3>
              <p className="text-xs text-neutral-400 font-light leading-relaxed max-w-sm mx-auto">
                Your payment proof with UTR <span className="font-mono font-semibold text-purple-300">{utr}</span> is under review by the ZYRON Admin team.
              </p>
            </div>

            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-left space-y-2">
              <div className="text-xs font-mono text-neutral-300 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-purple-400" />
                <span>Next Automated Steps:</span>
              </div>
              <ul className="text-xs text-neutral-400 font-mono space-y-1 list-disc pl-5 font-light">
                <li>Admin verifies UTR & amount against bank records</li>
                <li>Upon approval, your unique Ticket ID & Entry QR Code will be issued</li>
                <li>Confirmation sent directly to <span className="text-neutral-200">{guestEmail}</span> & WhatsApp</li>
              </ul>
            </div>

            <button
              onClick={() => {
                onClose();
              }}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 font-mono text-xs font-bold tracking-widest uppercase rounded-xl transition-colors cursor-pointer"
            >
              Done / Return to Portal
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
