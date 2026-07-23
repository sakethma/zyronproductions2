import React, { useState } from 'react';
import { Share2, Copy, Check, MessageCircle, Send, Sparkles } from 'lucide-react';

interface SocialShareProps {
  eventTitle: string;
  teaser?: string;
  eventSlug: string;
}

export default function SocialShare({ eventTitle, teaser, eventSlug }: SocialShareProps) {
  const [copied, setCopied] = useState(false);

  // Construct absolute URL or current window URL fallback
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/events/${eventSlug}`
    : `https://zyron.events/events/${eventSlug}`;

  const shareText = `🔥 Check out "${eventTitle}" on Zyron Productions! ${teaser ? teaser : 'Get your passes now before tickets sell out.'}`;

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\n👉 Book tickets here: ${shareUrl}`)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}&hashtags=ZyronProductions,LiveEvents,ExclusivePass`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: eventTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // Ignored if user dismissed native share sheet
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 p-5 rounded-2xl space-y-3.5 my-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Share Experience &amp; Invite Crew
          </span>
        </div>
        <span className="text-[10px] font-mono text-violet-600 dark:text-violet-400 font-semibold bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
          Viral Invite
        </span>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-light leading-relaxed">
        Spread the word on WhatsApp, X/Twitter, or Telegram to bring your group along.
      </p>

      {/* Sharing buttons grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
        {/* WhatsApp Share */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-sm hover:shadow-emerald-500/20"
          title="Share directly via WhatsApp"
        >
          <MessageCircle className="h-4 w-4 fill-current" />
          <span>WhatsApp</span>
        </a>

        {/* X / Twitter Share */}
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 rounded-xl text-xs font-mono font-bold transition-all shadow-sm border border-neutral-700/50"
          title="Share post on X (Twitter)"
        >
          <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          <span>Twitter / X</span>
        </a>

        {/* Telegram Share */}
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-mono font-bold transition-all shadow-sm"
          title="Share via Telegram"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Telegram</span>
        </a>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={typeof window !== 'undefined' && 'share' in navigator ? handleNativeShare : handleCopy}
          className="flex items-center justify-center space-x-1.5 py-2.5 px-3 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer"
          title="Copy direct share link"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              {typeof window !== 'undefined' && 'share' in navigator ? (
                <Share2 className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{typeof window !== 'undefined' && 'share' in navigator ? 'Share Link' : 'Copy Link'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
