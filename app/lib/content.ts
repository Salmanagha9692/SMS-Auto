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

// Fetch content from Airtable API
export async function getContent(): Promise<SiteContent> {
  try {
    const response = await fetch('/api/airtable/content', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch content from API, using default content');
      return defaultContent;
    }

    const result = await response.json();
    
    if (result.success && result.data) {
      // Merge API data with defaults to ensure all fields are present
      return {
        header: {
          logoUrl: result.data.header?.logoUrl || defaultContent.header.logoUrl,
          logoAlt: result.data.header?.logoAlt || defaultContent.header.logoAlt,
        },
        hero: {
          subtitle: result.data.hero?.subtitle || defaultContent.hero.subtitle,
          title: result.data.hero?.title || defaultContent.hero.title,
          highlights: result.data.hero?.highlights || defaultContent.hero.highlights,
        },
      };
    }

    return defaultContent;
  } catch (error) {
    console.error('Error fetching content:', error);
    return defaultContent;
  }
}

// Update content via API
export async function updateContent(content: Partial<SiteContent>): Promise<boolean> {
  try {
    const response = await fetch('/api/airtable/content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update content');
    }

    return true;
  } catch (error) {
    console.error('Error updating content:', error);
    throw error;
  }
}

