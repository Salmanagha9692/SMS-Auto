import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';

/**
 * Update or create content in Airtable
 * POST /api/airtable/content
 * Updates or creates header and/or hero content in Airtable content table
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { header, hero } = body;

    if (!header && !hero) {
      return NextResponse.json({
        success: false,
        error: 'Validation error',
        message: 'At least one of header or hero data is required'
      }, { status: 400 });
    }

    const contentData: { header?: any; hero?: any } = {};
    if (header) contentData.header = header;
    if (hero) contentData.hero = hero;

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

