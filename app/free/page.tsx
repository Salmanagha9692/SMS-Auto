"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FreeContent, defaultFreeContent, getFreeContent } from "../lib/content";

function FreeJoinPageContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [content, setContent] = useState<FreeContent>(defaultFreeContent);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load free page content from API
  useEffect(() => {
    const loadContent = async () => {
      try {
        const fetchedContent = await getFreeContent();
        setContent(fetchedContent);
      } catch (err) {
        console.error("Failed to load free content:", err);
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  // Read phone number from URL param (?phone=) first, then fall back to localStorage (same as main landing)
  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam) {
      const decodedPhone = decodeURIComponent(phoneParam);
      setPhoneNumber(decodedPhone);
      if (typeof window !== "undefined") {
        localStorage.setItem("checkoutPhoneNumber", decodedPhone);
      }
    } else if (typeof window !== "undefined") {
      const storedPhone = localStorage.getItem("checkoutPhoneNumber");
      if (storedPhone) {
        setPhoneNumber(storedPhone);
      }
    }
  }, [searchParams]);

  // Sync automation messages when page loads (to update phone numbers table)
  useEffect(() => {
    const syncAutomation = async () => {
      try {
        console.log('🔄 Syncing automation messages on page load...');
        const response = await fetch('/api/bird/sync-automation');
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Automation messages synced successfully');
          console.log(`   📊 Synced ${data.summary?.uniqueSenders || 0} phone numbers`);
        } else {
          console.error('⚠️  Failed to sync automation messages:', data.error);
        }
      } catch (error) {
        console.error('❌ Error syncing automation messages:', error);
        // Don't block the page if sync fails
      }
    };

    syncAutomation();
  }, []); // Run once on page load

  const handleContinue = async () => {
    setError(null);

    // Validate contact info (email, name, or alias — any non-empty value)
    if (!email.trim()) {
      setError("Please enter your email, name, or alias");
      return;
    }

    setProcessing(true);

    try {
      // Get phone number from localStorage (from LOVE message link)
      const checkoutPhone = typeof window !== 'undefined' 
        ? localStorage.getItem('checkoutPhoneNumber') || phoneNumber.trim() 
        : phoneNumber.trim();
      
      console.log('📱 Phone number for checkout:', checkoutPhone);
      console.log('📱 localStorage phone:', typeof window !== 'undefined' ? localStorage.getItem('checkoutPhoneNumber') : 'N/A');
      
      // Ensure we have phone from localStorage
      if (!checkoutPhone) {
        setError("Phone number is required. Please use the link from your SMS message.");
        setProcessing(false);
        return;
      }

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: "free",
          customAmount: null,
          paymentType: "monthly",
          email: email.trim(),
          phoneNumber: checkoutPhone,
          signupSource: "hope", // HOPE link → Free Signups table + Hope content; monthly from Hope only
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to success page
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.message || 'Failed to process. Please try again.');
      setProcessing(false);
    }
  };

  // Show loading state while fetching content
  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#f52151] border-t-transparent"></div>
        <div className="text-gray-600 text-sm font-noto font-medium">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Logo Header - DYNAMIC */}
      <header className="shrink-0 h-20 sm:h-20 flex items-center justify-center bg-white">
        {content.header.logoUrl ? (
          <img
            src={content.header.logoUrl}
            alt={content.header.logoAlt || "footage"}
            className="h-12 sm:h-16 max-w-full object-contain"
          />
        ) : (
          <h1 className="text-[35px] sm:text-[35px] font-serif font-normal tracking-tight text-black">
            {content.header.logoAlt || "footage"}
          </h1>
        )}
      </header>

      {/* Hero Banner - from free content */}
      <section className="shrink-0 bg-black text-white px-6 sm:px-8 py-4 sm:py-8 flex flex-col justify-center items-start text-left">
        <h2 className="text-[28px] sm:text-[40px] leading-[1.1] font-bold uppercase text-white mb-2 sm:mb-4 font-bobby tracking-tight text-left">
          {content.hero.title}
        </h2>
        <p className="text-[14px] sm:text-[18px] text-[#f52151] font-noto font-bold leading-relaxed text-left">
          {content.hero.subtitle}
        </p>
      </section>

      <div className="py-2 sm:py-2 px-4 sm:px-2 flex flex-col items-center justify-center w-full">
        <p className="text-[11px] sm:text-[14px] text-black font-noto leading-[1.8] text-center">
          {content.intro.mainText}
        </p>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-12 sm:px-12">
        <div className="mb-4 sm:mb-6">
          <p className="text-[11px] sm:text-[14px] text-black font-noto leading-relaxed">
            {content.intro.subText}
          </p>
        </div>

        {/* Free Community Access Section */}
        <div className="mb-4 sm:mb-6">
          <div className="border-[1px] border-[#f52151] bg-gray-50 p-6 sm:p-8">
            <h3 className="font-noto font-semibold text-[16px] sm:text-[20px] text-black text-center mb-2">
              Free Community Access
            </h3>
            <p className="font-noto text-[12px] sm:text-[14px] text-gray-600 text-center">
              Join our community and receive monthly care messages
            </p>
          </div>
        </div>

        {/* Phone from URL/link — same as main: not shown, used in background (localStorage) */}

        {/* Contact field: email, name, or alias */}
        <div className="mb-3 sm:mb-5">
          <div className="mb-3 sm:mb-4">
            <label className="block text-[10px] sm:text-[11px] tracking-[1px] uppercase text-black mb-2 font-noto font-medium">
              EMAIL / NAME / ALIAS <span className="text-[#f52151]">*</span>
            </label>
            <input
              type="text"
              placeholder="your@email.com or your name or alias"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[44px] sm:h-[48px] px-4 border-[1px] border-gray-900 bg-white font-noto text-[14px] sm:text-[15px] text-black focus:outline-none focus:!border-[#f52151] focus:border-[1px] focus:bg-gray-50 hover:!border-[#f52151] transition-all duration-200 placeholder:text-gray-400"
            />
            {/* Phone from link is in localStorage — not shown, same as main */}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200">
            <p className="text-[12px] sm:text-[14px] text-red-600 font-noto text-center">
              {error}
            </p>
          </div>
        )}

        {/* Sign Up Button */}
        <div className="flex justify-center mb-2 sm:mb-4">
          <button
            onClick={handleContinue}
            disabled={!email.trim() || processing}
            className={`h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-noto font-bold bg-[#f52151] text-white transition-all duration-200 ${
              email.trim() && !processing
                ? "hover:bg-[#d11d45] active:scale-[0.98]" 
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            {processing ? "PROCESSING..." : "SIGN UP"}
          </button>
        </div>

        {/* Trust Note */}
        <p className="text-center text-[9px] sm:text-[11px] text-black font-noto">
          Secure sign up. Your information is protected.
        </p>
      </main>

      {/* Divider Line */}
      <div className="flex justify-center px-12 sm:px-12 pt-2 sm:pt-4">
        <div className="w-full h-[1px] bg-gray-900"></div>
      </div>

      {/* Footer Section */}
      <footer className="shrink-0 px-12 sm:px-12 pb-4 sm:pb-5 pt-2 sm:pt-4">
        {/* Message Note */}
        <p className="text-[9px] sm:text-[11px] text-black font-noto leading-[1.5] sm:leading-[1.6] mb-2 sm:mb-4">
          You'll receive a welcome message and monthly care messages from our makers. Reply STOP anytime to opt out.
        </p>

        {/* Copyright & Links */}
        <div className="text-center">
          <p className="text-[9px] sm:text-[11px] text-[#f52151] font-noto mb-1 sm:mb-2">
            © 2026 The Weft. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <a href="#" className="text-[10px] sm:text-[12px] text-[#f52151] font-noto hover:underline">
              Privacy
            </a>
            <a href="#" className="text-[10px] sm:text-[12px] text-[#f52151] font-noto hover:underline">
              Terms
            </a>
            <a href="#" className="text-[10px] sm:text-[12px] text-[#f52151] font-noto hover:underline">
              Contact
            </a>
          </div>
        </div>

        {/* Safe area spacer for iOS */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </footer>
    </div>
  );
}

export default function FreeJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#f52151] border-t-transparent" />
          <div className="text-gray-600 text-sm font-noto font-medium">Loading...</div>
        </div>
      }
    >
      <FreeJoinPageContent />
    </Suspense>
  );
}