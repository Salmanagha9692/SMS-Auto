import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';

/**
 * Update or create content in Airtable
 * POST /api/airtable/content
 * Updates or creates header and/or hero content in Airtable content table
 * 
 * Request body:
 * {
 *   header?: {
 *     logoUrl?: string;
 *     logoAlt?: string;
 *   };
 *   hero?: {
 *     title: string;  // Main title (e.g., "COMMUNITY WEFT*")
 *     subtitle: string;  // Subtitle (e.g., "a practice in compassion & connection")
 *   };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { header, hero, messages } = body;

    if (!header && !hero && !messages) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        message: 'At least one of header, hero, or messages data is required'
      }, { status: 400 });
    }

    // Validate hero structure if provided
    if (hero) {
      if (typeof hero.title !== 'string' || typeof hero.subtitle !== 'string') {
        return NextResponse.json({
          success: false,
          error: 'Validation error',
          message: 'Hero section must contain both title (string) and subtitle (string)'
        }, { status: 400 });
      }
    }

    // Validate messages structure if provided
    if (messages) {
      const requiredFields = ['loveReply', 'unsubReply', 'stopReply', 'welcomeMessage', 'monthlyMessage'];
      for (const field of requiredFields) {
        if (typeof messages[field] !== 'string') {
          return NextResponse.json({
            success: false,
            error: 'Validation error',
            message: `Messages section must contain ${field} as a string`
          }, { status: 400 });
        }
      }
    }

    const contentData: { header?: any; hero?: any; messages?: any } = {};
    if (header) {
      contentData.header = {
        logoUrl: header.logoUrl || '',
        logoAlt: header.logoAlt || ''
      };
    }
    if (hero) {
      // Only include title and subtitle, ignore any old highlights field
      contentData.hero = {
        title: hero.title,
        subtitle: hero.subtitle
      };
    }
    if (messages) {
      contentData.messages = {
        loveReply: messages.loveReply,
        unsubReply: messages.unsubReply,
        stopReply: messages.stopReply,
        welcomeMessage: messages.welcomeMessage,
        monthlyMessage: messages.monthlyMessage
      };
    }

    const result = await airtableService.updateContent(contentData);
    
    return NextResponse.json({
      success: true,
      message: 'Content updated successfully',
      data: result
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating content:', error);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update content',
      message: errorMessage
    }, { status: statusCode });
  }
}

/**
 * Get content from Airtable
 * GET /api/airtable/content
 * Retrieves header and hero content from Airtable content table
 * 
 * Response:
 * {
 *   success: boolean;
 *   data: {
 *     header?: {
 *       logoUrl: string;
 *       logoAlt: string;
 *     };
 *     hero?: {
 *       title: string;  // Main title
 *       subtitle: string;  // Subtitle
 *     };
 *   };
 * }
 */
export async function GET() {
  try {
    const content = await airtableService.getContent();
    
    return NextResponse.json({
      success: true,
      data: content
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error getting content:', error);
    
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data || error.message;
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get content',
      message: errorMessage
    }, { status: statusCode });
  }
}

