import React, { useState } from 'react';
import { Sparkles, Save, Ticket, Users, CheckCircle2, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';


export default function TicketGenerator({ events }: { events: any[] }) {
  const [formData, setFormData] = useState({
    event_id: events.find(e => e.status === 'published')?.id || events[0]?.id || '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    tier: 'general',
    quantity: 1,
    send_email: false,
  });

  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };
  const [generatedTicket, setGeneratedTicket] = useState<any>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('zyron_admin_token');
      const res = await fetch('/api/admin/bookings/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate ticket');

      setGeneratedTicket(data.booking);
      showToast('Ticket generated successfully!');
      
      // Reset form but keep event and tier
      setFormData(prev => ({
        ...prev,
        guest_name: '',
        guest_email: '',
        guest_phone: '',
      }));
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
<>

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border border-neutral-800 py-3.5 px-5 font-mono text-xs flex items-center shadow-md">
          <span>{toastMsg}</span>
        </div>
      )}

    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono uppercase tracking-widest font-bold">Ticket Generator</h2>
          <p className="text-sm text-neutral-500 mt-1 font-mono">Manually issue passes and generate unique QR codes instantly.</p>
        </div>
        <div className="bg-neutral-900 text-white dark:bg-white dark:text-black p-3 rounded-full">
          <Ticket className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Form Column */}
        <div className="border border-neutral-200 dark:border-neutral-900 p-6 bg-white dark:bg-black space-y-6">
          <h3 className="font-mono text-xs uppercase tracking-widest text-neutral-500 mb-4 flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Guest Details</span>
          </h3>

          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase text-neutral-500 mb-1.5">Event</label>
              <select
                required
                value={formData.event_id}
                onChange={e => setFormData(p => ({ ...p, event_id: e.target.value }))}
                className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-800 p-2 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white transition-colors"
              >
                {events.map(event => (
                  <option key={event.id} value={event.id} className="text-black dark:text-black">
                    {event.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-500 mb-1.5">Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formData.guest_name}
                  onChange={e => setFormData(p => ({ ...p, guest_name: e.target.value }))}
                  className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-800 p-2 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-500 mb-1.5">Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="e.g. guest@example.com"
                  value={formData.guest_email}
                  onChange={e => setFormData(p => ({ ...p, guest_email: e.target.value }))}
                  className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-800 p-2 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-500 mb-1.5">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+91..."
                  value={formData.guest_phone}
                  onChange={e => setFormData(p => ({ ...p, guest_phone: e.target.value }))}
                  className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-800 p-2 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-neutral-500 mb-1.5">Ticket Tier</label>
                <select
                  value={formData.tier}
                  onChange={e => setFormData(p => ({ ...p, tier: e.target.value }))}
                  className="w-full bg-transparent border-b border-neutral-300 dark:border-neutral-800 p-2 font-mono text-sm focus:outline-none focus:border-black dark:focus:border-white"
                >
                  <option value="general" className="text-black">General</option>
                  <option value="vip" className="text-black">VIP</option>
                  <option value="earlybird" className="text-black">Early Bird</option>
                  <option value="group" className="text-black">Group</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.send_email}
                  onChange={e => setFormData(p => ({ ...p, send_email: e.target.checked }))}
                  className="w-4 h-4 accent-black dark:accent-white" 
                />
                <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
                  Send Ticket Email
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white dark:bg-white dark:text-black px-6 py-2 text-xs font-mono uppercase tracking-widest font-bold hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center space-x-2"
              >
                {loading ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Output Column */}
        <div className="border border-neutral-200 dark:border-neutral-900 p-6 bg-neutral-50 dark:bg-[#0a0a0a] flex flex-col items-center justify-center min-h-[400px]">
          {generatedTicket ? (
            <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              
              <div>
                <h4 className="font-bold text-xl mb-1">{generatedTicket.guest_name}</h4>
                <p className="font-mono text-sm text-neutral-500">{generatedTicket.tier.toUpperCase()} PASS</p>
              </div>

              <div className="bg-white p-4 border border-neutral-100">
                <QRCodeSVG 
                  value={`ZYRON-TICKET-${generatedTicket.id}`}
                  size={160}
                  level="Q"
                />
              </div>

              <div className="w-full border-t border-dashed border-neutral-200 dark:border-neutral-700 pt-4 flex flex-col space-y-2">
                <div className="flex justify-between text-xs font-mono text-neutral-500">
                  <span>Booking ID</span>
                  <span className="truncate ml-4">{generatedTicket.id.split('-')[0].toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-neutral-500">
                  <span>Quantity</span>
                  <span>{generatedTicket.quantity}</span>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`ZYRON-TICKET-${generatedTicket.id}`);
                  showToast('QR Code Payload copied to clipboard');
                }}
                className="w-full flex justify-center items-center space-x-2 text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Ticket ID</span>
              </button>
            </div>
          ) : (
            <div className="text-center text-neutral-400 dark:text-neutral-600 space-y-4">
              <Ticket className="w-12 h-12 mx-auto opacity-50" />
              <p className="font-mono text-sm max-w-xs">Fill out the form to instantly generate a secure, scannable QR ticket.</p>
            </div>
          )}
        </div>
        
      </div>
    </div>
  </>
  );
}
