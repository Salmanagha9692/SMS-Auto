import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';
import { stripe } from '@/app/lib/stripe';
import { sendSMS, sendSMSDirect } from '@/app/lib/bird';

/**
 * Bird.com SMS Webhook Handler
 * 
 * POST /bird-sms-webhook
 * 
 * Receives inbound SMS webhook events from Bird.com and:
 * 1. Saves phone numbers and messages to Airtable
 * 2. Processes UNSUB/UNSUBSCRIBE messages (cancels Stripe subscriptions)
 * 3. Implements idempotency using message IDs
 * 
 * Documentation References:
 * - Receiving messages: https://docs.bird.com/api/channels-api/supported-channels/programmable-sms/receiving-messages
 * - Webhook subscriptions: https://docs.bird.com/api/notifications-api/api-reference/webhook-subscriptions
 * 
 * Configure this URL in Bird.com:
 * Channels → SMS → Your number (+15106716597) → Webhook settings
 * URL: {NGROK_URL}/bird-sms-webhook (from .env file)
 */

// Track processed message IDs for idempotency (in-memory cache)
// In production, consider using Redis or a database for distributed systems
const processedMessageIds = new Set<string>();
const MAX_CACHE_SIZE = 10000; // Prevent memory leaks

/**
 * Handle GET requests for webhook verification
 * Some webhook systems use GET requests for initial verification
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge') || searchParams.get('verification_token');
  
  if (challenge) {
    console.log('🔐 Webhook verification GET request received');
    return NextResponse.json({ 
      challenge: challenge,
      verified: true 
    }, { status: 200 });
  }
  
  // Health check endpoint
  return NextResponse.json({ 
    status: 'ok',
    endpoint: '/bird-sms-webhook',
    method: 'POST',
    message: 'Bird SMS Webhook endpoint is ready'
  }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let messageId: string | null = null;
  
  try {
    // ── STEP 1: Parse webhook payload ──
    const rawBody = await request.text();
    let body: any;
    
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse webhook body as JSON:', parseError);
      // Return 400 for invalid JSON - Bird will retry
      return NextResponse.json({ 
        status: 'error', 
        message: 'Invalid JSON payload' 
      }, { status: 400 });
    }
    
    // Log full payload for debugging
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📱 Bird SMS Webhook Received');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📦 Raw Payload:', JSON.stringify(body, null, 2));
    console.log('📋 Headers:', Object.fromEntries(request.headers.entries()));
    
    // ── STEP 2: Handle webhook verification/challenge (if Bird sends one) ──
    // Some webhook systems send a verification request first
    if (body.type === 'webhook_verification' || body.challenge) {
      console.log('🔐 Webhook verification request received');
      const challenge = body.challenge || body.verification_token;
      return NextResponse.json({ 
        challenge: challenge,
        verified: true 
      }, { status: 200 });
    }
    
    // ── STEP 3: Extract message ID for idempotency ──
    // Try to extract from payload first (Channels API format), then from body
    const payloadForId = (body.payload && (body.service === 'channels' || body.event === 'sms.inbound')) 
      ? body.payload 
      : body;
    messageId = extractMessageId(payloadForId) || extractMessageId(body);
    
    // Check if we've already processed this message (idempotency)
    if (messageId && processedMessageIds.has(messageId)) {
      console.log(`⏭️  Message ${messageId} already processed (idempotency check)`);
      return NextResponse.json({ 
        status: 'received',
        messageId,
        action: 'duplicate',
        message: 'Already processed'
      }, { status: 200 });
    }
    
    // ── STEP 4: Extract payload from nested structures ──
    // Bird may send payloads in different formats:
    // - Channels API: { service: "channels", event: "sms.inbound", payload: {...} }
    // - Direct: { message: {...}, event: {...} }
    // - Nested: { data: { message: {...} } }
    // - Event-based: { event: { type: 'message.created', data: {...} } }
    let payload = body;
    
    // Handle Bird.com Channels API format (most common)
    if (body.payload && body.service === 'channels') {
      payload = body.payload;
      console.log('📦 Found Channels API payload structure');
    } else if (body.data) {
      payload = body.data;
      console.log('📦 Found nested data payload');
    } else if (body.event?.data) {
      payload = body.event.data;
      console.log('📦 Found nested event.data payload');
    } else if (body.event) {
      payload = body.event;
      console.log('📦 Found nested event payload');
    } else if (body.message) {
      payload = body.message;
      console.log('📦 Found nested message payload');
    }
    
    // ── STEP 5: Extract phone number (sender) ──
    const phoneNumber = extractSenderNumber(payload);
    
    // ── STEP 6: Extract message text ──
    const messageText = extractMessageText(payload);
    
    // ── STEP 7: Extract recipient (your Bird number) ──
    const recipientNumber = extractRecipientNumber(payload);
    
    // ── STEP 8: Extract conversation ID (for sending replies in same conversation) ──
    const conversationId = extractConversationId(body, payload);
    
    // ── STEP 9: Extract timestamp ──
    const timestamp = extractTimestamp(payload);
    
    console.log('📱 Extracted Data:');
    console.log('   Message ID:', messageId);
    console.log('   From:', phoneNumber);
    console.log('   To:', recipientNumber);
    console.log('   Conversation ID:', conversationId);
    console.log('   Message:', messageText);
    console.log('   Timestamp:', timestamp);
    
    // ── STEP 10: Validate required fields ──
    if (!phoneNumber || phoneNumber === 'Unknown') {
      console.warn('⚠️  No valid phone number found in webhook payload');
      // Still return 200 to prevent Bird from retrying
      return NextResponse.json({ 
        status: 'received', 
        warning: 'No valid phone number found',
        messageId
      }, { status: 200 });
    }
    
    if (!messageText || messageText.trim() === '') {
      console.warn('⚠️  Empty message text in webhook payload');
      // Still return 200 - empty messages are valid
      return NextResponse.json({ 
        status: 'received', 
        warning: 'Empty message text',
        messageId,
        phone: phoneNumber
      }, { status: 200 });
    }
    
    // ── STEP 11: Normalize phone number ──
    const normalizedPhone = phoneNumber.replace(/\s+/g, '').trim();
    
    // ── STEP 12: Check if phone already exists in Airtable ──
    const existingRecord = await airtableService.findByPhone(normalizedPhone);
    
    // ── STEP 13: Save/Update phone record in Airtable ──
    if (existingRecord) {
      console.log('🔄 Phone exists, updating record...');
      await airtableService.updatePhoneRecord(existingRecord.id, normalizedPhone, messageText);
      console.log('✅ Phone record updated successfully');
    } else {
      console.log('🆕 New phone, creating record...');
      await airtableService.createPhoneRecord(normalizedPhone, messageText);
      console.log('✅ Phone record created successfully');
    }
    
    // ── STEP 14: Process special messages (LOVE, FREE, UNSUB, STOP) ──
    // All keywords are case-insensitive
    const messageUpper = messageText.trim().toUpperCase();
    const isLove = messageUpper === 'LOVE';
    const isFree = messageUpper === 'FREE';
    const isUnsub = messageUpper === 'UNSUB' || messageUpper === 'UNSUBSCRIBE';
    const isStop = messageUpper === 'STOP';
    
    let replySent = false;
    let unsubProcessed = false;
    let stopProcessed = false;
    
    // Handle LOVE message - send main welcome link
    if (isLove) {
      console.log(`💚 LOVE detected from ${normalizedPhone} - Sending welcome message...`);
      replySent = await sendLoveReply(normalizedPhone, conversationId);
    }
    
    // Handle FREE message - send free landing page link
    if (isFree) {
      console.log(`🆓 FREE detected from ${normalizedPhone} - Sending free page link...`);
      replySent = await sendFreeReply(normalizedPhone, conversationId);
    }
    
    // Handle UNSUB message - cancel subscription and send confirmation
    if (isUnsub) {
      console.log(`🔔 UNSUB detected from ${normalizedPhone} - Processing unsubscription...`);
      unsubProcessed = await processUnsubscription(normalizedPhone);
      // Send confirmation message immediately in same conversation
      await sendUnsubReply(normalizedPhone, conversationId);
    }
    
    // Handle STOP message - save to Airtable, clear payment records, and send confirmation
    if (isStop) {
      console.log(`🛑 STOP detected from ${normalizedPhone} - Processing stop request...`);
      stopProcessed = await processStopRequest(normalizedPhone);
      // Send confirmation message immediately in same conversation
      await sendStopReply(normalizedPhone, conversationId);
    }
    
    // ── STEP 15: Mark message as processed (idempotency) ──
    if (messageId) {
      processedMessageIds.add(messageId);
      // Prevent memory leaks by limiting cache size
      if (processedMessageIds.size > MAX_CACHE_SIZE) {
        const firstId = processedMessageIds.values().next().value;
        if (firstId) {
          processedMessageIds.delete(firstId);
        }
      }
    }
    
    // ── STEP 16: Return success response ──
    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook processed successfully in ${processingTime}ms`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    return NextResponse.json({ 
      status: 'received',
      messageId,
      phone: normalizedPhone,
      message: messageText,
      action: existingRecord ? 'updated' : 'created',
      replySent,
      unsubProcessed,
      stopProcessed,
      processingTimeMs: processingTime
    }, { status: 200 });
    
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Error handling SMS webhook:', error);
    console.error('   Message ID:', messageId);
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════\n');
    
    // Return 200 to prevent Bird from retrying (unless it's a parsing error)
    // For parsing errors, we already returned 400 above
    // For other errors, return 200 to acknowledge receipt
    return NextResponse.json({ 
      status: 'received', 
      error: error.message,
      messageId,
      processingTimeMs: processingTime
    }, { status: 200 });
  }
}

/**
 * Send SMS in specific conversation (ensures same conversation thread)
 */
async function sendSMSInConversation(phoneNumber: string, message: string, conversationId: string | null): Promise<boolean> {
  try {
    const BIRD_API_KEY = process.env.BIRD_API_KEY || process.env.MESSAGEBIRD_API_KEY;
    const BIRD_WORKSPACE_ID = process.env.BIRD_WORKSPACE_ID || '9dbb8094-b8df-45a4-91d1-8a00bbfe4d6e';
    const API_BASE = 'https://api.bird.com';
    
    if (!BIRD_API_KEY || !BIRD_WORKSPACE_ID) {
      throw new Error('Bird API configuration missing');
    }
    
    const normalizedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber.trim() 
      : `+${phoneNumber.trim()}`;
    
    // If conversation ID is provided, use it directly
    if (conversationId) {
      console.log(`   📤 Sending reply in conversation ${conversationId}`);
      const sendMessageUrl = `${API_BASE}/workspaces/${BIRD_WORKSPACE_ID}/conversations/${conversationId}/messages`;
      
      const response = await fetch(sendMessageUrl, {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${BIRD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: {
            text: message.trim()
          },
          direction: 'outgoing'
        })
      });
      
      if (response.ok) {
        console.log(`   ✅ Reply sent successfully in same conversation`);
        return true;
      } else {
        const errorText = await response.text();
        console.error(`   ⚠️  Conversation API failed: ${response.status} - ${errorText}`);
        // Fall through to use sendSMS which will find/create conversation
      }
    }
    
    // Fallback: use sendSMS which finds/creates conversation
    console.log(`   📤 Sending reply using conversation find/create`);
    await sendSMS(normalizedPhone, message);
    return true;
    
  } catch (error: any) {
    console.error(`   ❌ Error sending SMS in conversation:`, error.message);
    // Final fallback: try direct method
    try {
      await sendSMSDirect(phoneNumber, message);
      return true;
    } catch (directError: any) {
      console.error(`   ❌ All methods failed:`, directError.message);
      return false;
    }
  }
}

/**
 * Get the base URL from environment variable
 */
function getBaseUrl(): string {
  const ngrokUrl = process.env.NGROK_URL;
  if (ngrokUrl) {
    // Remove trailing slash if present
    return ngrokUrl.replace(/\/$/, '');
  }
  // Fallback to localhost for development
  return 'http://localhost:3000';
}

/**
 * Send LOVE reply message with welcome link (main landing page)
 * Sends in the same conversation as the incoming message
 */
async function sendLoveReply(phoneNumber: string, conversationId: string | null): Promise<boolean> {
  try {
    // Get message template from Airtable
    const messages = await airtableService.getMessageTemplates();
    const encodedPhone = encodeURIComponent(phoneNumber);
    const baseUrl = getBaseUrl();
    const welcomeLink = `${baseUrl}/?phone=${encodedPhone}`;
    const replyMessage = messages.loveReply.replace('{link}', welcomeLink);
    
    console.log(`   📤 Sending LOVE reply to ${phoneNumber}`);
    return await sendSMSInConversation(phoneNumber, replyMessage, conversationId);
  } catch (error: any) {
    console.error(`   ❌ Error sending LOVE reply:`, error.message);
    return false;
  }
}

/**
 * Send FREE reply message with free landing page link
 * Sends in the same conversation as the incoming message
 */
async function sendFreeReply(phoneNumber: string, conversationId: string | null): Promise<boolean> {
  try {
    const messages = await airtableService.getFreeMessageTemplates();
    const encodedPhone = encodeURIComponent(phoneNumber);
    const baseUrl = getBaseUrl();
    const freeLink = `${baseUrl}/free?phone=${encodedPhone}`;
    const replyMessage = messages.freeReply.replace('{link}', freeLink);
    
    console.log(`   📤 Sending FREE reply to ${phoneNumber} with link: ${freeLink}`);
    return await sendSMSInConversation(phoneNumber, replyMessage, conversationId);
  } catch (error: any) {
    console.error(`   ❌ Error sending FREE reply:`, error.message);
    return false;
  }
}

/**
 * Send UNSUB confirmation reply message
 * Sends in the same conversation as the incoming message
 */
async function sendUnsubReply(phoneNumber: string, conversationId: string | null): Promise<boolean> {
  try {
    // Get message template from Airtable
    const messages = await airtableService.getMessageTemplates();
    const replyMessage = messages.unsubReply;
    
    console.log(`   📤 Sending UNSUB confirmation to ${phoneNumber}`);
    return await sendSMSInConversation(phoneNumber, replyMessage, conversationId);
  } catch (error: any) {
    console.error(`   ❌ Error sending UNSUB confirmation:`, error.message);
    return false;
  }
}

/**
 * Send STOP confirmation reply message
 * Sends in the same conversation as the incoming message
 */
async function sendStopReply(phoneNumber: string, conversationId: string | null): Promise<boolean> {
  try {
    // Get message template from Airtable
    const messages = await airtableService.getMessageTemplates();
    const replyMessage = messages.stopReply;
    
    console.log(`   📤 Sending STOP confirmation to ${phoneNumber}`);
    return await sendSMSInConversation(phoneNumber, replyMessage, conversationId);
  } catch (error: any) {
    console.error(`   ❌ Error sending STOP confirmation:`, error.message);
    return false;
  }
}

/**
 * Process STOP request
 * Saves STOP message to Airtable and clears payment records
 */
async function processStopRequest(phoneNumber: string): Promise<boolean> {
  try {
    // STOP message is already saved to Airtable in the main flow above
    // Now we need to clear payment records
    
    // Find payment record
    const paymentRecord = await airtableService.findPaymentByPhone(phoneNumber);
    
    if (!paymentRecord) {
      console.log(`      ℹ️  No payment record found for ${phoneNumber}`);
      // STOP message is still saved to phone table, so return true
      return true;
    }
    
    const tier = paymentRecord.fields?.['Tier'];
    const status = paymentRecord.fields?.['Status'];
    const stripeSubscriptionId = paymentRecord.fields?.['Stripe Subscription ID'];
    
    // Cancel Stripe subscription if it exists and is active
    if (stripeSubscriptionId && typeof stripeSubscriptionId === 'string' && status === 'active') {
      try {
        console.log(`      💳 Cancelling Stripe subscription: ${stripeSubscriptionId}`);
        await stripe.subscriptions.cancel(stripeSubscriptionId);
        console.log(`      ✅ Stripe subscription cancelled successfully`);
      } catch (stripeError: any) {
        console.error(`      ⚠️  Error cancelling Stripe subscription:`, stripeError.message);
        // Continue with Airtable update even if Stripe fails
      }
    }
    
    // Clear payment record - set to free tier and clear all Stripe fields
    console.log(`      📝 Clearing payment record in Airtable...`);
    await airtableService.updatePaymentRecord(paymentRecord.id, {
      tier: 'free',
      amount: 0,
      status: 'cancelled',
      // Clear all Stripe-related fields
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePaymentIntentId: '',
      stripeSessionId: '',
    });
    
    console.log(`      ✅ Successfully processed STOP for ${phoneNumber} - payment record cleared`);
    return true;
    
  } catch (stopError: any) {
    console.error(`      ❌ Error processing STOP request for ${phoneNumber}:`, stopError.message);
    return false;
  }
}

/**
 * Process unsubscription request
 * Cancels Stripe subscription and updates Airtable to free tier
 */
async function processUnsubscription(phoneNumber: string): Promise<boolean> {
  try {
    // Find payment record
    const paymentRecord = await airtableService.findPaymentByPhone(phoneNumber);
    
    if (!paymentRecord) {
      console.log(`      ℹ️  No payment record found for ${phoneNumber}`);
      return false;
    }
    
    const tier = paymentRecord.fields?.['Tier'];
    const status = paymentRecord.fields?.['Status'];
    const stripeSubscriptionId = paymentRecord.fields?.['Stripe Subscription ID'];
    
    // Only process if they have an active paid subscription
    if (!tier || tier === 'free' || status !== 'active') {
      console.log(`      ℹ️  No active paid subscription found for ${phoneNumber} (tier: ${tier}, status: ${status})`);
      return false;
    }
    
    // Cancel Stripe subscription if it exists
    if (stripeSubscriptionId && typeof stripeSubscriptionId === 'string') {
      try {
        console.log(`      💳 Cancelling Stripe subscription: ${stripeSubscriptionId}`);
        await stripe.subscriptions.cancel(stripeSubscriptionId);
        console.log(`      ✅ Stripe subscription cancelled successfully`);
      } catch (stripeError: any) {
        console.error(`      ⚠️  Error cancelling Stripe subscription:`, stripeError.message);
        // Continue with Airtable update even if Stripe fails
      }
    }
    
    // Update Airtable to free tier (exactly like free tier signup)
    console.log(`      📝 Updating to free tier in Airtable...`);
    await airtableService.updatePaymentRecord(paymentRecord.id, {
      tier: 'free',
      amount: 0,
      status: 'completed',
      // Clear all Stripe-related fields
      stripeCustomerId: '',
      stripeSubscriptionId: '',
      stripePaymentIntentId: '',
      stripeSessionId: '',
    });
    
    console.log(`      ✅ Successfully unsubscribed ${phoneNumber} - moved to free tier`);
    return true;
    
  } catch (unsubError: any) {
    console.error(`      ❌ Error processing unsubscription for ${phoneNumber}:`, unsubError.message);
    return false;
  }
}

/**
 * Extract message ID from webhook payload for idempotency
 * Bird.com may use different field names for message IDs
 */
function extractMessageId(msg: any): string | null {
  return (
    msg.id ||
    msg.messageId ||
    msg.message_id ||
    msg.eventId ||
    msg.event_id ||
    msg.webhookId ||
    msg.webhook_id ||
    null
  );
}

/**
 * Extract sender phone number from webhook payload
 * Handles all Bird.com payload formats per documentation:
 * - Conversations API format (sender.contact.identifierValue)
 * - Channels API format (from, originator)
 * - Classic SMS API format (msisdn, phoneNumber)
 * 
 * Reference: https://docs.bird.com/api/channels-api/supported-channels/programmable-sms/receiving-messages
 */
function extractSenderNumber(msg: any): string {
  // Try Conversations API format first (most common for webhooks)
  if (msg.sender) {
    if (msg.sender.contact) {
      return (
        msg.sender.contact.identifierValue ||
        msg.sender.contact.platformAddress ||
        msg.sender.contact.msisdn ||
        msg.sender.contact.phoneNumber ||
        ''
      );
    }
    // Direct sender properties
    return (
      msg.sender.identifierValue ||
      msg.sender.platformAddress ||
      msg.sender.msisdn ||
      msg.sender.phoneNumber ||
      ''
    );
  }
  
  // Try contact object format
  if (msg.contact) {
    return (
      msg.contact.identifierValue ||
      msg.contact.platformAddress ||
      msg.contact.msisdn ||
      msg.contact.phoneNumber ||
      ''
    );
  }
  
  // Classic SMS API format
  return (
    msg.from ||
    msg.originator ||
    msg.phoneNumber ||
    msg.phone ||
    msg.msisdn ||
    msg.source ||
    'Unknown'
  );
}

/**
 * Extract recipient phone number (your Bird number)
 * Used for validation and logging
 */
function extractRecipientNumber(msg: any): string {
  // Try Conversations API format
  if (msg.recipient) {
    if (msg.recipient.contact) {
      return (
        msg.recipient.contact.identifierValue ||
        msg.recipient.contact.platformAddress ||
        msg.recipient.contact.msisdn ||
        ''
      );
    }
    return (
      msg.recipient.identifierValue ||
      msg.recipient.platformAddress ||
      msg.recipient.msisdn ||
      ''
    );
  }
  
  // Classic SMS API format
  return (
    msg.to ||
    msg.destination ||
    msg.recipient ||
    ''
  );
}

/**
 * Extract message text from webhook payload
 * Handles all Bird.com payload formats per documentation:
 * - Conversations API format (preview.text, content.text)
 * - Channels API format (body.text, body)
 * - Classic SMS API format (message, text)
 * 
 * Reference: https://docs.bird.com/api/channels-api/supported-channels/programmable-sms/receiving-messages
 */
function extractMessageText(msg: any): string {
  // Try Bird.com Channels API format first (most common for webhooks)
  // Format: { body: { type: "text", text: { text: "LOVE" } } }
  if (msg.body) {
    if (msg.body.text) {
      if (typeof msg.body.text === 'string') {
        return msg.body.text;
      }
      if (msg.body.text.text) {
        return String(msg.body.text.text);
      }
    }
    if (typeof msg.body === 'string') {
      return msg.body;
    }
  }
  
  // Try Conversations API format
  if (msg.preview?.text) {
    return String(msg.preview.text);
  }
  
  if (msg.content) {
    if (typeof msg.content === 'string') {
      return msg.content;
    }
    if (msg.content.text) {
      return String(msg.content.text);
    }
  }
  
  // Classic SMS API format
  if (msg.message) {
    return String(msg.message);
  }
  
  if (msg.text) {
    return String(msg.text);
  }
  
  // Fallback to content if it's a string
  if (typeof msg.content === 'string') {
    return msg.content;
  }
  
  // Last resort: try to stringify nested objects
  if (msg.body && typeof msg.body === 'object') {
    try {
      return JSON.stringify(msg.body);
    } catch (e) {
      // Ignore
    }
  }
  
  return '';
}

/**
 * Extract conversation ID from webhook payload
 * Used to send replies in the same conversation thread
 */
function extractConversationId(body: any, payload: any): string | null {
  // Try multiple locations where conversation ID might be
  return (
    payload.conversationId ||
    payload.conversation_id ||
    payload.conversation?.id ||
    body.conversationId ||
    body.conversation_id ||
    body.conversation?.id ||
    payload.context?.conversationId ||
    payload.context?.conversation_id ||
    null
  );
}

/**
 * Extract timestamp from webhook payload
 * Returns ISO string or current time if not found
 */
function extractTimestamp(msg: any): string {
  return (
    msg.createdAt ||
    msg.created_at ||
    msg.timestamp ||
    msg.time ||
    msg.date ||
    msg.receivedAt ||
    msg.received_at ||
    new Date().toISOString()
  );
}

