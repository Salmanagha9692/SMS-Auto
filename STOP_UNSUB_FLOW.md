# STOP and UNSUB Message Flow Documentation

This document describes the complete flow when a user sends "STOP" or "UNSUB" messages to the Bird.com number.

---

## Overview

Both STOP and UNSUB messages allow users to unsubscribe from paid subscriptions, but they have different behaviors:

- **UNSUB**: Cancels subscription, converts to free tier, user can still receive messages
- **STOP**: Cancels subscription, converts to free tier, blocks all future messages

---

## Flow 1: UNSUB Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User sends "UNSUB" or "UNSUBSCRIBE"                │
│ - User texts "UNSUB" or "UNSUBSCRIBE" to Bird.com number    │
│ - Case-insensitive matching (unsub, UNSUB, Unsubscribe, etc)│
│ - Message received by Bird.com platform                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Bird.com Webhook Processing                        │
│ POST /bird-sms-webhook                                      │
│ ├─ Receives inbound SMS event from Bird.com                 │
│ ├─ Extracts: sender phone, message text, conversation ID    │
│ ├─ Normalizes phone number to E.164 format                 │
│ └─ Detects "UNSUB" keyword (case-insensitive)               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Save Message to Airtable                           │
│ - Phone number saved/updated in Phone Numbers table       │
│ - Message text ("UNSUB" or "UNSUBSCRIBE") saved            │
│ - Timestamp recorded                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Find Payment Record                                 │
│ - Searches Payments table by phone number                   │
│ - Looks for existing payment record                         │
│                                                             │
│ IF NO PAYMENT RECORD FOUND:                                 │
│ ├─ Logs: "No payment record found"                        │
│ ├─ Returns false (no processing needed)                    │
│ └─ Still sends confirmation message                        │
│                                                             │
│ IF PAYMENT RECORD FOUND:                                    │
│ └─ Continues to Step 5                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Validate Subscription Status                        │
│ - Checks tier (must not be "free")                         │
│ - Checks status (must be "active")                          │
│                                                             │
│ IF NOT ACTIVE PAID SUBSCRIPTION:                            │
│ ├─ Logs: "No active paid subscription found"              │
│ ├─ Returns false (no processing needed)                    │
│ └─ Still sends confirmation message                        │
│                                                             │
│ IF ACTIVE PAID SUBSCRIPTION:                                │
│ └─ Continues to Step 6                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Cancel Stripe Subscription                         │
│ - Retrieves Stripe Subscription ID from payment record     │
│ - Calls Stripe API to cancel subscription                  │
│                                                             │
│ IF SUBSCRIPTION EXISTS:                                     │
│ ├─ stripe.subscriptions.cancel(subscriptionId)            │
│ ├─ Subscription immediately cancelled in Stripe            │
│ └─ No future charges will occur                            │
│                                                             │
│ IF SUBSCRIPTION DOESN'T EXIST OR ERROR:                     │
│ ├─ Logs error but continues processing                    │
│ └─ Proceeds to Airtable update                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Update Airtable to Free Tier                       │
│ - Updates payment record in Airtable                        │
│ - Sets tier: "free"                                        │
│ - Sets amount: 0                                           │
│ - Sets status: "completed"                                 │
│ - Clears all Stripe-related fields:                        │
│   ├─ Stripe Customer ID → ""                              │
│   ├─ Stripe Subscription ID → ""                          │
│   ├─ Stripe Payment Intent ID → ""                       │
│   └─ Stripe Session ID → ""                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Send Confirmation Message                          │
│ - Message sent in same conversation thread                 │
│ - Uses conversation ID from incoming message              │
│ - Message: "You have been successfully unsubscribed. You  │
│   are now free tier user. Thank you for being part of     │
│   The Weft!"                                               │
│                                                             │
│ FALLBACK: If conversation ID not available:               │
│ ├─ Uses sendSMS to find/create conversation               │
│ └─ If that fails, uses sendSMSDirect                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 9: User Status After UNSUB                            │
│ ✅ Subscription cancelled in Stripe                        │
│ ✅ Payment record updated to free tier                     │
│ ✅ Stripe fields cleared                                    │
│ ✅ User can still receive monthly messages                 │
│ ✅ User can rejoin by selecting paid tier again           │
└─────────────────────────────────────────────────────────────┘
```

### UNSUB Flow Summary

**What happens:**
1. User sends "UNSUB" or "UNSUBSCRIBE"
2. Webhook finds payment record
3. Cancels Stripe subscription (if active paid subscription)
4. Updates Airtable to free tier
5. Clears all Stripe fields
6. Sends confirmation message

**User status after UNSUB:**
- ✅ Subscription cancelled
- ✅ Converted to free tier
- ✅ Can still receive messages
- ✅ Can rejoin paid tier anytime

---

## Flow 2: STOP Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User sends "STOP"                                  │
│ - User texts "STOP" to Bird.com number                     │
│ - Case-insensitive matching (stop, STOP, Stop, etc)       │
│ - Message received by Bird.com platform                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Bird.com Webhook Processing                        │
│ POST /bird-sms-webhook                                      │
│ ├─ Receives inbound SMS event from Bird.com                 │
│ ├─ Extracts: sender phone, message text, conversation ID    │
│ ├─ Normalizes phone number to E.164 format                 │
│ └─ Detects "STOP" keyword (case-insensitive)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Save STOP Message to Airtable                      │
│ - Phone number saved/updated in Phone Numbers table        │
│ - Message text ("STOP") saved                             │
│ - Timestamp recorded                                        │
│ - This STOP message will block future monthly messages     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Find Payment Record                                 │
│ - Searches Payments table by phone number                   │
│ - Looks for existing payment record                         │
│                                                             │
│ IF NO PAYMENT RECORD FOUND:                                 │
│ ├─ Logs: "No payment record found"                        │
│ ├─ STOP message still saved (blocks future messages)       │
│ └─ Continues to send confirmation message                  │
│                                                             │
│ IF PAYMENT RECORD FOUND:                                    │
│ └─ Continues to Step 5                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Cancel Stripe Subscription                         │
│ - Retrieves Stripe Subscription ID from payment record     │
│ - Checks if subscription exists and status is "active"      │
│ - Calls Stripe API to cancel subscription                  │
│                                                             │
│ IF ACTIVE SUBSCRIPTION EXISTS:                              │
│ ├─ stripe.subscriptions.cancel(subscriptionId)            │
│ ├─ Subscription immediately cancelled in Stripe            │
│ └─ No future charges will occur                            │
│                                                             │
│ IF NO SUBSCRIPTION OR ERROR:                                │
│ ├─ Logs error but continues processing                    │
│ └─ Proceeds to Airtable update                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Clear Payment Record in Airtable                   │
│ - Updates payment record in Airtable                       │
│ - Sets tier: "free"                                        │
│ - Sets amount: 0                                           │
│ - Sets status: "cancelled"                                 │
│ - Clears all Stripe-related fields:                       │
│   ├─ Stripe Customer ID → ""                              │
│   ├─ Stripe Subscription ID → ""                          │
│   ├─ Stripe Payment Intent ID → ""                         │
│   └─ Stripe Session ID → ""                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Send Confirmation Message                          │
│ - Message sent in same conversation thread                 │
│ - Uses conversation ID from incoming message              │
│ - Message: "You have been successfully unsubscribed. You  │
│   will no longer receive messages. Reply LOVE to rejoin." │
│                                                             │
│ FALLBACK: If conversation ID not available:               │
│ ├─ Uses sendSMS to find/create conversation               │
│ └─ If that fails, uses sendSMSDirect                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Monthly Message System Checks                      │
│ - Monthly message system checks Phone Numbers table       │
│ - Looks for "STOP" message in last message field          │
│ - Skips phone numbers with STOP message                    │
│ - User will NOT receive monthly care messages             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 9: User Status After STOP                            │
│ ✅ Subscription cancelled in Stripe                        │
│ ✅ Payment record updated to free tier                     │
│ ✅ Stripe fields cleared                                    │
│ ✅ STOP message saved to Phone Numbers table              │
│ ❌ User will NOT receive monthly messages                  │
│ ✅ User can rejoin by sending "LOVE" message               │
└─────────────────────────────────────────────────────────────┘
```

### STOP Flow Summary

**What happens:**
1. User sends "STOP"
2. STOP message saved to Phone Numbers table
3. Webhook finds payment record (if exists)
4. Cancels Stripe subscription (if active)
5. Updates Airtable to free tier with status "cancelled"
6. Clears all Stripe fields
7. Sends confirmation message
8. Future monthly messages are blocked

**User status after STOP:**
- ✅ Subscription cancelled
- ✅ Converted to free tier
- ❌ Will NOT receive monthly messages
- ✅ Can rejoin by sending "LOVE" message

---

## Key Differences: UNSUB vs STOP

| Feature | UNSUB | STOP |
|---------|-------|------|
| **Subscription Cancellation** | ✅ Yes | ✅ Yes |
| **Convert to Free Tier** | ✅ Yes | ✅ Yes |
| **Clear Stripe Fields** | ✅ Yes | ✅ Yes |
| **Receive Monthly Messages** | ✅ Yes | ❌ No |
| **Message Saved to Airtable** | ✅ Yes (as "UNSUB") | ✅ Yes (as "STOP") |
| **Can Rejoin** | ✅ Yes (select paid tier) | ✅ Yes (send "LOVE") |
| **Airtable Status** | "completed" | "cancelled" |

---

## Technical Implementation Details

### UNSUB Processing Function

```typescript
async function processUnsubscription(phoneNumber: string): Promise<boolean> {
  // 1. Find payment record by phone number
  const paymentRecord = await airtableService.findPaymentByPhone(phoneNumber);
  
  // 2. Validate: Must have active paid subscription
  if (!paymentRecord || tier === 'free' || status !== 'active') {
    return false; // No active subscription to cancel
  }
  
  // 3. Cancel Stripe subscription
  if (stripeSubscriptionId) {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  }
  
  // 4. Update Airtable to free tier
  await airtableService.updatePaymentRecord(paymentRecord.id, {
    tier: 'free',
    amount: 0,
    status: 'completed',
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    stripePaymentIntentId: '',
    stripeSessionId: '',
  });
  
  return true;
}
```

### STOP Processing Function

```typescript
async function processStopRequest(phoneNumber: string): Promise<boolean> {
  // 1. STOP message already saved to Phone Numbers table in main flow
  
  // 2. Find payment record by phone number
  const paymentRecord = await airtableService.findPaymentByPhone(phoneNumber);
  
  if (!paymentRecord) {
    return true; // STOP message saved, no payment to clear
  }
  
  // 3. Cancel Stripe subscription (if active)
  if (stripeSubscriptionId && status === 'active') {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  }
  
  // 4. Clear payment record
  await airtableService.updatePaymentRecord(paymentRecord.id, {
    tier: 'free',
    amount: 0,
    status: 'cancelled', // Different from UNSUB
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    stripePaymentIntentId: '',
    stripeSessionId: '',
  });
  
  return true;
}
```

### Monthly Message Blocking

The monthly message system checks for STOP messages:

```typescript
// In send-monthly-messages route
const hasStop = await airtableService.hasStopMessage(phoneNumber);
if (hasStop) {
  console.log(`⏭️  Skipping ${phoneNumber} - STOP message found`);
  continue; // Skip this phone number
}
```

---

## Confirmation Messages

### UNSUB Confirmation

```
You have been successfully unsubscribed. You are now free tier user. Thank you for being part of The Weft!
```

### STOP Confirmation

```
You have been successfully unsubscribed. You will no longer receive messages. Reply LOVE to rejoin.
```

Both messages are sent:
- ✅ In the same conversation thread as the incoming message
- ✅ Immediately after processing
- ✅ Using conversation ID when available
- ✅ With fallback to phone-based conversation

---

## Error Handling

### Stripe Subscription Cancellation Errors

If Stripe subscription cancellation fails:
- Error is logged
- Processing continues
- Airtable is still updated
- Confirmation message is still sent

This ensures the user is always notified, even if Stripe API has issues.

### Missing Payment Record

If no payment record is found:
- **UNSUB**: Returns false, but confirmation message is still sent
- **STOP**: Returns true (STOP message saved), confirmation message sent

### Conversation Threading Failures

If sending reply in conversation fails:
- Falls back to `sendSMS` (finds/creates conversation)
- If that fails, falls back to `sendSMSDirect`
- Ensures user always receives confirmation

---

## Testing

### Test UNSUB Flow

1. Create a paid subscription (monthly or one-time)
2. Send "UNSUB" to Bird.com number
3. Verify:
   - ✅ Stripe subscription cancelled
   - ✅ Airtable updated to free tier
   - ✅ Stripe fields cleared
   - ✅ Confirmation message received
   - ✅ Monthly messages still sent (if applicable)

### Test STOP Flow

1. Create a paid subscription (monthly or one-time)
2. Send "STOP" to Bird.com number
3. Verify:
   - ✅ Stripe subscription cancelled
   - ✅ Airtable updated to free tier (status: "cancelled")
   - ✅ Stripe fields cleared
   - ✅ STOP message saved to Phone Numbers table
   - ✅ Confirmation message received
   - ✅ Monthly messages NOT sent (blocked)

### Test Edge Cases

1. **No Payment Record**
   - Send UNSUB/STOP without existing payment
   - Verify confirmation message still sent
   - Verify STOP message saved (for STOP)

2. **Free Tier User**
   - Send UNSUB/STOP as free tier user
   - Verify no Stripe cancellation attempted
   - Verify confirmation message sent

3. **One-Time Payment**
   - Send UNSUB/STOP after one-time payment
   - Verify Airtable updated correctly
   - Verify no Stripe subscription to cancel

---

## Troubleshooting

### UNSUB/STOP Not Processing

**Check:**
1. Verify webhook is receiving messages (check server logs)
2. Verify message text is exactly "UNSUB", "UNSUBSCRIBE", or "STOP"
3. Check case-insensitive matching is working
4. Review server logs for processing errors

**Solution:**
- Check webhook endpoint is accessible
- Verify message text matches keywords exactly
- Review Airtable API credentials

### Stripe Subscription Not Cancelled

**Check:**
1. Verify subscription ID exists in payment record
2. Check Stripe Dashboard for subscription status
3. Review server logs for Stripe API errors

**Solution:**
- Verify Stripe API key is correct
- Check subscription ID format
- Review Stripe API error messages

### Confirmation Message Not Sent

**Check:**
1. Verify Bird.com API credentials
2. Check phone number format
3. Review server logs for SMS sending errors

**Solution:**
- Ensure phone number is in E.164 format
- Verify Bird.com API key is valid
- Check conversation ID extraction

### Monthly Messages Still Sending After STOP

**Check:**
1. Verify STOP message saved to Phone Numbers table
2. Check `hasStopMessage` function is working
3. Review monthly message system logs

**Solution:**
- Verify STOP message is in Phone Numbers table
- Check message text matches "STOP" exactly
- Review monthly message filtering logic

---

## Airtable Record States

### After UNSUB

```
Payments Table:
- Tier: "free"
- Amount: 0
- Status: "completed"
- Stripe Customer ID: "" (cleared)
- Stripe Subscription ID: "" (cleared)
- Stripe Payment Intent ID: "" (cleared)
- Stripe Session ID: "" (cleared)

Phone Numbers Table:
- Message: "UNSUB" or "UNSUBSCRIBE"
```

### After STOP

```
Payments Table:
- Tier: "free"
- Amount: 0
- Status: "cancelled" (different from UNSUB)
- Stripe Customer ID: "" (cleared)
- Stripe Subscription ID: "" (cleared)
- Stripe Payment Intent ID: "" (cleared)
- Stripe Session ID: "" (cleared)

Phone Numbers Table:
- Message: "STOP" (blocks future monthly messages)
```

---

*Last Updated: January 2026*

