import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';
import { stripe } from '@/app/lib/stripe';

/**
 * Bird.com Automation Messages Sync to Airtable
 * 
 * Fetches ALL inbound automation messages from Bird.com and syncs to Airtable
 * 
 * This is like your webhook, but fetches ALL historical messages at once (no limit)
 * 
 * GET /api/bird/sync-automation - Fetch ALL messages and sync to Airtable
 * GET /api/bird/sync-automation?dryRun=true - Preview without saving to Airtable
 */

const BIRD_API_KEY = process.env.BIRD_API_KEY || process.env.MESSAGEBIRD_API_KEY;
const BIRD_CHANNEL_ID = process.env.BIRD_CHANNEL_ID;
const BIRD_WORKSPACE_ID = process.env.BIRD_WORKSPACE_ID || '9dbb8094-b8df-45a4-91d1-8a00bbfe4d6e';
const API_BASE = 'https://api.bird.com';

interface InboundMessage {
  id: string;
  senderNumber: string;
  messageText: string;
  receivedAt: string;
  direction: string;
  status: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 Syncing Automation Messages to Airtable');
    console.log(`🏢 Workspace: ${BIRD_WORKSPACE_ID}`);
    console.log(`📡 Channel: ${BIRD_CHANNEL_ID}`);
    console.log(`🧪 Dry Run: ${dryRun}`);
    console.log(`🤖 Fetching ALL automation messages (no limit)`);
    console.log('═══════════════════════════════════════════════════════════');

    // Validate environment
    if (!BIRD_API_KEY || !BIRD_CHANNEL_ID || !BIRD_WORKSPACE_ID) {
      throw new Error('Missing required environment variables');
    }

    // Fetch automation messages using Direct API
    const messages = await fetchAutomationMessages(BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID);
    
    console.log(`✅ Fetched ${messages.length} automation messages`);

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        summary: {
          totalMessages: 0,
          uniqueSenders: 0,
          created: 0,
          updated: 0,
          errors: 0
        },
        senders: []
      });
    }

    // Group by sender phone number - keep only latest message from each
    const senderMap = new Map<string, InboundMessage>();

    for (const msg of messages) {
      const phone = msg.senderNumber;
      
      if (!phone || phone === 'Unknown') {
        continue;
      }

      // Normalize phone number (remove spaces)
      const normalizedPhone = phone.replace(/\s+/g, '');

      const existing = senderMap.get(normalizedPhone);
      
      // Keep the latest message
      if (!existing || new Date(msg.receivedAt).getTime() > new Date(existing.receivedAt).getTime()) {
        senderMap.set(normalizedPhone, msg);
      }
    }

    // Convert to array and sort by date (newest first)
    const uniqueSenders = Array.from(senderMap.values()).sort((a, b) => {
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

    console.log(`👥 Found ${uniqueSenders.length} unique senders`);

    // Sync to Airtable and process UNSUB messages
    const results = {
      created: 0,
      updated: 0,
      errors: 0,
      unsubscribed: 0,
      senders: [] as any[]
    };

    if (!dryRun) {
      console.log('💾 Saving to Airtable...');
      
      for (const sender of uniqueSenders) {
        try {
          const phoneNumber = sender.senderNumber;
          const message = sender.messageText;
          const messageUpper = message.trim().toUpperCase();

          // Check if message is UNSUB or UNSUBSCRIBE
          const isUnsub = messageUpper === 'UNSUB' || messageUpper === 'UNSUBSCRIBE';

          // Check if phone exists in Airtable
          const existingRecord = await airtableService.findByPhone(phoneNumber);

          if (existingRecord) {
            // Update existing record
            await airtableService.updatePhoneRecord(existingRecord.id, phoneNumber, message);
            results.updated++;
            console.log(`   🔄 Updated: ${phoneNumber}`);
          } else {
            // Create new record
            await airtableService.createPhoneRecord(phoneNumber, message);
            results.created++;
            console.log(`   🆕 Created: ${phoneNumber}`);
          }

          // Process UNSUB automatically
          if (isUnsub) {
            console.log(`   🔔 UNSUB detected from ${phoneNumber} - Processing unsubscription...`);
            
            try {
              // Find payment record
              const paymentRecord = await airtableService.findPaymentByPhone(phoneNumber);
              
              if (paymentRecord) {
                const tier = paymentRecord.fields?.['Tier'];
                const status = paymentRecord.fields?.['Status'];
                const stripeSubscriptionId = paymentRecord.fields?.['Stripe Subscription ID'];

                // Only process if they have an active paid subscription
                if (tier && tier !== 'free' && status === 'active') {
                  // Cancel Stripe subscription if it exists
                  if (stripeSubscriptionId && typeof stripeSubscriptionId === 'string') {
                    try {
                      console.log(`      💳 Cancelling Stripe subscription: ${stripeSubscriptionId}`);
                      await stripe.subscriptions.cancel(stripeSubscriptionId);
                      console.log(`      ✅ Stripe subscription cancelled`);
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

                  results.unsubscribed++;
                  console.log(`      ✅ Successfully unsubscribed ${phoneNumber} - moved to free tier`);
                  
                  // Note: Confirmation message is sent automatically by Bird.com dashboard automation
                } else {
                  console.log(`      ℹ️  No active paid subscription found for ${phoneNumber}`);
                }
              } else {
                console.log(`      ℹ️  No payment record found for ${phoneNumber}`);
              }
            } catch (unsubError: any) {
              console.error(`      ❌ Error processing unsubscription for ${phoneNumber}:`, unsubError.message);
              // Don't count as error in main results, just log it
            }
          }

          results.senders.push({
            phone: phoneNumber,
            message: message,
            receivedAt: sender.receivedAt,
            status: existingRecord ? 'updated' : 'created',
            unsubProcessed: isUnsub
          });

        } catch (error: any) {
          results.errors++;
          console.error(`   ❌ Error syncing ${sender.senderNumber}:`, error.message);
        }
      }
    } else {
      // Dry run - just preview
      console.log('🔍 Dry run - no changes to Airtable');
      results.senders = uniqueSenders.map(s => ({
        phone: s.senderNumber,
        message: s.messageText,
        receivedAt: s.receivedAt,
        status: 'preview'
      }));
    }

    console.log('───────────────────────────────────────────────────────────');
    console.log(`📊 Sync Results:`);
    console.log(`   🆕 Created: ${results.created}`);
    console.log(`   🔄 Updated: ${results.updated}`);
    console.log(`   🔔 Unsubscribed: ${results.unsubscribed}`);
    console.log(`   ❌ Errors: ${results.errors}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalMessages: messages.length,
        uniqueSenders: uniqueSenders.length,
        created: results.created,
        updated: results.updated,
        unsubscribed: results.unsubscribed,
        errors: results.errors
      },
      senders: results.senders
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Error syncing messages:', error.message);
    console.error('═══════════════════════════════════════════════════════════\n');
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Fetch AUTOMATION messages from Bird Channels API
 * Fetches ALL messages (no limit) and filters for automation/campaign messages
 * Uses Direct API: /workspaces/{id}/channels/{id}/messages
 */
async function fetchAutomationMessages(
  workspaceId: string,
  channelId: string
): Promise<InboundMessage[]> {
  const allMessages: InboundMessage[] = [];
  let offset = 0;
  const pageSize = 100;
  let totalFetched = 0;

  console.log('📡 Fetching ALL messages from Direct Channels API...');

  // Fetch ALL pages until no more messages
  while (true) {
    const url = `${API_BASE}/workspaces/${workspaceId}/channels/${channelId}/messages?limit=${pageSize}&offset=${offset}`;
    
    console.log(`   📥 Page ${Math.floor(offset / pageSize) + 1} (offset: ${offset})...`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ API Error: ${response.status} - ${errorText}`);
      break;
    }

    const data = await response.json();
    const messages = data.results || data.items || data.data || data.messages || [];
    
    if (messages.length === 0) {
      console.log('   ✓ No more messages - reached end');
      break;
    }
    
    totalFetched += messages.length;
    console.log(`   ✓ Fetched ${messages.length} messages (total: ${totalFetched})`);
    
    // Filter and parse AUTOMATION messages only
    for (const msg of messages) {
      // Check if it's an INBOUND message (received FROM someone)
      const isInbound = msg.direction === 'received' || 
                        msg.direction === 'incoming' ||
                        msg.direction === 'inbound';

      if (!isInbound) {
        continue; // Skip outbound messages
      }

      // Check if it's an AUTOMATION/CAMPAIGN related message
      // Automation messages typically have tags, reference, or campaign context
      const isAutomation = msg.tags?.length > 0 || 
                          msg.reference || 
                          msg.context?.type === 'campaign' ||
                          msg.context?.type === 'automation';

      // For now, include ALL inbound messages
      // (You can enable the automation filter by uncommenting the next 3 lines)
      // if (!isAutomation) {
      //   continue; // Skip non-automation messages
      // }

      // Extract sender phone number
      const senderNumber = extractSenderNumber(msg);
      
      // Extract message text
      const messageText = extractMessageText(msg);

      // Only add if we have both phone and message
      if (senderNumber && senderNumber !== 'Unknown' && messageText) {
        allMessages.push({
          id: msg.id,
          senderNumber,
          messageText,
          receivedAt: msg.createdAt || msg.timestamp || new Date().toISOString(),
          direction: msg.direction || 'received',
          status: msg.status || 'delivered'
        });
      }
    }
    
    // Stop if we got fewer messages than page size (last page)
    if (messages.length < pageSize) {
      console.log('   ✓ Last page reached');
      break;
    }
    
    offset += pageSize;
  }

  console.log(`✅ Total fetched: ${totalFetched} messages`);
  console.log(`✅ Total inbound messages: ${allMessages.length}`);
  
  // Show date range
  if (allMessages.length > 0) {
    const dates = allMessages.map(m => m.receivedAt).sort();
    console.log(`📅 Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  return allMessages;
}

/**
 * Extract sender phone number from message
 */
function extractSenderNumber(msg: any): string {
  return (
    msg.sender?.contact?.identifierValue ||
    msg.sender?.identifierValue ||
    msg.sender?.platformAddress ||
    msg.sender?.phoneNumber ||
    msg.from ||
    msg.originator ||
    msg.contact?.identifierValue ||
    msg.contact?.platformAddress ||
    msg.phoneNumber ||
    msg.msisdn ||
    'Unknown'
  );
}

/**
 * Extract message text
 */
function extractMessageText(msg: any): string {
  const text = (
    msg.preview?.text ||
    msg.content?.text ||
    msg.body?.text?.text ||
    msg.body?.text ||
    (typeof msg.body === 'string' ? msg.body : null) ||
    msg.message ||
    msg.text ||
    msg.content ||
    ''
  );
  
  return typeof text === 'string' ? text : (text?.text || JSON.stringify(text) || '');
}

