/**
 * Bird.com SMS Utility Functions
 * Functions to send SMS messages via Bird API
 */

const BIRD_API_KEY = process.env.BIRD_API_KEY || process.env.MESSAGEBIRD_API_KEY;
const BIRD_CHANNEL_ID = process.env.BIRD_CHANNEL_ID;
const BIRD_WORKSPACE_ID = process.env.BIRD_WORKSPACE_ID || '9dbb8094-b8df-45a4-91d1-8a00bbfe4d6e';
const API_BASE = 'https://api.bird.com';

/**
 * Send SMS message via Bird.com API
 * @param phoneNumber - Recipient phone number (E.164 format, e.g., +1234567890)
 * @param message - Message text to send
 * @returns Promise with message response
 */
export async function sendSMS(phoneNumber: string, message: string) {
  try {
    // Validate API configuration
    if (!BIRD_API_KEY) {
      throw new Error('BIRD_API_KEY not found in environment variables');
    }

    if (!BIRD_CHANNEL_ID) {
      throw new Error('BIRD_CHANNEL_ID not found in environment variables');
    }

    if (!BIRD_WORKSPACE_ID) {
      throw new Error('BIRD_WORKSPACE_ID not found in environment variables');
    }

    // Validate phone number
    if (!phoneNumber || !phoneNumber.trim()) {
      throw new Error('Phone number is required');
    }

    // Ensure phone number is in E.164 format (starts with +)
    const normalizedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber.trim() 
      : `+${phoneNumber.trim()}`;

    // Validate message
    if (!message || !message.trim()) {
      throw new Error('Message text is required');
    }

    console.log(`📤 Sending SMS to ${normalizedPhone} via Bird API`);
    console.log(`   Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);

    // Try to find or create a conversation first
    // Bird API typically requires a conversation to send messages
    let conversationId = await findOrCreateConversation(normalizedPhone);

    // Send message via Bird API
    // Endpoint: POST /workspaces/{workspaceId}/conversations/{conversationId}/messages
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Bird API Error (${response.status}):`, errorText);
      
      // If conversation doesn't exist, try creating it and sending again
      if (response.status === 404) {
        console.log('⚠️  Conversation not found, creating new conversation...');
        conversationId = await createConversation(normalizedPhone);
        
        // Retry sending message
        const retryResponse = await fetch(sendMessageUrl, {
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

        if (!retryResponse.ok) {
          const retryErrorText = await retryResponse.text();
          throw new Error(`Failed to send SMS: ${retryResponse.status} - ${retryErrorText}`);
        }

        const retryData = await retryResponse.json();
        console.log('✅ SMS sent successfully (retry)');
        return retryData;
      }
      
      throw new Error(`Failed to send SMS: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ SMS sent successfully');
    return data;

  } catch (error: any) {
    console.error('❌ Error sending SMS:', error.message);
    throw error;
  }
}

/**
 * Find existing conversation by phone number or create a new one
 */
async function findOrCreateConversation(phoneNumber: string): Promise<string> {
  try {
    // Try to find existing conversation
    const conversationsUrl = `${API_BASE}/workspaces/${BIRD_WORKSPACE_ID}/conversations?limit=100`;
    
    const response = await fetch(conversationsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const conversations = data.results || data.items || data.data || [];
      
      // Find conversation with matching phone number
      for (const conv of conversations) {
        const participants = conv.participants || conv.featuredParticipants || [];
        for (const participant of participants) {
          const contactPhone = participant.contact?.identifierValue || 
                              participant.contact?.platformAddress;
          if (contactPhone === phoneNumber || contactPhone?.includes(phoneNumber.replace('+', ''))) {
            console.log(`✅ Found existing conversation: ${conv.id}`);
            return conv.id;
          }
        }
      }
    }

    // If no conversation found, create a new one
    console.log('📝 Creating new conversation...');
    return await createConversation(phoneNumber);

  } catch (error: any) {
    console.log('⚠️  Could not find conversation, creating new one...');
    return await createConversation(phoneNumber);
  }
}

/**
 * Create a new conversation for a phone number
 */
async function createConversation(phoneNumber: string): Promise<string> {
  try {
    // Create conversation via Bird API
    // Endpoint: POST /workspaces/{workspaceId}/conversations
    const createConversationUrl = `${API_BASE}/workspaces/${BIRD_WORKSPACE_ID}/conversations`;

    const response = await fetch(createConversationUrl, {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channelId: BIRD_CHANNEL_ID,
        participants: [
          {
            contact: {
              identifierValue: phoneNumber,
              identifierType: 'phone'
            }
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create conversation: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ Created new conversation: ${data.id}`);
    return data.id;

  } catch (error: any) {
    console.error('❌ Error creating conversation:', error.message);
    // If conversation creation fails, try alternative method: send directly to channel
    throw error;
  }
}

/**
 * Send SMS directly via channel (alternative method if conversation API fails)
 * Uses the correct Bird API format based on their documentation
 */
export async function sendSMSDirect(phoneNumber: string, message: string) {
  try {
    if (!BIRD_API_KEY || !BIRD_CHANNEL_ID || !BIRD_WORKSPACE_ID) {
      throw new Error('Bird API configuration missing');
    }

    const normalizedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber.trim() 
      : `+${phoneNumber.trim()}`;

    console.log(`📤 Sending SMS directly via channel to ${normalizedPhone}`);

    // Endpoint: POST /workspaces/{workspaceId}/channels/{channelId}/messages
    const sendMessageUrl = `${API_BASE}/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_CHANNEL_ID}/messages`;

    const response = await fetch(sendMessageUrl, {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receiver: {
          contacts: [
            {
              identifierValue: normalizedPhone
            }
          ]
        },
        body: {
          type: 'text',
          text: {
            text: message.trim()
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send SMS: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ SMS sent successfully (direct method)');
    return data;

  } catch (error: any) {
    console.error('❌ Error sending SMS (direct method):', error.message);
    throw error;
  }
}

/**
 * Send multiple SMS messages sequentially with delays
 * Sends messages one by one with a delay between each
 * @param phoneNumber - Recipient phone number (E.164 format)
 * @param messages - Array of message strings to send
 * @param delayMs - Delay between messages in milliseconds (default: 2000ms = 2 seconds)
 * @returns Promise with array of results
 */
export async function sendSMSSequence(
  phoneNumber: string, 
  messages: string[], 
  delayMs: number = 2000
): Promise<any[]> {
  const results: any[] = [];
  
  for (let i = 0; i < messages.length; i++) {
    try {
      console.log(`📤 Sending welcome message ${i + 1}/${messages.length} to ${phoneNumber}`);
      
      // Try direct method first (more reliable)
      try {
        const result = await sendSMSDirect(phoneNumber, messages[i]);
        results.push({ success: true, messageIndex: i + 1, result });
        console.log(`✅ Welcome message ${i + 1}/${messages.length} sent successfully`);
      } catch (directError: any) {
        // Fallback to conversation method
        console.log(`⚠️  Direct method failed, trying conversation method for message ${i + 1}...`);
        const result = await sendSMS(phoneNumber, messages[i]);
        results.push({ success: true, messageIndex: i + 1, result });
        console.log(`✅ Welcome message ${i + 1}/${messages.length} sent successfully (conversation method)`);
      }
      
      // Wait before sending next message (except for the last one)
      if (i < messages.length - 1) {
        console.log(`⏳ Waiting ${delayMs}ms before sending next message...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error: any) {
      console.error(`❌ Failed to send welcome message ${i + 1}/${messages.length}:`, error.message);
      results.push({ success: false, messageIndex: i + 1, error: error.message });
      // Continue with next message even if one fails
    }
  }
  
  return results;
}

