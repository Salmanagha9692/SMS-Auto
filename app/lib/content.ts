// Content types for dynamic sections
export interface HeaderContent {
  logoUrl: string; // URL or path to logo image
  logoAlt?: string; // Alt text for logo
}

export interface HeroContent {
  title: string; // Main title (e.g., "COMMUNITY WEFT*")
  subtitle: string; // Subtitle (e.g., "a practice in compassion & connection")
}

export interface IntroContent {
  mainText: string; // Main introductory text
  subText: string; // Secondary explanatory text (italicized)
}

export interface SiteContent {
  header: HeaderContent;
  hero: HeroContent;
  intro: IntroContent;
}

// Default content
export const defaultContent: SiteContent = {
  header: {
    logoUrl: "", // Empty by default - will show "footage" text as fallback
    logoAlt: "footage",
  },
  hero: {
    title: "COMMUNITY WEFT*",
    subtitle: "a practice in compassion & connection",
  },
  intro: {
    mainText: "*In weaving, the weft is the thread that holds the fabric together. Community Weft is a monthly text practice of care and connection —your thread helping sustain FemSMS messages for people living through war, displacement, and crisis.",
    subText: "Choose how you'd like to sustain the practice—all members receive the same messages. $5 a month helps—and giving more helps us reach more people.",
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
          title: result.data.hero?.title || defaultContent.hero.title,
          subtitle: result.data.hero?.subtitle || defaultContent.hero.subtitle,
        },
        intro: {
          mainText: result.data.intro?.mainText || defaultContent.intro.mainText,
          subText: result.data.intro?.subText || defaultContent.intro.subText,
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

