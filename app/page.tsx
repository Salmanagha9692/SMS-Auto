"use client";

import { useState, useEffect } from "react";
import { SiteContent, defaultContent, getContent } from "./lib/content";

type Tier = "free" | "5" | "10" | "custom";
type PaymentType = "one-time" | "monthly";

export default function JoinPage() {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("monthly");
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [loading, setLoading] = useState(true);

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

  const handleContinue = () => {
    console.log({
      tier: selectedTier,
      customAmount: selectedTier === "custom" ? customAmount : null,
      paymentType,
    });
  };

  const isValid = selectedTier && (selectedTier !== "custom" || Number(customAmount) > 0);

  // Show loading state while fetching content
  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F0506E] border-t-transparent"></div>
        <div className="text-gray-600 text-sm font-medium">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Logo Header - DYNAMIC */}
      <header className="shrink-0 h-12 sm:h-14 flex items-center justify-center bg-white">
        {content.header.logoUrl ? (
          <img
            src={content.header.logoUrl}
            alt={content.header.logoAlt || "footage"}
            className="h-8 sm:h-10 max-w-full object-contain"
          />
        ) : (
          <h1 className="text-[24px] sm:text-[26px] font-serif italic font-normal tracking-tight text-black">
            {content.header.logoAlt || "footage"}
          </h1>
        )}
      </header>

      {/* Hero Banner - DYNAMIC */}
      <section className="shrink-0 bg-black text-white px-4 sm:px-5 py-4 sm:py-6 flex flex-col justify-center text-center">
        <p className="text-[9px] sm:text-[10px] tracking-[2px] uppercase font-sans font-semibold mb-2 sm:mb-3 text-white">
          {content.hero.subtitle}
        </p>
        <h2 className="text-[20px] sm:text-[24px] leading-[1.15] font-bold uppercase text-[#F0506E] mb-2 sm:mb-4 font-sans">
          {content.hero.title}
        </h2>
        <div className="text-[10px] sm:text-[12px] font-sans leading-[1.6] sm:leading-[1.7] text-white space-y-0">
          {content.hero.highlights.map((highlight, index) => (
            <p key={index}>{highlight}</p>
          ))}
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 sm:px-5 py-3 sm:py-5">
        {/* Tier Selection */}
        <div className="mb-3 sm:mb-5">
          <p className="text-[10px] sm:text-[11px] tracking-[1px] uppercase text-black mb-2 sm:mb-4 font-sans font-medium">
            SELECT YOUR TIER
          </p>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Free Tier */}
            <button
              onClick={() => setSelectedTier("free")}
              className={`h-[56px] sm:h-[68px] border border-black bg-white transition-all duration-200 flex flex-col items-center justify-center ${
                selectedTier === "free" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-semibold text-[13px] sm:text-[14px] text-black">
                Free
              </span>
              <span className="text-[9px] sm:text-[11px] text-gray-400 font-sans mt-0.5">
                Community Access
              </span>
            </button>

            {/* $5 Tier */}
            <button
              onClick={() => setSelectedTier("5")}
              className={`h-[56px] sm:h-[68px] border border-black bg-white transition-all duration-200 flex items-center justify-center ${
                selectedTier === "5" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-normal text-[22px] sm:text-[26px] text-[#F0506E]">
                $5
              </span>
            </button>

            {/* $10 Tier */}
            <button
              onClick={() => setSelectedTier("10")}
              className={`h-[56px] sm:h-[68px] border border-black bg-white transition-all duration-200 flex items-center justify-center ${
                selectedTier === "10" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-normal text-[22px] sm:text-[26px] text-black">
                $10
              </span>
            </button>

            {/* Custom Tier */}
            <button
              onClick={() => setSelectedTier("custom")}
              className={`h-[56px] sm:h-[68px] border border-black bg-white transition-all duration-200 flex flex-col items-center justify-center ${
                selectedTier === "custom" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-semibold text-[13px] sm:text-[14px] text-black">
                Custom
              </span>
              <span className="text-[9px] sm:text-[11px] text-gray-400 font-sans mt-0.5">
                Choose Amount
              </span>
            </button>
          </div>
        </div>

        {/* Custom Amount Input */}
        {selectedTier === "custom" && (
          <div className="mb-3 sm:mb-5">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-sans text-[20px] sm:text-[22px] font-normal z-10">
                $
              </span>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full h-[56px] sm:h-[68px] pl-10 pr-4 border border-black bg-white font-sans text-[22px] sm:text-[26px] text-black text-center focus:outline-none focus:border-2 focus:bg-gray-50 transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* Payment Frequency */}
        <div className="mb-3 sm:mb-5">
          <p className="text-[10px] sm:text-[11px] tracking-[1px] uppercase text-black mb-2 sm:mb-4 font-sans font-medium">
            PAYMENT FREQUENCY
          </p>
          
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => setPaymentType("one-time")}
              className={`h-[40px] sm:h-[46px] border border-black bg-white transition-all duration-200 flex items-center justify-center ${
                paymentType === "one-time" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-medium text-[13px] sm:text-[14px] text-black">
                One-time
              </span>
            </button>
            
            <button
              onClick={() => setPaymentType("monthly")}
              className={`h-[40px] sm:h-[46px] border border-black bg-white transition-all duration-200 flex items-center justify-center ${
                paymentType === "monthly" 
                  ? "border-2 border-black bg-gray-50" 
                  : "hover:bg-gray-50 active:scale-[0.98]"
              }`}
            >
              <span className="font-sans font-medium text-[13px] sm:text-[14px] text-[#F0506E]">
                Monthly
              </span>
            </button>
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center mb-2 sm:mb-4">
          <button
            onClick={handleContinue}
            disabled={!isValid}
            className={`h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-sans font-bold bg-[#F0506E] text-white transition-all duration-200 ${
              isValid ? "hover:bg-[#E03A5A] active:scale-[0.98]" : "opacity-50 cursor-not-allowed"
            }`}
          >
            CONTINUE TO PAYMENT
          </button>
        </div>

        {/* Trust Note */}
        <p className="text-center text-[9px] sm:text-[11px] text-gray-900 font-serif italic">
          Secure payments via Stripe. Apple Pay & Google Pay supported.
        </p>
      </main>

      {/* Divider Line */}
      <div className="flex justify-center px-4 sm:px-5 pt-2 sm:pt-4">
        <div className="w-3/4 h-[1px] bg-gray-900"></div>
      </div>

      {/* Footer Section */}
      <footer className="shrink-0 px-6 sm:px-10 pb-4 sm:pb-5 pt-2 sm:pt-4">
        {/* Message Note */}
        <p className="text-[9px] sm:text-[11px] text-gray-500 font-sans leading-[1.5] sm:leading-[1.6] mb-2 sm:mb-4">
          You'll receive a welcome message and monthly care messages from our makers. Reply STOP anytime to opt out.
        </p>
        
        {/* Copyright & Links */}
        <div className="text-center">
          <p className="text-[9px] sm:text-[11px] text-[#F0506E] font-sans mb-1 sm:mb-2">
            © 2026 The Weft. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <a href="#" className="text-[10px] sm:text-[12px] text-[#F0506E] font-sans hover:underline">
              Privacy
            </a>
            <a href="#" className="text-[10px] sm:text-[12px] text-[#F0506E] font-sans hover:underline">
              Terms
            </a>
            <a href="#" className="text-[10px] sm:text-[12px] text-[#F0506E] font-sans hover:underline">
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
