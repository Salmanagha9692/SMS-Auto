# Community Weft - Complete Flow Documentation

## Overview

This document describes the complete user journey from SMS interaction to payment completion, including webhook processing, phone number pre-filling, and Stripe checkout integration.

---

## Complete User Journey: LOVE Message Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User sends SMS "LOVE"                              │
│ - User texts "LOVE" (case-insensitive) to Bird.com number  │
│ - Message received by Bird.com platform                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Bird.com Webhook Processing                        │
│ POST /bird-sms-webhook                                      │
│ ├─ Receives inbound SMS event from Bird.com                 │
│ ├─ Extracts: sender phone, message text, conversation ID    │
│ ├─ Saves phone number and message to Airtable              │
│ ├─ Detects "LOVE" keyword (case-insensitive)               │
│ └─ Sends automatic reply in same conversation thread        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Automatic LOVE Reply                               │
│ Message: "Thanks for joining The Weft! Click here:         │
│          https://selectable-equiprobable-andrea.ngrok-      │
│          free.dev/?phone=+1234567890"                      │
│ - Phone number is URL-encoded in the link                  │
│ - Reply sent in same conversation thread                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User clicks link in SMS                            │
│ - Redirected to landing page with phone parameter         │
│ - URL: /?phone=%2B1234567890 (URL-encoded)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Landing Page Loads                                │
│ - Reads phone parameter from URL                           │
│ - Decodes phone number (e.g., %2B becomes +)              │
│ - Saves phone to localStorage as 'checkoutPhoneNumber'    │
│ - Pre-fills phone number in form field                     │
│ - Auto-selects "Free" tier                                 │
│ - Displays tier options: Free, $5, $10, $25, $50, $75,    │
│   $100, Custom                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: User selects tier and payment type                │
│ - Selects tier (e.g., $5)                                  │
│ - Chooses: One-time or Monthly                             │
│ - Clicks "CONTINUE TO PAYMENT"                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Phone Number Retrieved from localStorage           │
│ - Frontend reads 'checkoutPhoneNumber' from localStorage  │
│ - Falls back to form field if localStorage empty          │
│ - Phone number sent to checkout API                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: Stripe Customer Creation                           │
│ POST /api/stripe/create-checkout-session                   │
│ ├─ Receives phone number from request                      │
│ ├─ Searches for existing Stripe customer by email/phone   │
│ ├─ Creates new customer if not found                      │
│ ├─ Sets customer phone number                              │
│ └─ Returns customer ID                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 9: Stripe Checkout Session Created                   │
│ - Customer ID passed to checkout session                   │
│ - phone_number_collection.enabled = false                  │
│ - Phone number auto-filled from customer record            │
│ - Phone field is hidden (read-only, cannot be edited)      │
│ - User redirected to Stripe Checkout                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 10: Payment Processing                               │
│                                                             │
│ IF FREE TIER:                                               │
│ ├─ ContactModal opens (email + phone required)            │
│ ├─ Phone pre-filled from localStorage                      │
│ ├─ User enters email                                       │
│ ├─ Backend saves directly to Airtable                      │
│ ├─ 4 Welcome SMS messages sent sequentially via Bird.com   │
│ └─ Redirects to /success                                   │
│                                                             │
│ IF PAID TIER:                                               │
│ ├─ Stripe Checkout displays (phone pre-filled, read-only)  │
│ ├─ User enters payment details (card, shipping)            │
│ ├─ Payment processed                                       │
│ ├─ Stripe webhook updates Airtable                         │
│ ├─ 4 Welcome SMS messages sent sequentially via Bird.com   │
│ └─ Redirects to /success                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 11: User receives 4 welcome messages (sequentially)    │
│                                                             │
│ Message 1 — Welcome:                                        │
│ "Welcome to CompassionSMS supporting the wellbeing of       │
│  those living through conflict and crisis. Sign up is       │
│  free; your giving sustains FemSMS."                       │
│                                                             │
│ [2 second delay]                                            │
│                                                             │
│ Message 2 — Shared practice / community:                    │
│ "Connection, care, community: threads holding fabric       │
│  together—through voice and dignity the weft is woven—     │
│  uplifting those living through war and displacement."     │
│                                                             │
│ [2 second delay]                                            │
│                                                             │
│ Message 3 — Rhythm / impact / choice:                      │
│ "When you receive a CompassionSMS message those in         │
│  crisis contexts receive a FemSMS message. After 4          │
│  welcome texts you will receive 2 monthly wellbeing        │
│  texts."                                                    │
│                                                             │
│ [2 second delay]                                            │
│                                                             │
│ Message 4 — Rhythm / impact / choice:                      │
│ "A practice of compassion based on Footage's methods.       │
│  We're happy you're with us. Participation brings hope.     │
│  Dignity in every thread. Reply STOP to cancel texts."      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 12: Monthly Messages (Ongoing)                        │
│ - System sends monthly care messages                       │
│ - Message: "Thank you for being part of Community Weft.    │
│   This is your monthly care message from our makers. We    │
│   appreciate your continued support. Reply STOP anytime    │
│   to opt out."                                             │
│ - Sent to all active/completed subscribers                 │
│ - Respects STOP opt-out                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## HOPE Message Flow (Free-Only Signup)

When a user texts **HOPE** (case-insensitive) to your Bird.com number, this is the flow:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User sends SMS "HOPE"                                     │
│    - Text "HOPE" to Bird.com number                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Bird.com → Your webhook                                  │
│    POST /bird-sms-webhook                                    │
│    - Receives inbound SMS (phone + message text)             │
│    - Saves/updates phone and message in Airtable              │
│      (Phone Numbers table)                                   │
│    - Detects keyword "HOPE"                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Automatic reply with free link                            │
│    - Gets message from Free Content (freeReply template)     │
│    - Replaces {link} with:                                   │
│      https://your-domain.com/free?phone=+1234567890         │
│    - Sends SMS in same conversation                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. User taps link → Free landing page                       │
│    - URL: /free?phone=+1234567890 (number in param)          │
│    - Page loads free content (header, hero, intro from       │
│      Airtable "Free Content" table)                          │
│    - Phone read from URL and stored in localStorage          │
│    - Phone shown read-only; user enters email               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User clicks "Get free access"                             │
│    - POST /api/stripe/create-checkout-session                │
│    - Body: { tier: "free", email, phoneNumber }              │
│    - No Stripe checkout (free tier handled in API)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend (free tier)                                       │
│    - Creates record in Free Signups table (free campaign)    │
│      (status: completed)                                     │
│    - Sends welcome SMS sequence (from main message          │
│      templates: welcomeMessage1–4, 2s apart)                 │
│    - Returns redirect URL: /success?tier=free&amount=0       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. User sees success page                                    │
│    - "WELCOME! You're all set with free access"              │
│    - Same monthly care messages; reply STOP to opt out       │
└─────────────────────────────────────────────────────────────┘
```

**Summary:** HOPE → webhook saves phone & sends free link → user opens /free?phone= → enters email/name/alias → sign up → Airtable + welcome SMS → redirect to success.

**Editable in Free admin:** Free page content (header, hero, intro) and the **Free message** (reply when user texts HOPE) at **/free/admin**. Main welcome SMS texts for free signups use the main admin message templates.

---

## Key Flows

### Flow 1: LOVE Message → Payment (Complete Journey)

1. **User sends "LOVE" SMS**
   - Text "LOVE" to Bird.com number (+15106716597)
   - Case-insensitive matching

2. **Webhook processes message**
   - `POST /bird-sms-webhook` receives event
   - Saves phone number and message to Airtable
   - Detects "LOVE" keyword
   - Sends automatic reply with link

3. **User clicks link**
   - Redirected to landing page with `?phone=+1234567890`
   - Phone number saved to localStorage
   - Phone field pre-filled
   - Free tier auto-selected

4. **User selects tier and continues**
   - Phone retrieved from localStorage
   - Stripe customer created with phone number
   - Checkout session created with customer ID

5. **Stripe Checkout**
   - Phone number auto-filled from customer record
   - Phone field hidden (read-only)
   - User completes payment

6. **Payment completion**
   - Webhook updates Airtable
   - 4 Welcome SMS messages sent sequentially (one by one with 2-second delays)
   - Redirect to success page

### Flow 2: UNSUB Message Handling

1. **User sends "UNSUB" or "UNSUBSCRIBE"**
   - Text to Bird.com number
   - Case-insensitive matching

2. **Webhook processes unsubscription**
   - `POST /bird-sms-webhook` receives event
   - Finds payment record by phone number
   - Cancels Stripe subscription if exists
   - Updates Airtable to free tier
   - Sends confirmation message

3. **Confirmation message**
   - "You have been successfully unsubscribed. You are now free tier user. Thank you for being part of The Weft!"
   - Sent in same conversation thread

### Flow 3: STOP Message Handling

1. **User sends "STOP"**
   - Text to Bird.com number
   - Case-insensitive matching

2. **Webhook processes stop request**
   - `POST /bird-sms-webhook` receives event
   - Finds payment record by phone number
   - Cancels Stripe subscription if exists
   - Updates Airtable to free tier
   - Clears Stripe fields (customer ID, subscription ID, etc.)
   - Saves STOP message to Phone Numbers table

3. **Confirmation message**
   - "You have been successfully unsubscribed. You will no longer receive messages. Reply LOVE to rejoin."
   - Sent in same conversation thread

4. **Future messages blocked**
   - Monthly message system checks for STOP
   - Skips phone numbers with STOP message

### Flow 4: Free Tier Signup

1. User selects "Free Community Access"
2. ContactModal opens → Phone pre-filled from localStorage
3. User enters email
4. Backend saves to Airtable (status: "completed")
5. 4 Welcome SMS messages sent sequentially via Bird.com (one by one with 2-second delays)
6. Redirect to success page

### Flow 5: Paid Tier - One-Time Payment

1. User selects paid tier ($5, $10, etc.)
2. Phone retrieved from localStorage
3. Stripe customer created with phone
4. Redirected to Stripe Checkout (phone pre-filled, read-only)
5. User completes payment
6. Stripe webhook → Updates Airtable (status: "completed")
7. 4 Welcome SMS messages sent sequentially (one by one with 2-second delays)
8. Redirect to success page

### Flow 6: Paid Tier - Monthly Subscription

1. User selects paid tier + "Monthly"
2. Phone retrieved from localStorage
3. Stripe customer created with phone
4. Redirected to Stripe Checkout (phone pre-filled, read-only)
5. User completes first payment
6. Stripe webhook → Updates Airtable (status: "active")
7. 4 Welcome SMS messages sent sequentially (one by one with 2-second delays)
8. Monthly payments auto-renew
9. Monthly webhooks update status

### Flow 7: Monthly Message Delivery

**Option A: Via Admin Panel (Recommended)**
1. Admin navigates to `/admin` page
2. Scrolls to "Send Monthly Messages" button (below Save Changes)
3. Clicks "📤 Send Monthly Messages" button
4. System calls: `GET /api/bird/send-monthly-messages`
5. Fetches active/completed payments from Airtable
6. For each payment:
   - Checks phone exists in Phone Numbers table
   - Checks for STOP message
   - Sends monthly care message if eligible
7. Displays delivery summary in admin panel:
   - Total Payments
   - Eligible subscribers
   - Messages Sent
   - Skipped (if any)
   - Errors (if any)

**Option B: Via API Direct Call**
1. System calls: `GET /api/bird/send-monthly-messages`
2. Fetches active/completed payments from Airtable
3. For each payment:
   - Checks phone exists in Phone Numbers table
   - Checks for STOP message
   - Sends monthly care message if eligible
4. Returns delivery summary

---

## API Endpoints

### SMS Webhook

**POST /bird-sms-webhook**
- Receives inbound SMS events from Bird.com
- Handles LOVE, UNSUB, STOP keywords
- Saves messages to Airtable
- Sends automatic replies in same conversation thread
- Implements idempotency using message IDs

**GET /bird-sms-webhook**
- Webhook verification endpoint
- Returns challenge for verification

### Payment

**POST /api/stripe/create-checkout-session**
- Creates Stripe checkout session
- Creates/retrieves Stripe customer with phone number
- Free tier: Saves directly to Airtable, sends 4 welcome SMS messages sequentially
- Paid tier: Returns Stripe checkout URL with phone pre-filled

**POST /api/stripe/webhook**
- Handles Stripe events (payment completed, subscription updates)
- Updates Airtable records
- Sends 4 welcome SMS messages sequentially (one by one with 2-second delays)

**GET /api/stripe/session**
- Retrieves checkout session details for success page

### Messaging

**GET /api/bird/send-monthly-messages**
- Sends monthly messages to eligible subscribers (all tiers; uses Main Content template)
- Query: `?dryRun=true` for testing
- Can be triggered via Main Admin panel or direct API call

**GET /api/bird/send-monthly-messages-free**
- Sends monthly message to **Hope Tier only** (Free Signups table only; uses Free Content monthly template)
- Query: `?dryRun=true` for testing
- Triggered via Free Admin button “Send Monthly Messages to Free Tier Only”

**GET /api/bird/sync-automation**
- Syncs automation messages from Bird.com to Airtable

### Admin Panel

**GET /admin**
- Main Admin panel for main site content and monthly message sending
- Features:
  - Edit header and hero section content
  - Edit 4 welcome messages (sent sequentially after payment/signup)
  - Edit other message templates (LOVE reply, STOP reply, UNSUB reply, monthly message)
  - Save/Reset content changes
  - Send monthly messages (all eligible subscribers) with one click
  - View delivery summary after sending

**GET /free/admin**
- Free Page Admin panel for free landing page and free-tier messaging
- Features:
  - Same UI structure as Main Admin (Header, Hero, Intro, Message Templates)
  - Edit Free Content only: header, hero, intro, HOPE reply (free link), welcome 1–4, monthly message
  - Save Changes / Reset to Default (all stored in Free Content table)
  - Send monthly messages to **Hope Tier only** (button calls send-monthly-messages-free; reads Free Signups table only)
  - Live Preview of free page
  - Tab to switch to Main Admin

---

## Welcome Message Sequence

After successful payment or Hope-tier (HOPE link) signup, **4 welcome messages are sent sequentially** (one by one, not combined):

1. **Message 1 — Welcome** (140 chars)
   - "Welcome to CompassionSMS supporting the wellbeing of those living through conflict and crisis. Sign up is free; your giving sustains FemSMS."

2. **Message 2 — Shared practice / community** (157 chars)
   - "Connection, care, community: threads holding fabric together—through voice and dignity the weft is woven—uplifting those living through war and displacement."

3. **Message 3 — Rhythm / impact / choice** (157 chars)
   - "When you receive a CompassionSMS message those in crisis contexts receive a FemSMS message. After 4 welcome texts you will receive 2 monthly wellbeing texts."

4. **Message 4 — Rhythm / impact / choice** (160 chars)
   - "A practice of compassion based on Footage's methods. We're happy you're with us. Participation brings hope. Dignity in every thread. Reply STOP to cancel texts."

**Timing**: Each message is sent with a **2-second delay** between them. All messages are sent separately (not combined into one message).

**Configuration**: Messages can be edited in the Admin Panel (`/admin`) under "Message Templates" section.

---

## Data Storage (Airtable)

### Content Table
- Stores website content (header, hero sections)
- Stores message templates including 4 welcome messages (welcomeMessage1, welcomeMessage2, welcomeMessage3, welcomeMessage4)
- Section field options: `header`, `hero`, `messages`

### Separate tables and flows
- **Payments table** — Main site: paid tiers and **main free tier** (user selects Free on main landing after LOVE). Same content (main admin) and same monthly send (main “Send monthly messages”). Tier can be free, 5, 10, etc.
- **Free Signups table** — **Hope only** (HOPE keyword → free link → /free page). Fully separate: different table, Hope/Free Content, and “Send Monthly to Hope Tier” only. No overlap with Payments.

### Payments Table (paid/other campaigns)
- Email, Phone Number, Tier, Amount
- Payment Type (one-time/monthly)
- Stripe IDs (Customer, Subscription, Session)
- Status (pending/completed/active/failed/cancelled)

### Free Signups Table (Hope Tier only)
- EMAIL / NAME / ALIAS, Phone Number
- Tier (Hope) — all signups via HOPE link
- Status (active/completed/inactive/cancelled)
- Created At, Last Updated
- Data is fully separate: no overlap with Payments table. Send monthly messages to Hope Tier uses this table only.
- Optional: use a different Airtable base by setting `AIRTABLE_FREE_BASE_ID` in `.env.local`.

### Phone Numbers Table
- Phone Number (primary)
- Message (last message: LOVE, STOP, UNSUB, etc.)
- Created/Updated timestamps

---

## Technical Implementation Details

### Phone Number Pre-filling Flow

1. **URL Parameter Handling**
   ```javascript
   // Landing page reads phone from URL
   const phoneParam = urlParams.get('phone');
   const decodedPhone = decodeURIComponent(phoneParam);
   ```

2. **localStorage Storage**
   ```javascript
   // Save to localStorage on page load
   localStorage.setItem('checkoutPhoneNumber', decodedPhone);
   ```

3. **Checkout Session Creation**
   ```javascript
   // Retrieve from localStorage when creating checkout
   const checkoutPhone = localStorage.getItem('checkoutPhoneNumber');
   ```

4. **Stripe Customer Creation**
   ```javascript
   // Create/retrieve customer with phone number
   const customer = await stripe.customers.create({
     email: email,
     phone: phoneNumber,
   });
   ```

5. **Checkout Session Configuration**
   ```javascript
   // Pass customer ID and disable phone collection
   sessionParams.customer = customerId;
   sessionParams.phone_number_collection = {
     enabled: false, // Phone pre-filled, read-only
   };
   ```

### Webhook Message Processing

1. **Idempotency**
   - Uses in-memory Set to track processed message IDs
   - Prevents duplicate processing
   - Max cache size: 10,000 messages

2. **Payload Parsing**
   - Handles multiple Bird.com payload formats
   - Supports Channels API format (most common)
   - Extracts: sender, message, conversation ID, timestamp

3. **Conversation Threading**
   - Extracts conversation ID from webhook payload
   - Sends replies in same conversation thread
   - Falls back to phone-based conversation if no ID

4. **Keyword Matching**
   - Case-insensitive matching
   - Keywords: LOVE, HOPE (free link), UNSUB, UNSUBSCRIBE, STOP
   - Processes immediately upon detection

### Stripe Integration

1. **Customer Management**
   - Searches by email first (more reliable)
   - Falls back to phone number search
   - Creates new customer if not found
   - Updates phone number if missing

2. **Checkout Configuration**
   - Phone pre-filled from customer record
   - Phone field hidden (read-only)
   - Shipping address collection enabled
   - Promotion codes allowed

3. **Webhook Processing**
   - Prioritizes `customer_details.phone` from checkout
   - Falls back to metadata if needed
   - Updates Airtable with complete payment info

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
AIRTABLE_BASE_ID=...          # Main base (payments, phone numbers, content)
AIRTABLE_TOKEN=...
AIRTABLE_FREE_BASE_ID=...     # Optional. Free campaign table (Free Signups). If unset, uses main base.

# Application
NGROK_URL=https://selectable-equiprobable-andrea.ngrok-free.dev
```

---

## Monthly Message Delivery

**Eligibility Criteria:**
- Payment status = "active" OR "completed"
- Phone number exists
- Phone number in Phone Numbers table
- Last message ≠ "STOP"

**How to Run:**

**Option 1: Via Admin Panel (Recommended)**
1. Navigate to `/admin` page
2. Scroll to "Send Monthly Messages" section (below Save Changes button)
3. Click "📤 Send Monthly Messages" button
4. Wait for processing to complete
5. View delivery summary displayed on the page

**Option 2: Via API Direct Call**
```bash
# Test (dry run)
GET /api/bird/send-monthly-messages?dryRun=true

# Send actual messages
GET /api/bird/send-monthly-messages
```

**Schedule:**
- Run monthly (e.g., 1st of each month)
- **Via Admin Panel:** Admin manually clicks button on scheduled date
- **Via Cron:** `0 10 1 * * curl https://your-domain.com/api/bird/send-monthly-messages`

---

## Testing

### Test LOVE Message Flow

1. Send "LOVE" to Bird.com number (+15106716597)
2. Verify webhook receives event
3. Verify automatic reply sent with link
4. Click link and verify phone pre-filled on landing page
5. Verify phone saved to localStorage
6. Select tier and continue
7. Verify Stripe checkout has phone pre-filled (read-only)
8. Complete payment
9. Verify all 4 welcome SMS messages received (sent sequentially)

### Test UNSUB Message Flow

1. Send "UNSUB" to Bird.com number
2. Verify webhook processes unsubscription
3. Verify Stripe subscription cancelled
4. Verify Airtable updated to free tier
5. Verify confirmation message received

### Test STOP Message Flow

1. Send "STOP" to Bird.com number
2. Verify webhook processes stop request
3. Verify Stripe subscription cancelled
4. Verify Airtable updated to free tier
5. Verify Stripe fields cleared
6. Verify STOP saved to Phone Numbers table
7. Verify confirmation message received
8. Verify monthly messages skip this number

### Test Payment

1. Use Stripe test card: `4242 4242 4242 4242`
2. Test all tiers (free, paid, custom)
3. Verify phone pre-filled in checkout
4. Verify phone is read-only (field hidden)
5. Verify Airtable records created
6. Verify all 4 welcome SMS messages sent sequentially

### Test Monthly Messages

**Via Admin Panel:**
1. Navigate to `/admin` page
2. Create test payments in Airtable
3. Add phone numbers to Phone Numbers table
4. Click "📤 Send Monthly Messages" button
5. Review delivery summary displayed on page

**Via API:**
1. Create test payments in Airtable
2. Add phone numbers to Phone Numbers table
3. Run with `?dryRun=true` first
4. Review results, then send actual messages

---

## Troubleshooting

### Phone Number Not Pre-filling

**Check:**
1. Verify phone number in URL parameter (check browser console)
2. Verify phone saved to localStorage (check Application tab)
3. Verify customer created in Stripe Dashboard
4. Verify customer has phone number set
5. Check server logs for customer creation

**Solution:**
- Ensure phone number is in E.164 format (+1234567890)
- Check localStorage is not blocked
- Verify phone number is passed to checkout API

### Webhook Not Receiving Messages

**Check:**
1. Verify webhook URL configured in Bird.com dashboard
2. Verify ngrok tunnel is active
3. Check webhook endpoint is accessible
4. Review server logs for incoming requests

**Solution:**
- Test webhook with GET request (verification)
- Check Bird.com dashboard for webhook status
- Verify webhook URL is correct

### Stripe Checkout Phone Field Visible

**Check:**
1. Verify customer created with phone number
2. Verify customer ID passed to checkout session
3. Verify `phone_number_collection.enabled = false`

**Solution:**
- Ensure customer has phone number set
- Check server logs for customer creation
- Verify session parameters in Stripe Dashboard

### Payment Issues

**Check:**
1. Check Stripe Dashboard for errors
2. Verify webhook endpoint accessible
3. Check Airtable record status
4. Review server logs

**Solution:**
- Verify Stripe API keys are correct
- Check webhook signature verification
- Review Airtable API credentials

### SMS Not Sending

**Check:**
1. Verify Bird.com API credentials
2. Check phone number format (+country code)
3. Review Bird.com dashboard
4. Check server logs for API errors

**Solution:**
- Ensure phone number is in E.164 format
- Verify Bird.com API key is valid
- Check Bird.com account status

### Monthly Messages Not Sending

**Check:**
1. Verify payment status is "active" or "completed"
2. Check phone exists in Phone Numbers table
3. Verify no STOP message
4. Review API response for errors
5. Check admin panel for error messages

**Solution:**
- Use admin panel to see detailed error messages
- Run with `?dryRun=true` to see eligibility
- Check Airtable records for correct status
- Verify phone numbers are in correct format
- Check browser console for API errors

---

## Bird.com Webhook Configuration

### Setup Instructions

1. **Navigate to Bird.com Dashboard**
   - Go to: Channels → SMS → Your number (+15106716597)
   - Find "Webhook" or "Inbound SMS Webhook" settings

2. **Configure Webhook URL**
   - URL: `https://selectable-equiprobable-andrea.ngrok-free.dev/bird-sms-webhook`
   - Method: POST
   - Events: Inbound SMS

3. **Verify Webhook**
   - Bird.com may send GET request for verification
   - Endpoint handles both GET and POST requests

4. **Test Webhook**
   - Send test SMS to verify webhook receives events
   - Check server logs for incoming requests

---

## Important Notes

1. **Phone Number Format**
   - Must be in E.164 format: +1234567890
   - URL-encoded in links: %2B1234567890
   - Decoded on landing page

2. **localStorage Persistence**
   - Phone number persists across page refreshes
   - Cleared when user manually clears browser data
   - Used for Stripe checkout pre-filling

3. **Stripe Checkout Limitations**
   - Stripe Checkout doesn't support visible read-only fields
   - Phone field is hidden when `enabled = false`
   - Phone number is still captured from customer record

4. **Webhook Idempotency**
   - Uses in-memory cache (not persistent)
   - For production, consider Redis or database
   - Max cache size prevents memory leaks

5. **Conversation Threading**
   - Replies sent in same conversation thread
   - Uses conversation ID from webhook payload
   - Falls back to phone-based conversation

---

---

## Admin Panel

### Overview

The admin panel (`/admin`) provides a user-friendly interface for managing site content and sending monthly messages.

### Features

1. **Content Management**
   - Edit header section (logo URL, alt text)
   - Edit hero section (title, subtitle)
   - Save changes to Airtable
   - Reset to default content
   - Live preview of changes

2. **Monthly Message Sending**
   - One-click button to send monthly messages
   - Real-time loading indicator
   - Detailed delivery summary:
     - Total Payments processed
     - Eligible subscribers count
     - Messages successfully sent
     - Skipped subscribers (with reasons)
     - Errors (if any)
   - Error handling with clear messages

### Usage

1. Navigate to `/admin` in your browser
2. Edit content as needed (optional)
3. Click "Save Changes" if you made content edits
4. Scroll to "Send Monthly Messages" button
5. Click "📤 Send Monthly Messages"
6. Wait for processing (button shows loading state)
7. Review delivery summary displayed below button

### Monthly Message Summary

After clicking "Send Monthly Messages", the admin panel displays:
- **Total Payments:** Number of active/completed payment records found
- **Eligible:** Number of subscribers eligible to receive messages
- **Sent:** Number of messages successfully sent
- **Skipped:** Number of subscribers skipped (no phone, STOP message, etc.)
- **Errors:** Number of errors encountered (if any)

---

*Last Updated: January 2026*
