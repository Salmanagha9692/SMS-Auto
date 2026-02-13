"use client";

import { useState, useEffect } from "react";
import { SiteContent, defaultContent, getContent, updateContent } from "../lib/content";

export default function AdminPage() {
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Monthly messages state
  const [sendingMessages, setSendingMessages] = useState(false);
  const [messageResult, setMessageResult] = useState<any>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Load content from API on mount
  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedContent = await getContent();
        setContent(fetchedContent);
      } catch (err) {
        console.error('Failed to load content:', err);
        setError('Failed to load content from server');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, []);

  // Save content to API
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      await updateContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Failed to save content:', err);
      setError(err.message || 'Failed to save content');
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default content (also saves to API)
  const handleReset = async () => {
    try {
      setResetting(true);
      setError(null);
      setSaved(false);
      await updateContent(defaultContent);
      setContent(defaultContent);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error('Failed to reset content:', err);
      setError(err.message || 'Failed to reset content');
    } finally {
      setResetting(false);
    }
  };

  // Update header
  const updateHeader = (field: keyof SiteContent["header"], value: string) => {
    setContent((prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
  };

  // Update hero
  const updateHero = (field: keyof SiteContent["hero"], value: string) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
  };

  // Send monthly messages
  const handleSendMonthlyMessages = async () => {
    try {
      setSendingMessages(true);
      setMessageError(null);
      setMessageResult(null);
      
      const response = await fetch('/api/bird/send-monthly-messages');
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send monthly messages');
      }
      
      setMessageResult(data);
    } catch (err: any) {
      console.error('Failed to send monthly messages:', err);
      setMessageError(err.message || 'Failed to send monthly messages');
    } finally {
      setSendingMessages(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <a
              href="/"
              className="text-sm text-[#f52151] hover:underline"
            >
              ← Back to Site
            </a>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-blue-700 text-sm font-medium">Loading content from server...</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Success Message */}
          {saved && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
              ✓ Changes saved successfully!
            </div>
          )}

          {/* Header Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
              Header Section
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  value={content.header.logoUrl || ""}
                  onChange={(e) => updateHeader("logoUrl", e.target.value)}
                  placeholder="https://example.com/logo.png or /logo.png"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the URL or path to your logo image. Leave empty to show "footage" text.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo Alt Text
                </label>
                <input
                  type="text"
                  value={content.header.logoAlt || ""}
                  onChange={(e) => updateHeader("logoAlt", e.target.value)}
                  placeholder="footage"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
              </div>
              {content.header.logoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-gray-600 mb-2">Logo Preview:</p>
                  <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center">
                    <img
                      src={content.header.logoUrl}
                      alt={content.header.logoAlt || "Logo"}
                      className="max-h-16 max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Hero Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
              Hero Section
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Main Title (e.g., "COMMUNITY WEFT*")
                </label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => updateHero("title", e.target.value)}
                  placeholder="COMMUNITY WEFT*"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be displayed in white, bold, uppercase on black background
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle (e.g., "a practice in compassion & connection")
                </label>
                <input
                  type="text"
                  value={content.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  placeholder="a practice in compassion & connection"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be displayed in pink/magenta, italicized below the title
                </p>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={handleSave}
              disabled={loading || saving || resetting}
              className="flex-1 py-3 bg-[#f52151] text-white font-semibold rounded-lg hover:bg-[#d11d45] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Saving...</span>
                </>
              ) : (
                'Save Changes'
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={loading || saving || resetting}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {resetting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent"></div>
                  <span>Resetting...</span>
                </>
              ) : (
                'Reset to Default'
              )}
            </button>
          </div>

          {/* Monthly Messages Button */}
          <div className="space-y-4">
            <button
              onClick={handleSendMonthlyMessages}
              disabled={sendingMessages}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sendingMessages ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Sending Monthly Messages...</span>
                </>
              ) : (
                <>
                  <span>📤 Send Monthly Messages</span>
                </>
              )}
            </button>

            {/* Message Error */}
            {messageError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                ⚠️ {messageError}
              </div>
            )}

            {/* Message Result */}
            {messageResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">✓ Monthly Messages Sent Successfully!</h3>
                {messageResult.summary && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Total Payments:</span>
                      <span className="font-medium">{messageResult.summary.totalPayments}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Eligible:</span>
                      <span className="font-medium text-green-700">{messageResult.summary.eligible}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Sent:</span>
                      <span className="font-medium text-green-700">{messageResult.summary.sent}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Skipped:</span>
                      <span className="font-medium text-yellow-700">{messageResult.summary.skipped}</span>
                    </div>
                    {messageResult.summary.errors > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-700">Errors:</span>
                        <span className="font-medium text-red-700">{messageResult.summary.errors}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Preview Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Live Preview</h2>
          
          {/* Header Preview */}
          <div className="border rounded-lg overflow-hidden">
            <div className="h-12 flex items-center justify-center bg-white border-b">
              {content.header.logoUrl ? (
                <img
                  src={content.header.logoUrl}
                  alt={content.header.logoAlt || "Logo"}
                  className="max-h-10 max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = document.createElement("span");
                    fallback.className = "text-xl font-serif italic";
                    fallback.textContent = content.header.logoAlt || "footage";
                    (e.target as HTMLImageElement).parentElement?.appendChild(fallback);
                  }}
                />
              ) : (
                <span className="text-xl font-serif italic">{content.header.logoAlt || "footage"}</span>
              )}
            </div>
            
            {/* Hero Preview */}
            <div className="bg-black text-white p-6 sm:p-8 text-center flex flex-col justify-center items-center min-h-[200px]">
              <h2 className="text-xl sm:text-2xl font-bold uppercase text-white mb-3 sm:mb-4 font-sans tracking-tight">
                {content.hero.title}
              </h2>
              <p className="text-sm sm:text-base italic text-[#f52151] font-sans leading-relaxed">
                {content.hero.subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

