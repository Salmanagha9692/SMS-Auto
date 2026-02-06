import { NextRequest, NextResponse } from 'next/server';

/**
 * Bird.com Programmable SMS API
 * Fetch SMS messages using Bird's Channels API
 * 
 * Documentation: https://docs.bird.com/api/channels-api/supported-channels/programmable-sms
 * 
 * Query Parameters:
 * - limit: Number of conversations to fetch (default: 200)
 * - phone: Filter by specific phone number
 * - includeAutomation: Include automation/campaign messages (default: false)
 * - includeOutbound: Include manual outbound messages (default: false)
 * - allChannels: Fetch from all channels instead of just the configured one (default: false)
 * - directApi: Use direct Channels Messages API instead of Conversations API (may show automation messages) (default: false)
 * 
 * Examples:
 * GET /api/bird/messages - Fetch latest inbound message for each unique sender
 * GET /api/bird/messages?limit=500 - Fetch with higher limit
 * GET /api/bird/messages?phone=+1234567890 - Filter by phone number
 * GET /api/bird/messages?includeAutomation=true - Include automation messages
 * GET /api/bird/messages?includeOutbound=true&includeAutomation=true - Include all message types
 * GET /api/bird/messages?allChannels=true - Fetch from ALL channels (not just configured one)
 * GET /api/bird/messages?directApi=true - Use direct API (may include automation/campaign messages)
 * 
 * Returns the LATEST message from each unique sender
 * Each sender appears only once with their most recent message
 * Message types: inbound (default), outbound (manual), automation (campaigns/bots)
 */

const BIRD_API_KEY = process.env.BIRD_API_KEY || process.env.MESSAGEBIRD_API_KEY;
const BIRD_CHANNEL_ID = process.env.BIRD_CHANNEL_ID;
const BIRD_WORKSPACE_ID = process.env.BIRD_WORKSPACE_ID || '9dbb8094-b8df-45a4-91d1-8a00bbfe4d6e';
const API_BASE = 'https://api.bird.com';

interface BirdMessage {
  id: string;
  senderNumber: string;
  messageText: string;
  receivedAt: string;
  direction: string;
  status: string;
  messageType: 'inbound' | 'outbound' | 'automation';
  conversationId?: string;
  channelId?: string;
  tags?: string[];
  reference?: string;
}

/**
 * Fetch messages from Bird.com Conversations API
 */
export async function GET(request: NextRequest) {
  try {
    // ── Validate API Key ──
    if (!BIRD_API_KEY) {
      console.error('❌ BIRD_API_KEY not found in environment variables');
      return NextResponse.json({
        success: false,
        error: 'BIRD_API_KEY not configured',
        hint: 'Add BIRD_API_KEY to your .env.local file'
      }, { status: 500 });
    }

    if (!BIRD_CHANNEL_ID) {
      console.error('❌ BIRD_CHANNEL_ID not found in environment variables');
      return NextResponse.json({
        success: false,
        error: 'BIRD_CHANNEL_ID not configured',
        hint: 'Add BIRD_CHANNEL_ID to your .env.local file'
      }, { status: 500 });
    }

    if (!BIRD_WORKSPACE_ID) {
      console.error('❌ BIRD_WORKSPACE_ID not found in environment variables');
      return NextResponse.json({
        success: false,
        error: 'BIRD_WORKSPACE_ID not configured',
        hint: 'Add BIRD_WORKSPACE_ID to your .env.local file (or it will use default)'
      }, { status: 500 });
    }

    // ── Get query parameters ──
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '200'; // Increased default to fetch more conversations
    const phone = searchParams.get('phone');
    const includeAutomation = searchParams.get('includeAutomation') === 'true';
    const includeOutbound = searchParams.get('includeOutbound') === 'true';
    const allChannels = searchParams.get('allChannels') === 'true'; // Fetch from ALL channels
    const useDirectApi = searchParams.get('directApi') === 'true'; // Use direct channels messages API

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📨 Fetching messages from Bird.com');
    console.log(`🏢 Workspace ID: ${BIRD_WORKSPACE_ID}`);
    console.log(`📡 Channel ID: ${allChannels ? 'ALL CHANNELS' : BIRD_CHANNEL_ID}`);
    console.log(`🔑 Using AccessKey authentication`);
    console.log(`🤖 Include Automation: ${includeAutomation}`);
    console.log(`📤 Include Outbound: ${includeOutbound}`);
    console.log(`🌐 All Channels: ${allChannels}`);
    console.log(`🔌 Direct API: ${useDirectApi}`);
    console.log('═══════════════════════════════════════════════════════════');

    // ── Fetch messages from Bird API ──
    let messages: BirdMessage[] = [];
    
    if (useDirectApi) {
      // Try direct Channels Messages API (may include automation messages)
      messages = await fetchMessagesDirectFromChannel(BIRD_WORKSPACE_ID, BIRD_CHANNEL_ID, limit);
    } else {
      // Use Conversations API (default)
      messages = await fetchMessagesFromBird(BIRD_WORKSPACE_ID, allChannels ? null : BIRD_CHANNEL_ID, limit, includeAutomation, includeOutbound);
    }
    
    console.log(`✅ Fetched ${messages.length} messages from Bird API`);
    
    // Debug: Show all unique dates
    if (messages.length > 0) {
      const uniqueDates = [...new Set(messages.map(m => m.receivedAt.split('T')[0]))].sort().reverse();
      console.log(`📆 Unique message dates found (${uniqueDates.length}): ${uniqueDates.slice(0, 10).join(', ')}${uniqueDates.length > 10 ? '...' : ''}`);
    }

    // ── Filter messages based on flags ──
    let filteredMessages = messages.filter(msg => {
      const isInbound = msg.direction === 'received' || 
                       msg.direction === 'incoming' ||
                       msg.messageType === 'inbound';
      
      const isOutbound = msg.direction === 'sent' || 
                        msg.direction === 'outgoing' ||
                        msg.messageType === 'outbound';
      
      const isAutomation = msg.messageType === 'automation';

      // Always include inbound messages
      if (isInbound) return true;
      
      // Include automation if flag is set
      if (isAutomation && includeAutomation) return true;
      
      // Include outbound if flag is set
      if (isOutbound && includeOutbound) return true;
      
      return false;
    });
    
    console.log(`📥 Filtered to ${filteredMessages.length} messages (out of ${messages.length} total)`);

    // ── Filter by phone number if provided ──
    if (phone) {
      filteredMessages = filteredMessages.filter(msg => 
        msg.senderNumber?.includes(phone.replace('+', '')) ||
        msg.senderNumber?.includes(phone)
      );
      console.log(`🔍 Filtered to ${filteredMessages.length} messages for phone: ${phone}`);
    }

    // ── Group messages by sender number and get latest message for each unique sender ──
    const senderMap = new Map<string, BirdMessage>();

    for (const msg of filteredMessages) {
      const senderNumber = msg.senderNumber;
      
      // Skip if sender number is missing or invalid
      if (!senderNumber || senderNumber === 'Unknown') {
        continue;
      }

      // Normalize phone number (remove spaces, ensure consistent format)
      const normalizedSender = senderNumber.replace(/\s+/g, '');

      // Check if we already have a message from this sender
      const existingMessage = senderMap.get(normalizedSender);

      if (!existingMessage) {
        // First message from this sender, add it
        senderMap.set(normalizedSender, msg);
      } else {
        // Compare timestamps to find the latest message
        const existingTime = new Date(existingMessage.receivedAt).getTime();
        const currentTime = new Date(msg.receivedAt).getTime();
        
        if (currentTime > existingTime) {
          // Current message is newer, replace it
          senderMap.set(normalizedSender, msg);
        }
      }
    }

    // ── Convert map to array and sort by receivedAt (newest first) ──
    const latestMessages = Array.from(senderMap.values()).sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime();
      const timeB = new Date(b.receivedAt).getTime();
      return timeB - timeA; // Newest first
    });

    // ── Format response with sender number and latest message text ──
    const formattedMessages = latestMessages.map(msg => ({
      senderNumber: msg.senderNumber,
      messageText: msg.messageText,
      receivedAt: msg.receivedAt,
      id: msg.id,
      status: msg.status,
      messageType: msg.messageType,
      direction: msg.direction,
      conversationId: msg.conversationId,
      channelId: msg.channelId,
      tags: msg.tags,
      reference: msg.reference
    }));

    // Count message types
    const messageTypeCounts = latestMessages.reduce((acc, msg) => {
      acc[msg.messageType] = (acc[msg.messageType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('───────────────────────────────────────────────────────────');
    console.log(`📊 Total messages: ${filteredMessages.length}`);
    console.log(`👥 Unique senders: ${latestMessages.length}`);
    console.log(`📥 Inbound: ${messageTypeCounts.inbound || 0}`);
    console.log(`📤 Outbound: ${messageTypeCounts.outbound || 0}`);
    console.log(`🤖 Automation: ${messageTypeCounts.automation || 0}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      totalMessages: filteredMessages.length,
      uniqueSenders: latestMessages.length,
      messageTypeCounts,
      messages: formattedMessages
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Error fetching messages:', error.message);
    console.error('═══════════════════════════════════════════════════════════\n');
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Fetch messages DIRECTLY from Channels Messages API
 * This may include automation/campaign messages not in conversations
 * Endpoint: /workspaces/{workspaceId}/channels/{channelId}/messages
 */
async function fetchMessagesDirectFromChannel(
  workspaceId: string,
  channelId: string | null,
  limit: string
): Promise<BirdMessage[]> {
  if (!channelId) {
    console.log('⚠️  Direct API requires a specific channel ID');
    return [];
  }

  console.log('📡 Trying DIRECT Channels Messages API (may include automation messages)...');
  
  const allMessages: BirdMessage[] = [];
  let offset = 0;
  const pageSize = 100;
  const maxToFetch = parseInt(limit);
  
  while (allMessages.length < maxToFetch) {
    const messagesUrl = `${API_BASE}/workspaces/${workspaceId}/channels/${channelId}/messages?limit=${pageSize}&offset=${offset}`;
    
    console.log(`   Fetching messages page at offset ${offset}...`);
    
    const messagesResponse = await fetch(messagesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Response status: ${messagesResponse.status}`);

    if (!messagesResponse.ok) {
      const errorText = await messagesResponse.text();
      console.error(`❌ Direct Channels Messages API Error: ${errorText}`);
      console.log('⚠️  Falling back to Conversations API...');
      break; // Fall back to conversations API
    }

    const messagesData = await messagesResponse.json();
    const messages = messagesData.results || messagesData.items || messagesData.data || messagesData.messages || [];
    
    if (messages.length === 0) {
      console.log('   No more messages');
      break;
    }
    
    console.log(`   Fetched ${messages.length} messages (total so far: ${allMessages.length + messages.length})`);
    
    // Parse and add messages
    for (const msg of messages) {
      const senderNumber = extractSenderNumber(msg);
      const messageText = extractMessageText(msg);
      
      if (!messageText) continue;
      
      // Determine message type
      let messageType: 'inbound' | 'outbound' | 'automation' = 'inbound';
      let direction = msg.direction || 'received';
      
      // Check if it's automation/campaign
      if (msg.reference || msg.tags?.length > 0 || msg.context?.type === 'campaign') {
        messageType = 'automation';
        direction = 'sent';
      } else if (direction === 'sent' || direction === 'outgoing') {
        messageType = 'outbound';
      }
      
      allMessages.push({
        id: msg.id,
        senderNumber: senderNumber || 'System',
        messageText,
        receivedAt: msg.createdAt || msg.createdDatetime || msg.timestamp || new Date().toISOString(),
        direction,
        status: msg.status || 'delivered',
        messageType,
        conversationId: msg.conversationId,
        channelId: msg.channelId || channelId || undefined,
        tags: msg.tags || [],
        reference: msg.reference
      });
    }
    
    if (messages.length < pageSize) break;
    offset += pageSize;
  }
  
  console.log(`📥 Total messages from direct API: ${allMessages.length}`);
  return allMessages;
}

/**
 * Fetch messages from Bird.com API
 * Uses Conversations API with workspace ID
 * Endpoint: /workspaces/{workspaceId}/conversations
 */
async function fetchMessagesFromBird(
  workspaceId: string, 
  channelId: string | null, 
  limit: string,
  includeAutomation: boolean = false,
  includeOutbound: boolean = false
): Promise<BirdMessage[]> {
  // Step 1: Get ALL conversations using pagination
  let allConversations: any[] = [];
  let offset = 0;
  const pageSize = 100; // Max per page
  const maxToFetch = parseInt(limit);
  
  console.log(`📡 Step 1: Fetching conversations (up to ${maxToFetch} total)...`);
  
  while (allConversations.length < maxToFetch) {
    const conversationsUrl = `${API_BASE}/workspaces/${workspaceId}/conversations?limit=${pageSize}&offset=${offset}&order=-updatedAt`;
    
    console.log(`   Fetching page at offset ${offset}...`);
    
    const conversationsResponse = await fetch(conversationsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Response status: ${conversationsResponse.status}`);

    if (!conversationsResponse.ok) {
      const errorText = await conversationsResponse.text();
      console.error('❌ Conversations API Error:', errorText);
      throw new Error(`Failed to fetch conversations: ${conversationsResponse.status} - ${errorText}`);
    }

    const conversationsData = await conversationsResponse.json();
    const conversations = conversationsData.results || conversationsData.items || conversationsData.data || [];
    
    if (conversations.length === 0) {
      console.log('   No more conversations to fetch');
      break; // No more results
    }
    
    allConversations.push(...conversations);
    console.log(`   Fetched ${conversations.length} conversations (total so far: ${allConversations.length})`);
    
    // Check if we got fewer results than page size (last page)
    if (conversations.length < pageSize) {
      console.log('   Reached last page');
      break;
    }
    
    offset += pageSize;
  }
  
  console.log(`📋 Total conversations fetched: ${allConversations.length}`);
  
  // Log first few conversations for debugging
  if (allConversations.length > 0) {
    console.log('🔍 First 5 conversations:');
    allConversations.slice(0, 5).forEach((conv: any, idx: number) => {
      const lastMsgDate = conv.lastMessageIncomingAt || conv.lastMessageOutgoingAt || conv.updatedAt;
      console.log(`   ${idx + 1}. Conv ID: ${conv.id.substring(0, 8)}..., Updated: ${conv.updatedAt}, Last Msg: ${lastMsgDate}`);
    });
  }

  // Step 2: Fetch messages from each conversation
  const allMessages: BirdMessage[] = [];
  let skippedByChannel = 0;

  for (const conv of allConversations) {
    try {
      // Filter by channel only if channelId is provided (not null)
      if (channelId !== null && conv.channelId && conv.channelId !== channelId) {
        console.log(`   ⏩ Skipping conversation ${conv.id.substring(0, 8)} (different channel: ${conv.channelId})`);
        skippedByChannel++;
        continue;
      }
      
      // Log which channel we're processing
      if (channelId === null) {
        console.log(`   📨 Processing conversation ${conv.id.substring(0, 8)} from channel ${conv.channelId || 'unknown'}`);
      }

      // Extract lastMessage from conversation (quick preview)
      if (conv.lastMessage) {
        const lastMsg = conv.lastMessage;
        
        // Determine message type and direction
        const isIncoming = conv.lastMessageIncomingAt !== null && conv.lastMessageIncomingAt !== undefined;
        const isOutgoing = conv.lastMessageOutgoingAt !== null && conv.lastMessageOutgoingAt !== undefined;
        
        // For inbound messages, sender is the initiating participant or featured participant
        // For outbound, use the channel/workspace as sender
        const senderContact = isIncoming 
          ? (conv.initiatingParticipant?.contact || conv.featuredParticipants?.[0]?.contact)
          : null;
        const phoneNumber = senderContact?.identifierValue || senderContact?.platformAddress;
        
        // Determine message type
        let messageType: 'inbound' | 'outbound' | 'automation' = 'inbound';
        let direction = 'received';
        
        if (isOutgoing && !isIncoming) {
          // Check if it's automation (has tags, reference, or system sender)
          const hasAutomationIndicators = lastMsg.tags?.length > 0 || 
                                         lastMsg.reference || 
                                         lastMsg.sender?.type === 'system' ||
                                         lastMsg.meta?.extraInformation?.useCase === 'marketing';
          
          messageType = hasAutomationIndicators ? 'automation' : 'outbound';
          direction = 'sent';
        }
        
        // Only add if conditions are met
        const shouldInclude = messageType === 'inbound' || 
                             (messageType === 'outbound' && includeOutbound) ||
                             (messageType === 'automation' && includeAutomation);
        
        if (shouldInclude && (phoneNumber || messageType !== 'inbound') && lastMsg.preview?.text) {
          allMessages.push({
            id: lastMsg.id,
            senderNumber: phoneNumber || 'System',
            messageText: lastMsg.preview?.text || lastMsg.content?.text || '',
            receivedAt: lastMsg.createdAt || conv.lastMessageIncomingAt || conv.lastMessageOutgoingAt || conv.updatedAt,
            direction,
            status: lastMsg.status || 'delivered',
            messageType,
            conversationId: conv.id,
            channelId: conv.channelId || channelId || undefined,
            tags: lastMsg.tags || [],
            reference: lastMsg.reference
          });
        }
      }

      // Step 3: Fetch all messages from the conversation for complete history
      const messagesUrl = `${API_BASE}/workspaces/${workspaceId}/conversations/${conv.id}/messages?limit=100`;
      console.log(`📡 Step 2: Fetching full message history from conversation ${conv.id}`);
      
      const messagesResponse = await fetch(messagesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `AccessKey ${BIRD_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        const messages = messagesData.results || messagesData.items || messagesData.data || [];

        for (const msg of messages) {
          // Skip if we already added the lastMessage
          if (conv.lastMessage && msg.id === conv.lastMessage.id) {
            continue;
          }

          // Determine if message is inbound (from contact) or outbound (from us)
          const isInbound = msg.sender?.type === 'contact' || 
                           msg.direction === 'received' || 
                           msg.direction === 'incoming' ||
                           (!msg.direction && msg.sender?.type !== 'user' && msg.sender?.type !== 'system');

          const isOutbound = msg.sender?.type === 'user' ||
                            msg.direction === 'sent' ||
                            msg.direction === 'outgoing';

          // Determine message type
          let messageType: 'inbound' | 'outbound' | 'automation' = 'inbound';
          let direction = 'received';

          if (isInbound) {
            messageType = 'inbound';
            direction = 'received';
          } else if (isOutbound) {
            // Check if it's automation (has tags, reference, or system indicators)
            const hasAutomationIndicators = msg.sender?.type === 'system' || 
                                           msg.tags?.length > 0 || 
                                           msg.reference || 
                                           msg.meta?.extraInformation?.useCase === 'marketing' ||
                                           msg.context?.type === 'campaign' ||
                                           msg.context?.type === 'automation';
            
            messageType = hasAutomationIndicators ? 'automation' : 'outbound';
            direction = 'sent';
          }

          // Check if we should include this message type
          const shouldInclude = messageType === 'inbound' || 
                               (messageType === 'outbound' && includeOutbound) ||
                               (messageType === 'automation' && includeAutomation);

          if (!shouldInclude) {
            continue;
          }

          // For inbound messages, extract sender from sender.contact or conversation participants
          // For outbound/automation, use system or channel identifier
          const senderContact = msg.sender?.contact || conv.initiatingParticipant?.contact || conv.featuredParticipants?.[0]?.contact;
          const phoneNumber = senderContact?.identifierValue || senderContact?.platformAddress || extractSenderNumber(msg);

          if (messageType === 'inbound' && (!phoneNumber || phoneNumber === 'Unknown')) {
            continue; // Skip inbound messages if we can't identify the sender
          }

          allMessages.push({
            id: msg.id,
            senderNumber: phoneNumber || 'System',
            messageText: extractMessageText(msg),
            receivedAt: msg.createdAt || msg.createdDatetime || msg.timestamp,
            direction,
            status: msg.status || 'delivered',
            messageType,
            conversationId: conv.id,
            channelId: msg.channelId || conv.channelId || channelId || undefined,
            tags: msg.tags || [],
            reference: msg.reference
          });
        }
      } else {
        console.log(`⚠️  Could not fetch messages for conversation ${conv.id}: ${messagesResponse.status}`);
      }
    } catch (err: any) {
      console.log(`⚠️  Error fetching messages for conversation ${conv.id}:`, err.message);
    }
  }

  // Sort messages by receivedAt (newest first)
  allMessages.sort((a, b) => {
    const dateA = new Date(a.receivedAt).getTime();
    const dateB = new Date(b.receivedAt).getTime();
    return dateB - dateA;
  });

  console.log(`📥 Total messages fetched: ${allMessages.length}`);
  console.log(`⏩ Conversations skipped due to channel filter: ${skippedByChannel}`);
  
  // Log date range for debugging
  if (allMessages.length > 0) {
    const oldestDate = new Date(allMessages[allMessages.length - 1].receivedAt);
    const newestDate = new Date(allMessages[0].receivedAt);
    console.log(`📅 Message date range: ${oldestDate.toISOString()} to ${newestDate.toISOString()}`);
    console.log(`🔝 Newest message: ${allMessages[0].messageText.substring(0, 30)} from ${allMessages[0].senderNumber}`);
  }
  
  return allMessages;
}


/**
 * Extract sender phone number from various payload formats
 */
function extractSenderNumber(msg: any): string {
  return (
    // Bird.com Conversations API format
    msg.sender?.contact?.identifierValue ||
    msg.sender?.contact?.platformAddress ||
    msg.sender?.contact?.msisdn ||
    msg.sender?.identifierValue ||
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
 * Extract message text from various payload formats
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

