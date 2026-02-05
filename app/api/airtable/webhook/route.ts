import { NextRequest, NextResponse } from 'next/server';

/**
 * Airtable webhook handler
 * Receives webhook events from Airtable
 */
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();

    console.log('Airtable webhook received:', JSON.stringify(event, null, 2));

    // Always respond 200 OK immediately
    const response = NextResponse.json({ status: "received" }, { status: 200 });

    // Process event asynchronously (fire and forget)
    setImmediate(async () => {
      try {
        // Handle different webhook event types
        if (event.base) {
          console.log('📊 Base event:', event.base.id);
        }
        if (event.webhook) {
          console.log('🔔 Webhook event:', event.webhook.id);
        }
        // Add more webhook processing logic as needed
      } catch (error) {
        console.error('Error processing webhook:', error);
      }
    });

    return response;
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    // Still respond 200 to prevent retries
    return NextResponse.json({ status: "received", error: error.message }, { status: 200 });
  }
}

