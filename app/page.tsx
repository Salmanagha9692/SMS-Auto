"use client";

import { useState, useEffect } from "react";
import { SiteContent, defaultContent, getContent } from "./lib/content";
import ContactModal from "./components/ContactModal";

type Tier = "free" | "5" | "10" | "25" | "50" | "75" | "100" | "custom";
type PaymentType = "one-time" | "monthly";

export default function JoinPage() {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("monthly");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showContactModal, setShowContactModal] = useState(false);
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dynamic content from API
  useEffect(() => {
    const loadContent = async () => {
      try {
        const fetchedContent = await getContent();
        setContent(fetchedContent);
      } catch (err) {
        console.error('Failed to load content:', err);
        // Fallback to default content on error
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

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

  // Reset contact modal when tier changes
  useEffect(() => {
    if (selectedTier !== "free") {
      setShowContactModal(false);
      setEmail("");
      setPhoneNumber("");
    }
  }, [selectedTier]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showContactModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showContactModal]);

  const handleContinue = async () => {
    setError(null);

    // For free tier, show contact modal first
    if (selectedTier === "free" && !showContactModal) {
      setShowContactModal(true);
      return;
    }

    // Validate contact info for free tier
    if (selectedTier === "free" && showContactModal) {
      if (!email.trim() || !phoneNumber.trim()) {
        setError("Email and phone number are required");
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError("Please enter a valid email address");
        return;
      }

      // Basic phone validation
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phoneNumber.trim().replace(/\s/g, ''))) {
        setError("Please enter a valid phone number (e.g., +1234567890)");
        return;
      }
    }

    setProcessing(true);

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: selectedTier,
          customAmount: selectedTier === "custom" ? customAmount : null,
          paymentType,
          email: selectedTier === "free" ? email.trim() : undefined,
          phoneNumber: selectedTier === "free" ? phoneNumber.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout or success page
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.message || 'Failed to process payment. Please try again.');
      setProcessing(false);
    }
  };

  const isValid = selectedTier && (selectedTier !== "custom" || Number(customAmount) > 0);

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
          <h1 className="text-[35px] sm:text-[35px] font-serif  font-normal tracking-tight text-black">
            {content.header.logoAlt || "footage"}
          </h1>
        )}
      </header>

      {/* Hero Banner - DYNAMIC */}
      <section className="shrink-0 bg-black text-white px-6 sm:px-8 py-4 sm:py-8 flex flex-col justify-center items-start text-left">
        <h2 className="text-[28px] sm:text-[40px] leading-[1.1] font-bold uppercase text-white mb-2 sm:mb-4 font-bobby tracking-tight text-left">
          {content.hero.title}
        </h2>
        <p className="text-[14px] sm:text-[18px] text-[#f52151] font-noto font-bold leading-relaxed text-left">
          {content.hero.subtitle}
        </p>
      </section>

      {/* <div className="px-4 sm:px-4 py-4 sm:py-5 flex flex-col items-center justify-center">
        <p className="text-[14px] sm:text-[16px] text-black font-noto leading-relaxed">
          {content.intro.mainText}
        </p>
      </div> */}

      <div className="py-2 sm:py-2 px-4 sm:px-2 flex flex-col items-center justify-center w-full">
        <p className="text-[11px] sm:text-[14px] text-black font-noto leading-[1.8] text-center">
          <span>*In weaving, the weft is the thread that holds the fabric together.</span>
          <br className="hidden sm:inline" />
          <span> Community Weft is a monthly text practice of care and connection</span>
          <br className="hidden sm:inline" />
          <span> your thread helping sustain FemSMS messages for people living</span>
          <br className="hidden sm:inline" />
          <span> through war, displacement and crisis.</span>
        </p>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-12 sm:px-12">
        {/* Intro Text Sections */}
        <div className="mb-4 sm:mb-6">
          <p className="text-[11px] sm:text-[14px] text-black font-noto  leading-relaxed">
            {content.intro.subText}
          </p>
        </div>

        {/* Tier Selection */}
        <div className="mb-3 sm:mb-5">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
            {/* Free Tier */}
            <button
              onClick={() => setSelectedTier("free")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex flex-col items-center justify-center ${selectedTier === "free"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-semibold text-[9px] sm:text-[12px] text-black text-center px-0.5">
                Free Community Access
              </span>
            </button>

            {/* $5 Tier */}
            <button
              onClick={() => setSelectedTier("5")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "5"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $5
              </span>
            </button>

            {/* $10 Tier */}
            <button
              onClick={() => setSelectedTier("10")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "10"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $10
              </span>
            </button>

            {/* $25 Tier */}
            <button
              onClick={() => setSelectedTier("25")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "25"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $25
              </span>
            </button>

            {/* $50 Tier */}
            <button
              onClick={() => setSelectedTier("50")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "50"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $50
              </span>
            </button>

            {/* $75 Tier */}
            <button
              onClick={() => setSelectedTier("75")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "75"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $75
              </span>
            </button>

            {/* $100 Tier */}
            <button
              onClick={() => setSelectedTier("100")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${selectedTier === "100"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-bold text-[14px] sm:text-[22px] text-[#f52151]">
                $100
              </span>
            </button>

            {/* Custom Tier */}
            <button
              onClick={() => setSelectedTier("custom")}
              className={`w-full h-[50px] sm:h-[70px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex flex-col items-center justify-center ${selectedTier === "custom"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-semibold text-[9px] sm:text-[12px] text-black text-center px-0.5">
                Custom Choose Amount
              </span>
            </button>
          </div>
        </div>

        {/* Custom Amount Input */}
        {selectedTier === "custom" && (
          <div className="mb-3 sm:mb-5">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-noto text-[20px] sm:text-[22px] font-normal z-10">
                $
              </span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full h-[56px] sm:h-[68px] pl-10 pr-4 border-[1px] border-gray-900 bg-white font-noto text-[22px] sm:text-[26px] text-black text-center focus:outline-none focus:!border-[#f52151] focus:border-[1px] focus:bg-gray-50 hover:!border-[#f52151] transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* Payment Frequency */}
        <div className="mb-3 sm:mb-5">
          <p className="text-[10px] sm:text-[11px] tracking-[1px] uppercase text-black mb-2 sm:mb-4 font-noto font-medium">
            PAYMENT FREQUENCY
          </p>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => setPaymentType("one-time")}
              className={`min-h-[44px] h-[44px] sm:h-[46px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${paymentType === "one-time"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-medium text-[13px] sm:text-[14px] text-black">
                One-time
              </span>
            </button>

            <button
              onClick={() => setPaymentType("monthly")}
              className={`min-h-[44px] h-[44px] sm:h-[46px] border-[1px] border-gray-900 bg-white transition-all duration-200 flex items-center justify-center ${paymentType === "monthly"
                ? "border-[1px] !border-[#f52151] bg-gray-50"
                : "hover:bg-[#f52151]/10 hover:!border-[#f52151] active:scale-[0.98]"
                }`}
            >
              <span className="font-noto font-medium text-[13px] sm:text-[14px] text-[#f52151]">
                Monthly
              </span>
            </button>
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

        {/* Continue Button */}
        <div className="flex justify-center mb-2 sm:mb-4">
          <button
            onClick={handleContinue}
            disabled={!isValid || processing}
            className={`h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-noto font-bold bg-[#f52151] text-white transition-all duration-200 ${
              isValid && !processing 
                ? "hover:bg-[#d11d45] active:scale-[0.98]" 
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            {processing ? "PROCESSING..." : "CONTINUE TO PAYMENT"}
          </button>
        </div>

        {/* Trust Note */}
        <p className="text-center text-[9px] sm:text-[11px] text-black font-noto">
          Secure payments via Stripe. Apple Pay & Google Pay supported.
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

      {/* Contact Information Modal - Only for Free Tier */}
      <ContactModal
        isOpen={showContactModal && selectedTier === "free"}
        email={email}
        phoneNumber={phoneNumber}
        error={error}
        processing={processing}
        onEmailChange={setEmail}
        onPhoneChange={setPhoneNumber}
        onClose={() => {
          setShowContactModal(false);
          setEmail("");
          setPhoneNumber("");
          setError(null);
        }}
        onSubmit={handleContinue}
      />
    </div>
  );
}
