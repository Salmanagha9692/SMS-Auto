# Community Weft - Complete Flow Documentation

## User Sends "LOVE" Text

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User sends SMS "LOVE"                              │
│ - User texts "LOVE" to Bird.com number                     │
│ - Message received by Bird.com platform                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Bird.com Automation (Dashboard)                    │
│ - Configured in Bird.com automation dashboard              │
│ - Keyword trigger: "LOVE"                                    │
│ - Automatic reply sent with link to join page              │
│ - Tagging applied (configured in dashboard)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: User clicks link in reply                          │
│ - Redirected to landing page                                │
│ - Sees tier options: Free, $5, $10, $25, $50, $75, $100,     │
│   Custom                                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User selects tier and payment type                │
│ - Selects tier (e.g., $5)                                   │
│ - Chooses: One-time or Monthly                              │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Payment Processing                                 │
│                                                             │
│ IF FREE TIER:                                               │
│ ├─ ContactModal opens (email + phone required)            │
│ ├─ User enters contact info                                │
│ ├─ Backend saves directly to Airtable                       │
│ ├─ Welcome SMS sent via Bird.com                            │
│ └─ Redirects to /success                                    │
│                                                             │
│ IF PAID TIER:                                               │
│ ├─ Redirected to Stripe Checkout                           │
│ ├─ User enters payment details                             │
│ ├─ Payment processed                                        │
│ ├─ Webhook updates Airtable                                │
│ ├─ Welcome SMS sent via Bird.com                            │
│ └─ Redirects to /success                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: User receives welcome message                      │
│ "Welcome to Community Weft! You are now part of our         │
│  community. We are excited to have you here. You will       │
│  receive monthly care messages from our makers. Reply       │
│  STOP anytime to opt out."                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Monthly Messages (Ongoing)                        │
│ - System sends monthly care messages                        │
│ - Message: "Thank you for being part of Community Weft.     │
│   This is your monthly care message from our makers. We     │
│   appreciate your continued support. Reply STOP anytime     │
│   to opt out."                                              │
│ - Sent to all active/completed subscribers                  │
│ - Respects STOP opt-out                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Flows

### Flow 1: Free Tier Signup

1. User selects "Free Community Access"
2. ContactModal opens → User enters email + phone
3. Backend saves to Airtable (status: "completed")
4. Welcome SMS sent via Bird.com
5. Redirect to success page

### Flow 2: Paid Tier - One-Time

1. User selects paid tier ($5, $10, etc.)
2. Redirected to Stripe Checkout
3. User completes payment
4. Stripe webhook → Updates Airtable (status: "completed")
5. Welcome SMS sent
6. Redirect to success page

### Flow 3: Paid Tier - Monthly Subscription

1. User selects paid tier + "Monthly"
2. Redirected to Stripe Checkout
3. User completes first payment
4. Stripe webhook → Updates Airtable (status: "active")
5. Welcome SMS sent
6. Monthly payments auto-renew
7. Monthly webhooks update status

### Flow 4: Monthly Message Delivery

1. System calls: `GET /api/bird/send-monthly-messages`
2. Fetches active/completed payments from Airtable
3. For each payment:
   - Checks phone exists in Phone Numbers table
   - Checks for STOP message
   - Sends monthly care message if eligible
4. Returns delivery summary

### Flow 5: STOP Opt-Out

1. User texts "STOP" to Bird.com number
2. Bird.com automation sends confirmation
3. Phone number marked in Airtable
4. Future monthly messages skip this number

---

## API Endpoints

### Payment

**POST /api/stripe/create-checkout-session**
- Creates Stripe checkout session
- Free tier: Saves directly to Airtable, sends welcome SMS
- Paid tier: Returns Stripe checkout URL

**POST /api/stripe/webhook**
- Handles Stripe events (payment completed, subscription updates)
- Updates Airtable records
- Sends welcome SMS

**GET /api/stripe/session**
- Retrieves checkout session details for success page

### Messaging

**GET /api/bird/send-monthly-messages**
- Sends monthly messages to eligible subscribers
- Query: `?dryRun=true` for testing

**GET /api/bird/sync-automation**
- Syncs automation messages from Bird.com to Airtable

**POST /api/messagebird/webhook/sms**
- Receives SMS webhooks (optional, for LOVE keyword tracking)

---

## Data Storage (Airtable)

### Payments Table
- Email, Phone Number, Tier, Amount
- Payment Type (one-time/monthly)
- Stripe IDs (Customer, Subscription, Session)
- Status (pending/completed/active/failed/cancelled)

### Phone Numbers Table
- Phone Number (primary)
- Message (last message: LOVE, STOP, etc.)
- Created/Updated timestamps

---

## Integrations

### Stripe
- Payment processing
- Subscription management
- Webhook events
- Apple Pay/Google Pay support

### Bird.com
- SMS sending (welcome, monthly messages)
- Automation dashboard (keyword triggers, auto-replies, tagging)
- Direct API for message delivery

### Airtable
- Payment records storage
- Phone number tracking
- Status management

---

## Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Bird.com
BIRD_API_KEY=...
BIRD_WORKSPACE_ID=...
BIRD_CHANNEL_ID=...

# Airtable
AIRTABLE_BASE_ID=...
AIRTABLE_TOKEN=...
```

---

## Monthly Message Delivery

**Eligibility Criteria:**
- Payment status = "active" OR "completed"
- Phone number exists
- Phone number in Phone Numbers table
- Last message ≠ "STOP"

**How to Run:**
```bash
# Test (dry run)
GET /api/bird/send-monthly-messages?dryRun=true

# Send actual messages
GET /api/bird/send-monthly-messages
```

**Schedule:**
- Run monthly (e.g., 1st of each month)
- Cron: `0 10 1 * * curl https://your-domain.com/api/bird/send-monthly-messages`

---

## Testing

**Test Payment:**
1. Use Stripe test card: `4242 4242 4242 4242`
2. Test all tiers (free, paid, custom)
3. Verify Airtable records created
4. Verify welcome SMS sent

**Test Monthly Messages:**
1. Create test payments in Airtable
2. Add phone numbers to Phone Numbers table
3. Run with `?dryRun=true` first
4. Review results, then send actual messages

**Test Keyword Trigger:**
1. Send "LOVE" to Bird.com number
2. Verify auto-reply sent (Bird.com dashboard)
3. Verify phone saved to Airtable (sync-automation)

---

## Troubleshooting

**Payment Issues:**
- Check Stripe Dashboard for errors
- Verify webhook endpoint accessible
- Check Airtable record status

**SMS Not Sending:**
- Verify Bird.com API credentials
- Check phone number format (+country code)
- Review Bird.com dashboard

**Monthly Messages Not Sending:**
- Verify payment status is "active" or "completed"
- Check phone exists in Phone Numbers table
- Verify no STOP message
- Review API response for errors

---

*Last Updated: January 2026*

