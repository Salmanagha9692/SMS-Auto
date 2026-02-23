"use client";

import { useState, useEffect } from "react";
import {
  FreeContent,
  defaultFreeContent,
  getFreeContent,
  updateFreeContent,
} from "../../lib/content";

export default function FreeAdminPage() {
  const [content, setContent] = useState<FreeContent>(defaultFreeContent);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sendingMessages, setSendingMessages] = useState(false);
  const [messageResult, setMessageResult] = useState<any>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetched = await getFreeContent();
        setContent(fetched);
      } catch (err) {
        console.error("Failed to load free content:", err);
        setError("Failed to load content from server");
      } finally {
        setLoading(false);
      }
    };
    loadContent();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSaved(false);
      await updateFreeContent(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Failed to save:", err);
      setError(err.message || "Failed to save");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setResetting(true);
      setError(null);
      setSaved(false);
      await updateFreeContent(defaultFreeContent);
      setContent(defaultFreeContent);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      console.error("Failed to reset free content:", err);
      setError(err.message || "Failed to reset");
    } finally {
      setResetting(false);
    }
  };

  const handleSendMonthlyMessagesFree = async () => {
    try {
      setSendingMessages(true);
      setMessageError(null);
      setMessageResult(null);
      const response = await fetch("/api/bird/send-monthly-messages-free");
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send monthly messages to free tier");
      }
      setMessageResult(data);
    } catch (err: any) {
      console.error("Failed to send monthly messages (free tier):", err);
      setMessageError(err.message || "Failed to send monthly messages to free tier");
    } finally {
      setSendingMessages(false);
    }
  };

  const updateHeader = (field: keyof FreeContent["header"], value: string) => {
    setContent((prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
  };

  const updateHero = (field: keyof FreeContent["hero"], value: string) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
  };

  const updateIntro = (field: keyof FreeContent["intro"], value: string) => {
    setContent((prev) => ({
      ...prev,
      intro: { ...prev.intro, [field]: value },
    }));
  };

  const updateMessage = (field: keyof FreeContent["messages"], value: string) => {
    setContent((prev) => ({
      ...prev,
      messages: { ...prev.messages, [field]: value },
    }));
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Free Page Admin</h1>
              <div className="flex items-center gap-3">
                <a href="/free" className="text-sm text-[#f52151] hover:underline">
                  View Free Page
                </a>
                <a href="/" className="text-sm text-gray-600 hover:underline">
                  ← Main Site
                </a>
              </div>
            </div>
            <nav
              className="inline-flex p-0.5 bg-gray-100 border border-gray-200 rounded-lg shadow-inner"
              aria-label="Switch admin panel"
            >
              <a
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-500 hover:text-[#f52151] hover:bg-white/60 transition-colors"
              >
                Main Admin
              </a>
              <span
                aria-current="page"
                className="px-3 py-1.5 rounded-md bg-white text-gray-900 text-sm font-medium shadow-sm border border-gray-200"
              >
                Free Page Admin
              </span>
            </nav>
          </div>

          {loading && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
              <span className="text-blue-700 text-sm font-medium">Loading content from server...</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Image URL</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Alt Text</label>
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
                  Main Title (e.g., "FREE COMMUNITY ACCESS")
                </label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => updateHero("title", e.target.value)}
                  placeholder="FREE COMMUNITY ACCESS"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Displayed in white, bold, uppercase on black background.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtitle (e.g., "join the practice — no payment required")
                </label>
                <input
                  type="text"
                  value={content.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  placeholder="join the practice — no payment required"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Displayed in pink/magenta below the title.
                </p>
              </div>
            </div>
          </section>

          {/* Intro Section */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
              Intro Section
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Main Text</label>
                <textarea
                  value={content.intro.mainText}
                  onChange={(e) => updateIntro("mainText", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Text</label>
                <textarea
                  value={content.intro.subText}
                  onChange={(e) => updateIntro("subText", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
              </div>
            </div>
          </section>

          {/* Message Templates */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b">
              Message Templates
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Stored separately from Main Admin. Used for free signups and free-tier monthly messages.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FREE Reply Message
                </label>
                <textarea
                  value={content.messages.freeReply}
                  onChange={(e) => updateMessage("freeReply", e.target.value)}
                  placeholder="Thanks for your interest! Get free community access here: {link}"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-reply when user texts "FREE". Use {"{link}"} for the free page URL.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Welcome Messages (sent one by one after free signup)
                </label>
                <p className="mb-2 text-xs text-gray-500">4 messages, 2 seconds apart.</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Welcome 1</label>
                    <textarea
                      value={content.messages.welcomeMessage1}
                      onChange={(e) => updateMessage("welcomeMessage1", e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Welcome 2</label>
                    <textarea
                      value={content.messages.welcomeMessage2}
                      onChange={(e) => updateMessage("welcomeMessage2", e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Welcome 3</label>
                    <textarea
                      value={content.messages.welcomeMessage3}
                      onChange={(e) => updateMessage("welcomeMessage3", e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Welcome 4</label>
                    <textarea
                      value={content.messages.welcomeMessage4}
                      onChange={(e) => updateMessage("welcomeMessage4", e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Message</label>
                <textarea
                  value={content.messages.monthlyMessage}
                  onChange={(e) => updateMessage("monthlyMessage", e.target.value)}
                  placeholder="Thank you for being part of Community Weft..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f52151] focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Monthly care message for free-tier subscribers. Used when you click "Send Monthly to Free Tier".
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
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                "Save Changes"
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={loading || saving || resetting}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {resetting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-600 border-t-transparent" />
                  <span>Resetting...</span>
                </>
              ) : (
                "Reset to Default"
              )}
            </button>
          </div>

          {/* Send Monthly to Free Tier Only */}
          <div className="space-y-4">
            <button
              onClick={handleSendMonthlyMessagesFree}
              disabled={sendingMessages}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sendingMessages ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  <span>Sending Monthly Messages to Free Tier...</span>
                </>
              ) : (
                <>
                  <span>📤 Send Monthly Messages to Free Tier Only</span>
                </>
              )}
            </button>

            {messageError && (
              <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                ⚠️ {messageError}
              </div>
            )}

            {messageResult && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-3">
                  ✓ Monthly Messages Sent to Free Tier
                </h3>
                {messageResult.summary && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Free-tier payments:</span>
                      <span className="font-medium">{messageResult.summary.totalFree}</span>
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
