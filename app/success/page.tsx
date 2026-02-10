"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SuccessPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const tier = searchParams.get("tier");
    const amount = searchParams.get("amount");

    // If it's a free tier (no session_id)
    if (tier === "free") {
      setSessionDetails({
        tier: "free",
        amount: 0,
        paymentType: "free",
      });
      setLoading(false);
      return;
    }

    // Fetch session details from Stripe
    if (sessionId) {
      fetch(`/api/stripe/session?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setSessionDetails(data);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching session:", err);
          setError("Failed to load payment details");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#f52151] border-t-transparent"></div>
        <div className="text-gray-600 text-sm font-noto font-medium">
          Loading payment details...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Logo Header */}
      <header className="shrink-0 h-20 sm:h-20 flex items-center justify-center bg-white">
        <h1 className="text-[35px] sm:text-[35px] font-serif font-normal tracking-tight text-black">
          footage
        </h1>
      </header>

      {/* Success Banner */}
      <section className="shrink-0 bg-black text-white px-6 sm:px-8 py-6 sm:py-8 flex flex-col justify-center items-center text-center">
        <div className="text-[40px] sm:text-[50px] mb-4">✓</div>
        <h2 className="text-[28px] sm:text-[36px] leading-[1.1] font-bold uppercase text-white mb-2 sm:mb-3 font-bobby tracking-tight">
          {sessionDetails?.tier === "free" ? "WELCOME!" : "THANK YOU!"}
        </h2>
        <p className="text-[14px] sm:text-[18px] text-[#f52151] font-noto font-bold leading-relaxed">
          {sessionDetails?.tier === "free"
            ? "You're all set with free access"
            : "Your payment was successful"}
        </p>
      </section>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-12 sm:px-12 py-8 sm:py-10">
        {error ? (
          <div className="text-center">
            <p className="text-[14px] sm:text-[16px] text-red-600 font-noto mb-6">
              {error}
            </p>
            <Link
              href="/"
              className="inline-block h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-noto font-bold bg-[#f52151] text-white hover:bg-[#d11d45] active:scale-[0.98] transition-all duration-200 leading-[44px] sm:leading-[50px]"
            >
              BACK TO HOME
            </Link>
          </div>
        ) : (
          <>
            {/* Payment Details */}
            {sessionDetails && (
              <div className="mb-6 sm:mb-8">
                <div className="bg-gray-50 border border-gray-200 p-6 sm:p-8">
                  <h3 className="text-[16px] sm:text-[18px] font-bold font-noto text-black mb-4">
                    Payment Details
                  </h3>
                  <div className="space-y-3">
                    {sessionDetails.tier !== "free" && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] sm:text-[14px] font-noto text-gray-600">
                            Amount:
                          </span>
                          <span className="text-[14px] sm:text-[16px] font-bold font-noto text-black">
                            ${sessionDetails.amount || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[12px] sm:text-[14px] font-noto text-gray-600">
                            Payment Type:
                          </span>
                          <span className="text-[14px] sm:text-[16px] font-noto text-black capitalize">
                            {sessionDetails.paymentType || "one-time"}
                          </span>
                        </div>
                      </>
                    )}
                    {sessionDetails.email && (
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] sm:text-[14px] font-noto text-gray-600">
                          Email:
                        </span>
                        <span className="text-[12px] sm:text-[14px] font-noto text-black">
                          {sessionDetails.email}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* What's Next */}
            <div className="mb-6 sm:mb-8">
              <h3 className="text-[16px] sm:text-[18px] font-bold font-noto text-black mb-4">
                What's Next?
              </h3>
              <p className="text-[12px] sm:text-[14px] text-black font-noto leading-relaxed">
                You'll receive a welcome message shortly. Monthly care messages
                from our makers will be sent to your phone. Reply STOP anytime to
                opt out.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex justify-center">
              <Link
                href="/"
                className="inline-block h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-noto font-bold bg-[#f52151] text-white hover:bg-[#d11d45] active:scale-[0.98] transition-all duration-200 leading-[44px] sm:leading-[50px]"
              >
                BACK TO HOME
              </Link>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 px-12 sm:px-12 pb-4 sm:pb-5 pt-2 sm:pt-4">
        <div className="text-center">
          <p className="text-[9px] sm:text-[11px] text-[#f52151] font-noto mb-1 sm:mb-2">
            © 2026 The Weft. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

