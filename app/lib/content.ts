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

export interface MessageTemplates {
  loveReply: string; // Reply message for LOVE keyword
  unsubReply: string; // Reply message for UNSUB keyword
  stopReply: string; // Reply message for STOP keyword
  welcomeMessage: string; // Welcome message sent after payment
  monthlyMessage: string; // Monthly care message
}

export interface SiteContent {
  header: HeaderContent;
  hero: HeroContent;
  intro: IntroContent;
  messages: MessageTemplates;
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
  messages: {
    loveReply: "Thanks for joining The Weft! Click here: {link}",
    unsubReply: "You have been successfully unsubscribed. You are now free tier user. Thank you for being part of The Weft!",
    stopReply: "You have been successfully unsubscribed. You will no longer receive messages. Reply LOVE to rejoin.",
    welcomeMessage: "Welcome to Community Weft! You are now part of our community. We are excited to have you here. You will receive monthly care messages from our makers. Reply STOP anytime to opt out.",
    monthlyMessage: "Thank you for being part of Community Weft. This is your monthly care message from our makers. We appreciate your continued support. Reply STOP anytime to opt out.",
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
        messages: {
          loveReply: result.data.messages?.loveReply || defaultContent.messages.loveReply,
          unsubReply: result.data.messages?.unsubReply || defaultContent.messages.unsubReply,
          stopReply: result.data.messages?.stopReply || defaultContent.messages.stopReply,
          welcomeMessage: result.data.messages?.welcomeMessage || defaultContent.messages.welcomeMessage,
          monthlyMessage: result.data.messages?.monthlyMessage || defaultContent.messages.monthlyMessage,
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

// Get message templates (server-side only)
export async function getMessageTemplates(): Promise<MessageTemplates> {
  try {
    const content = await getContent();
    return content.messages || defaultContent.messages;
  } catch (error) {
    console.error('Error getting message templates:', error);
    return defaultContent.messages;
  }
}

