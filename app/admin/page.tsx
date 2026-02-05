"use client";

import { useState, useEffect } from "react";
import { SiteContent, defaultContent } from "../lib/content";

export default function AdminPage() {
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [saved, setSaved] = useState(false);
  const [newHighlight, setNewHighlight] = useState("");

  // Load saved content from localStorage on mount
  useEffect(() => {
    const savedContent = localStorage.getItem("siteContent");
    if (savedContent) {
      setContent(JSON.parse(savedContent));
    }
  }, []);

  // Save content to localStorage
  const handleSave = () => {
    localStorage.setItem("siteContent", JSON.stringify(content));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Reset to default content
  const handleReset = () => {
    setContent(defaultContent);
    localStorage.removeItem("siteContent");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update header
  const updateHeader = (field: keyof SiteContent["header"], value: string) => {
    setContent((prev) => ({
      ...prev,
      header: { ...prev.header, [field]: value },
    }));
  };

  // Update hero
  const updateHero = (field: keyof SiteContent["hero"], value: string | string[]) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }));
  };

  // Add highlight
  const addHighlight = () => {
    if (newHighlight.trim()) {
      updateHero("highlights", [...content.hero.highlights, newHighlight.trim()]);
      setNewHighlight("");
    }
  };

  // Remove highlight
  const removeHighlight = (index: number) => {
    updateHero(
      "highlights",
      content.hero.highlights.filter((_, i) => i !== index)
    );
  };

  // Update highlight
  const updateHighlight = (index: number, value: string) => {
    const newHighlights = [...content.hero.highlights];
    newHighlights[index] = value;
    updateHero("highlights", newHighlights);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <a
              href="/"
              className="text-sm text-[#F0506E] hover:underline"
            >
              ← Back to Site
            </a>
          </div>

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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
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
                  Subtitle (small text above title)
                </label>
                <input
                  type="text"
                  value={content.hero.subtitle}
                  onChange={(e) => updateHero("subtitle", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Main Title
                </label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => updateHero("title", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Highlights / Bullet Points
                </label>
                <div className="space-y-2">
                  {content.hero.highlights.map((highlight, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={highlight}
                        onChange={(e) => updateHighlight(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
                      />
                      <button
                        onClick={() => removeHighlight(index)}
                        className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Add new highlight */}
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    placeholder="Add new highlight..."
                    onKeyDown={(e) => e.key === "Enter" && addHighlight()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F0506E] focus:border-transparent"
                  />
                  <button
                    onClick={addHighlight}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-[#F0506E] text-white font-semibold rounded-lg hover:bg-[#E03A5A] transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Reset to Default
            </button>
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
            <div className="bg-black text-white p-4 text-center">
              <p className="text-[9px] tracking-[2px] uppercase mb-2">
                {content.hero.subtitle}
              </p>
              <h2 className="text-lg font-bold uppercase text-[#F0506E] mb-2">
                {content.hero.title}
              </h2>
              <div className="text-[10px] text-white/90 space-y-0.5">
                {content.hero.highlights.map((highlight, index) => (
                  <p key={index}>{highlight}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

