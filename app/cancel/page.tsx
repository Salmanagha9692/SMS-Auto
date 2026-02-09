"use client";

import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="min-h-screen min-h-dvh bg-white flex flex-col max-w-[480px] mx-auto">
      {/* Logo Header */}
      <header className="shrink-0 h-20 sm:h-20 flex items-center justify-center bg-white">
        <h1 className="text-[35px] sm:text-[35px] font-serif font-normal tracking-tight text-black">
          footage
        </h1>
      </header>

      {/* Cancel Banner */}
      <section className="shrink-0 bg-black text-white px-6 sm:px-8 py-6 sm:py-8 flex flex-col justify-center items-center text-center">
        <div className="text-[40px] sm:text-[50px] mb-4">✕</div>
        <h2 className="text-[28px] sm:text-[36px] leading-[1.1] font-bold uppercase text-white mb-2 sm:mb-3 font-bobby tracking-tight">
          PAYMENT CANCELLED
        </h2>
        <p className="text-[14px] sm:text-[18px] text-[#f52151] font-noto font-bold leading-relaxed">
          Your payment was not processed
        </p>
      </section>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-12 sm:px-12 py-8 sm:py-10">
        <div className="mb-6 sm:mb-8">
          <p className="text-[14px] sm:text-[16px] text-black font-noto leading-relaxed mb-4">
            You cancelled the payment process. No charges have been made to your
            account.
          </p>
          <p className="text-[14px] sm:text-[16px] text-black font-noto leading-relaxed">
            If you experienced any issues or have questions, please don't
            hesitate to contact us.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/"
            className="inline-block h-[44px] sm:h-[50px] px-6 sm:px-8 text-[11px] sm:text-[12px] tracking-[2px] uppercase font-noto font-bold bg-[#f52151] text-white hover:bg-[#d11d45] active:scale-[0.98] transition-all duration-200 leading-[44px] sm:leading-[50px]"
          >
            TRY AGAIN
          </Link>
          <a
            href="#"
            className="text-[11px] sm:text-[12px] tracking-[1px] uppercase font-noto font-medium text-gray-600 hover:text-black transition-colors"
          >
            Contact Support
          </a>
        </div>
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

