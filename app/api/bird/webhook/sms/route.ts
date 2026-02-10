import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';

/**
 * Bird.com SMS Webhook handler
 * Receives SMS webhook events from Bird.com and saves phone numbers to Airtable
 * 
 * POST /api/bird/webhook/sms
 * 
 * This webhook processes incoming SMS messages and saves them to Airtable
 * using the same logic as /api/bird/sync-automation
 */
export async function POST(request: NextRequest) {
  try {
    // ── STEP 1: Receive the webhook data from Bird.com ──
    let body: any;
    
    try {
      // Try to parse as JSON
      const text = await request.text();
      body = JSON.parse(text);
    } catch (parseError) {
      // If JSON parsing fails, try to get it as object
      try {
        body = await request.json();
      } catch (e) {
        console.error('❌ Failed to parse webhook body:', e);
        return NextResponse.json({ 
          status: 'error', 
          message: 'Invalid JSON payload' 
        }, { status: 400 });
      }
    }
    
    console.log('📱 SMS Webhook received:', JSON.stringify(body, null, 2));
    
    // ── Handle nested payloads (some webhooks send { data: {...} } or { event: {...} }) ──
    let payload = body;
    if (body.data) {
      payload = body.data;
      console.log('📦 Found nested data payload');
    } else if (body.event) {
      payload = body.event;
      console.log('📦 Found nested event payload');
    } else if (body.message) {
      payload = body.message;
      console.log('📦 Found nested message payload');
    }
    
    // ── STEP 2: Extract phone number using same logic as sync-automation ──
    const phoneNumber = extractSenderNumber(payload);
    
    // ── STEP 3: Extract message text using same logic as sync-automation ──
    const messageText = extractMessageText(payload);
    
    console.log('📱 SMS Received:');
    console.log('   Phone:', phoneNumber);
    console.log('   Message:', messageText);
    
    // ── STEP 4: Validate phone number exists ──
    if (!phoneNumber || phoneNumber === 'Unknown') {
      console.warn('⚠️  No valid phone number found in webhook payload');
      return NextResponse.json({ 
        status: 'received', 
        warning: 'No valid phone number found' 
      }, { status: 200 });
    }
    
    // ── STEP 5: Normalize phone number (same as sync-automation) ──
    const normalizedPhone = phoneNumber.replace(/\s+/g, '');
    
    // ── STEP 6: Check if phone already exists in Airtable (same as sync-automation) ──
    const existingRecord = await airtableService.findByPhone(normalizedPhone);
    
    if (existingRecord) {
      // Phone exists → Update record (same as sync-automation)
      console.log('🔄 Phone exists, updating...');
      await airtableService.updatePhoneRecord(existingRecord.id, normalizedPhone, messageText);
      console.log('✅ Phone record updated successfully');
    } else {
      // Phone is new → Create new record (same as sync-automation)
      console.log('🆕 New phone, creating record...');
      await airtableService.createPhoneRecord(normalizedPhone, messageText);
      console.log('✅ Phone record created successfully');
    }
    
    // ── STEP 7: Return 200 to Bird.com ──
    return NextResponse.json({ 
      status: 'received',
      phone: normalizedPhone,
      message: messageText,
      action: existingRecord ? 'updated' : 'created'
    }, { status: 200 });
    
  } catch (error: any) {
    console.error('❌ Error handling SMS webhook:', error);
    // Still return 200 to prevent Bird.com from retrying
    return NextResponse.json({ 
      status: 'received', 
      error: error.message 
    }, { status: 200 });
  }
}

/**
 * Extract sender phone number from webhook payload
 * Uses the same extraction logic as sync-automation
 */
function extractSenderNumber(msg: any): string {
  return (
    // Bird.com Conversations API format
    msg.sender?.contact?.identifierValue ||
    msg.sender?.contact?.platformAddress ||
    msg.sender?.contact?.msisdn ||
    msg.sender?.identifierValue ||
    msg.sender?.platformAddress ||
    msg.sender?.phoneNumber ||
    // Contact object format
    msg.contact?.identifierValue ||
    msg.contact?.platformAddress ||
    msg.contact?.msisdn ||
    // Classic SMS API format
    msg.from ||
    msg.originator ||
    // Alternative formats
    msg.phoneNumber ||
    msg.phone ||
    msg.msisdn ||
    'Unknown'
  );
}

/**
 * Extract message text from webhook payload
 * Uses the same extraction logic as sync-automation
 */
function extractMessageText(msg: any): string {
  const text = (
    // Bird.com Conversations API format
    msg.preview?.text ||
    msg.content?.text ||
    msg.body?.text?.text ||
    msg.body?.text ||
    // Direct body
    (typeof msg.body === 'string' ? msg.body : null) ||
    // Classic SMS API format
    msg.message ||
    msg.text ||
    // Alternative formats
    msg.content ||
    ''
  );
  
  return typeof text === 'string' ? text : (text?.text || JSON.stringify(text) || '');
}

