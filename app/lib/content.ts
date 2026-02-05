// Content types for dynamic sections
export interface HeaderContent {
  logoUrl: string; // URL or path to logo image
  logoAlt?: string; // Alt text for logo
}

export interface HeroContent {
  subtitle: string;
  title: string;
  highlights: string[];
}

export interface SiteContent {
  header: HeaderContent;
  hero: HeroContent;
}

// Default content
export const defaultContent: SiteContent = {
  header: {
    logoUrl: "", // Empty by default - will show "footage" text as fallback
    logoAlt: "footage",
  },
  hero: {
    subtitle: "JOIN OUR COMMUNITY",
    title: "PRACTICING COMPASSION",
    highlights: [
      "Overview of GBV in Kyrgyzstan",
      "Purpose of the PowerTools initiative",
      "Key findings from needs assessment",
    ],
  },
};

// In a real app, this would fetch from a database or CMS
export async function getContent(): Promise<SiteContent> {
  // For now, return default content
  // Later you can fetch from: database, API, or CMS
  return defaultContent;
}

