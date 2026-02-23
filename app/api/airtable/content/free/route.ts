import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';

/**
 * GET /api/airtable/content/free
 * Returns free landing page content (header, hero, intro, messages)
 */
export async function GET() {
  try {
    const content = await airtableService.getFreeContent();
    return NextResponse.json({ success: true, data: content }, { status: 200 });
  } catch (error: any) {
    console.error('Error getting free content:', error);
    const statusCode = error.response?.status || 500;
    return NextResponse.json(
      { success: false, error: 'Failed to get free content', message: error.message },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/airtable/content/free
 * Updates free landing page content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { header, hero, intro, messages } = body;

    if (!header && !hero && !intro && !messages) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        message: 'At least one of header, hero, intro, or messages is required',
      }, { status: 400 });
    }

    if (hero && (typeof hero.title !== 'string' || typeof hero.subtitle !== 'string')) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        message: 'Hero must have title and subtitle (strings)',
      }, { status: 400 });
    }

    const contentData: { header?: any; hero?: any; intro?: any; messages?: any } = {};
    if (header) contentData.header = { logoUrl: header.logoUrl ?? '', logoAlt: header.logoAlt ?? '' };
    if (hero) contentData.hero = { title: hero.title, subtitle: hero.subtitle };
    if (intro) contentData.intro = intro;
    if (messages) {
      contentData.messages = {
        freeReply: messages.freeReply ?? '',
        welcomeMessage1: messages.welcomeMessage1 ?? '',
        welcomeMessage2: messages.welcomeMessage2 ?? '',
        welcomeMessage3: messages.welcomeMessage3 ?? '',
        welcomeMessage4: messages.welcomeMessage4 ?? '',
        monthlyMessage: messages.monthlyMessage ?? '',
      };
    }

    const result = await airtableService.updateFreeContent(contentData);
    return NextResponse.json({ success: true, message: 'Free content updated', data: result }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating free content:', error);
    const statusCode = error.response?.status || 500;
    return NextResponse.json(
      { success: false, error: 'Failed to update free content', message: error.message },
      { status: statusCode }
    );
  }
}
