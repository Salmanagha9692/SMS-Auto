import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';

/**
 * MessageBird SMS Webhook handler
 * Receives SMS webhook events from MessageBird and saves phone numbers to Airtable when message is "LOVE"
 */
export async function POST(request: NextRequest) {
  try {
    // ── STEP 1: Receive the webhook data from MessageBird ──
    const body = await request.json();
    
    // ── STEP 2: Extract phone number from payload ──
    // MessageBird payload structure: sender.contact.identifierValue for incoming messages
    const phoneNumber = body?.sender?.contact?.identifierValue 
      || body?.sender?.connector?.identifierValue 
      || body?.sender?.identifierValue 
      || body?.originator;
    
    // ── STEP 3: Extract message text ──
    // MessageBird payload structure: body.text.text for message content
    const message = (body?.body?.text?.text || body?.text?.text || "").trim().toUpperCase();
    
    console.log("📱 SMS Received:");
    console.log("   Phone:", phoneNumber);
    console.log("   Message:", message);
    
    // ── STEP 4: Validate phone number exists ──
    if (!phoneNumber) {
      console.warn("⚠️  No phone number found in webhook payload");
      return NextResponse.json({ status: "received", warning: "No phone number found" }, { status: 200 });
    }
    
    // ── STEP 5: Check if message is "LOVE" ──
    if (message === "LOVE") {
      
      // ── STEP 6: Check if phone already exists in Airtable ──
      const existingRecord = await airtableService.findByPhone(phoneNumber);
      
      if (existingRecord) {
        // Phone exists → Update record
        console.log("🔄 Phone exists, updating...");
        await airtableService.updatePhoneRecord(existingRecord.id, phoneNumber, message);
        console.log("✅ Phone record updated successfully");
      } else {
        // Phone is new → Create new record
        console.log("🆕 New phone, creating record...");
        await airtableService.createPhoneRecord(phoneNumber, message);
        console.log("✅ Phone record created successfully");
      }
    } else {
      console.log("ℹ️  Message is not 'LOVE', skipping Airtable operation");
    }
    
    // ── STEP 7: Return 200 to MessageBird ──
    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (error: any) {
    console.error('Error handling SMS webhook:', error);
    // Still return 200 to prevent MessageBird from retrying
    return NextResponse.json({ status: "received", error: error.message }, { status: 200 });
  }
}

