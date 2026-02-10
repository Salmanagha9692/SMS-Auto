"use client";

interface ContactModalProps {
  isOpen: boolean;
  email: string;
  phoneNumber: string;
  error: string | null;
  processing: boolean;
  onEmailChange: (email: string) => void;
  onPhoneChange: (phoneNumber: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ContactModal({
  isOpen,
  email,
  phoneNumber,
  error,
  processing,
  onEmailChange,
  onPhoneChange,
  onClose,
  onSubmit,
}: ContactModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border-[1px] border-gray-200 max-w-[480px] w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Modal Header */}
        <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-200">
          <h3 className="text-[20px] sm:text-[24px] font-bold font-noto text-black">
            Contact Information
          </h3>
        </div>

        <div className="p-6 sm:p-8">
          {/* Description */}
          <p className="text-[14px] sm:text-[15px] text-gray-700 font-noto leading-relaxed mb-6 sm:mb-8">
            We need your contact information to send you welcome messages and monthly care messages.
          </p>

          {/* Email Input */}
          <div className="mb-5 sm:mb-6">
            <label className="block text-[12px] sm:text-[13px] font-semibold font-noto text-black mb-2">
              Email Address <span className="text-[#f52151]">*</span>
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className={`w-full h-[44px] sm:h-[48px] px-4 border-[1px] bg-white font-noto text-[14px] sm:text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#f52151] focus:ring-offset-0 focus:border-[#f52151] transition-all duration-200 placeholder:text-gray-400 ${
                !email.trim() ? "border-red-300 focus:ring-red-300" : "border-gray-300"
              }`}
            />
            {!email.trim() && (
              <p className="text-[12px] sm:text-[13px] text-red-600 font-noto mt-1.5">
                Email is required
              </p>
            )}
          </div>

          {/* Phone Number Input */}
          <div className="mb-6 sm:mb-8">
            <label className="block text-[12px] sm:text-[13px] font-semibold font-noto text-black mb-2">
              Phone Number <span className="text-[#f52151]">*</span>
            </label>
            <input
              type="tel"
              placeholder="+1234567890"
              value={phoneNumber}
              onChange={(e) => onPhoneChange(e.target.value)}
              className={`w-full h-[44px] sm:h-[48px] px-4 border-[1px] bg-white font-noto text-[14px] sm:text-[15px] text-black focus:outline-none focus:ring-2 focus:ring-[#f52151] focus:ring-offset-0 focus:border-[#f52151] transition-all duration-200 placeholder:text-gray-400 ${
                !phoneNumber.trim() ? "border-red-300 focus:ring-red-300" : "border-gray-300"
              }`}
            />
            <p className="text-[12px] sm:text-[13px] text-gray-600 font-noto mt-1.5">
              Please use the same mobile number from which you send text
            </p>
            {!phoneNumber.trim() && (
              <p className="text-[12px] sm:text-[13px] text-red-600 font-noto mt-1.5">
                Phone number is required
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-[13px] sm:text-[14px] text-red-800 font-noto">
                {error}
              </p>
            </div>
          )}

          {/* Modal Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="text-[14px] sm:text-[15px] text-gray-600 font-noto hover:text-gray-900 transition-colors duration-200"
            >
              Dismiss for now
            </button>
            <button
              onClick={onSubmit}
              disabled={processing || !email.trim() || !phoneNumber.trim()}
              className={`h-[44px] sm:h-[48px] px-6 sm:px-8 text-[13px] sm:text-[14px] font-semibold font-noto bg-[#f52151] text-white transition-all duration-200 ${
                !processing && email.trim() && phoneNumber.trim()
                  ? "hover:bg-[#d11d45] active:scale-[0.98]"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              {processing ? "Processing..." : "Complete Signup"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

