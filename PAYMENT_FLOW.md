# Payment Flow Documentation

This document describes the complete user payment flow for all payment scenarios in the SMS-Auto application, including phone number pre-filling and Stripe checkout integration.

---

## Table of Contents

1. [Free Community Access Flow](#flow-1-free-community-access-no-payment)
2. [One-Time Payment Flow](#flow-2-paid-tier--one-time-payment)
3. [Monthly Subscription Flow](#flow-3-paid-tier--monthly-subscription)
4. [Phone Number Pre-filling Flow](#phone-number-pre-filling-flow)
5. [Key Differences Summary](#key-differences)
6. [Important Points](#important-points)

---

## Flow 1: Free Community Access (No Payment)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User on Home Page                                    │
│ - User selects "Free Community Access" tier                  │
│ - Payment frequency doesn't matter (one-time/monthly)        │
│ - Phone number may be pre-filled from localStorage          │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend (app/page.tsx)                             │
│ - Retrieves phone from localStorage (if available)          │
│ - Calls POST /api/stripe/create-checkout-session             │
│ - Sends: { tier: "free", paymentType, email, phoneNumber }  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Backend API (create-checkout-session/route.ts)     │
│ - Detects tier === "free"                                    │
│ - SKIPS Stripe entirely                                      │
│ - Directly saves to Airtable:                                │
│   • tier: "free"                                             │
│   • amount: 0                                                │
│   • status: "completed"                                      │
│   • email, phoneNumber                                        │
│ - Sends welcome SMS via Bird.com                            │
│ - Returns: { url: "/success?tier=free&amount=0" }            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Frontend Redirect                                   │
│ - Automatically redirects to /success page                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Success Page (app/success/page.tsx)                 │
│ - Detects tier === "free" from URL params                    │
│ - Shows: "WELCOME! You're all set with free access"         │
│ - Displays confirmation message                              │
│ - User can click "BACK TO HOME"                              │
└─────────────────────────────────────────────────────────────┘

✅ RESULT: User is immediately signed up, no payment needed
```

### Details:

- **No Stripe involvement**: Free tier completely bypasses Stripe
- **Instant completion**: Status is set to "completed" immediately
- **No webhook needed**: Direct database save
- **Welcome SMS**: Automatic welcome message sent via Bird.com
- **User experience**: Fastest path - user sees success page immediately

---

## Flow 2: Paid Tier - One-Time Payment

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User on Home Page                                    │
│ - User selects tier: $5, $10, $25, $50, $75, $100, or custom│
│ - Selects "One-time" payment frequency                      │
│ - If custom: enters custom amount                          │
│ - Phone number may be pre-filled from localStorage          │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend (app/page.tsx)                             │
│ - Retrieves phone from localStorage (if available)         │
│ - Falls back to form field if localStorage empty            │
│ - Shows "PROCESSING..." button state                         │
│ - Calls POST /api/stripe/create-checkout-session            │
│ - Sends: { tier, amount, paymentType: "one-time",            │
│           email, phoneNumber }                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Backend API (create-checkout-session/route.ts)     │
│ - Receives phone number from request                        │
│ - Creates/retrieves Stripe customer with phone number     │
│   • Searches by email first (more reliable)                │
│   • Falls back to phone number search                      │
│   • Creates new customer if not found                       │
│   • Sets customer phone number                              │
│ - Creates Stripe Checkout Session (one-time payment)       │
│ - Saves PENDING record to Airtable:                         │
│   • tier, amount, paymentType                               │
│   • email, phoneNumber                                       │
│   • stripeSessionId, stripeCustomerId                       │
│   • status: "pending"                                        │
│ - Returns: { url: "https://checkout.stripe.com/..." }       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Stripe Checkout (Hosted by Stripe)                 │
│ - User redirected to Stripe's secure checkout page         │
│ - Phone number is PRE-FILLED from customer record          │
│ - Phone field is HIDDEN (read-only, cannot be edited)      │
│ - User enters:                                              │
│   • Email (optional, but collected)                        │
│   • Payment method (card, Apple Pay, Google Pay)            │
│   • Shipping address (required)                            │
│ - User clicks "Pay"                                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Payment Processing                                  │
│ - Stripe processes payment                                   │
│ - Payment succeeds or fails                                  │
└──────┬───────────────────────────────┬──────────────────────┘
       │                               │
       ▼                               ▼
┌──────────────────────┐    ┌──────────────────────┐
│ SUCCESS PATH          │    │ CANCEL PATH          │
│ Redirects to:         │    │ Redirects to:        │
│ /success?session_id=cs_│    │ /cancel              │
└──────┬────────────────┘    └──────┬───────────────┘
       │                           │
       ▼                           ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6A: Success Page (app/success/page.tsx)               │
│ - Fetches session details from /api/stripe/session          │
│ - Shows payment confirmation                                │
│ - Displays: amount, payment type, email, phone             │
│ - Shows: "THANK YOU! Your payment was successful"          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6B: Cancel Page (app/cancel/page.tsx)                 │
│ - Shows: "PAYMENT CANCELLED"                                 │
│ - Message: "No charges have been made"                     │
│ - Option to "TRY AGAIN"                                      │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Webhook (Background - Parallel to Step 6)          │
│ - Stripe sends webhook: checkout.session.completed           │
│ - POST /api/stripe/webhook receives event                   │
│ - Updates Airtable record:                                    │
│   • status: "pending" → "completed"                        │
│   • Adds: email, phone, customerId, paymentIntentId        │
│ - Sends welcome SMS via Bird.com                            │
│ - This happens even if user closes browser!                │
└─────────────────────────────────────────────────────────────┘

✅ RESULT: Payment completed, record in Airtable with status "completed"
```

### Details:

- **Stripe Checkout**: User redirected to Stripe's hosted payment page
- **Phone Pre-filling**: Phone number automatically filled from customer record
- **Read-only Phone**: Phone field is hidden, cannot be edited
- **Pending status**: Initial record created with "pending" status
- **Webhook confirmation**: Final status updated via webhook for reliability
- **User experience**: ~30 seconds from click to confirmation
- **Fallback**: Webhook ensures payment is recorded even if user closes browser

---

## Flow 3: Paid Tier - Monthly Subscription

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1-3: Same as One-Time Payment                          │
│ (User selects tier, clicks continue, backend creates        │
│  customer with phone, creates session)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Stripe Checkout (Subscription Mode)                │
│ - Phone number PRE-FILLED from customer record              │
│ - Phone field HIDDEN (read-only)                            │
│ - Same checkout experience                                  │
│ - But creates SUBSCRIPTION instead of one-time payment     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Payment Processing                                  │
│ - First payment processed                                    │
│ - Subscription created in Stripe                            │
└──────┬───────────────────────────────┬──────────────────────┘
       │                               │
       ▼                               ▼
┌──────────────────────┐    ┌──────────────────────┐
│ SUCCESS               │    │ CANCEL               │
│ /success?session_id=  │    │ /cancel              │
└──────┬────────────────┘    └─────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Success Page                                        │
│ - Shows subscription confirmation                            │
│ - Displays: "Monthly subscription active"                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Webhooks (Multiple Events)                          │
│                                                              │
│ Event 1: checkout.session.completed                        │
│ - Updates Airtable: status → "active"                       │
│ - Adds subscriptionId                                       │
│ - Sends welcome SMS via Bird.com                            │
│                                                              │
│ Event 2: customer.subscription.created                     │
│ - Links subscription ID to record                           │
│                                                              │
│ Event 3: invoice.payment_succeeded (Monthly)              │
│ - Fires every month when subscription renews                │
│ - Updates status to "active"                                │
│                                                              │
│ Event 4: invoice.payment_failed (If payment fails)         │
│ - Updates status to "failed"                               │
│                                                              │
│ Event 5: customer.subscription.deleted (If cancelled)      │
│ - Updates status to "cancelled"                            │
└─────────────────────────────────────────────────────────────┘

✅ RESULT: Subscription active, automatically renews monthly
```

### Details:

- **Subscription mode**: Stripe creates recurring subscription
- **Phone Pre-filling**: Phone number automatically filled from customer record
- **Read-only Phone**: Phone field is hidden, cannot be edited
- **Active status**: Status set to "active" after first payment
- **Automatic renewals**: Webhooks handle monthly payments automatically
- **Lifecycle tracking**: Webhooks track all subscription changes
- **User experience**: Same checkout, but ongoing billing

---

## Phone Number Pre-filling Flow

### Complete Flow from LOVE Message to Payment

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User sends "LOVE" SMS                                │
│ - User texts "LOVE" to Bird.com number                       │
│ - Webhook processes and sends automatic reply with link     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: User clicks link in SMS                             │
│ - Link: /?phone=%2B1234567890 (URL-encoded)                 │
│ - Redirected to landing page                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Landing Page Loads                                  │
│ - Reads phone parameter from URL                            │
│ - Decodes phone number (e.g., %2B becomes +)               │
│ - Saves phone to localStorage as 'checkoutPhoneNumber'     │
│ - Pre-fills phone number in form field                      │
│ - Auto-selects "Free" tier                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: User selects tier and continues                     │
│ - User can change tier (e.g., to $5, $10, etc.)            │
│ - Phone number remains in form (from localStorage)          │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Frontend Retrieves Phone from localStorage          │
│ - Reads 'checkoutPhoneNumber' from localStorage              │
│ - Falls back to form field if localStorage empty            │
│ - Sends phone number to checkout API                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Backend Creates Stripe Customer                     │
│ - Searches for existing customer by email/phone            │
│ - Creates new customer if not found                         │
│ - Sets customer phone number                                │
│ - Returns customer ID                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: Stripe Checkout Session Created                     │
│ - Customer ID passed to checkout session                   │
│ - phone_number_collection.enabled = false                  │
│ - Phone number auto-filled from customer record             │
│ - Phone field is hidden (read-only, cannot be edited)      │
│ - User redirected to Stripe Checkout                       │
└─────────────────────────────────────────────────────────────┘
```

### Technical Implementation

1. **localStorage Storage**
   ```javascript
   // On page load (from URL parameter)
   localStorage.setItem('checkoutPhoneNumber', decodedPhone);
   ```

2. **localStorage Retrieval**
   ```javascript
   // When creating checkout
   const checkoutPhone = localStorage.getItem('checkoutPhoneNumber') || phoneNumber.trim();
   ```

3. **Stripe Customer Creation**
   ```javascript
   // In createCheckoutSession
   const customer = await stripe.customers.create({
     email: email,
     phone: phoneNumber,
   });
   ```

4. **Checkout Session Configuration**
   ```javascript
   // Pass customer ID and disable phone collection
   sessionParams.customer = customerId;
   sessionParams.phone_number_collection = {
     enabled: false, // Phone pre-filled, read-only
   };
   ```

### Benefits

- ✅ **Seamless Experience**: Phone number automatically carried from SMS to checkout
- ✅ **No Manual Entry**: User doesn't need to re-enter phone number
- ✅ **Read-only**: Phone number cannot be changed in checkout
- ✅ **Persistent**: Phone number saved in localStorage across page refreshes
- ✅ **Reliable**: Falls back to form field if localStorage unavailable

---

## Key Differences

| Aspect | Free Tier | One-Time Payment | Monthly Subscription |
|--------|-----------|-----------------|---------------------|
| **Stripe involved?** | ❌ No | ✅ Yes | ✅ Yes |
| **Phone Pre-filling** | ✅ Yes (from localStorage) | ✅ Yes (from customer record) | ✅ Yes (from customer record) |
| **Phone Field in Checkout** | N/A (no checkout) | 🔒 Hidden (read-only) | 🔒 Hidden (read-only) |
| **Airtable status** | `completed` immediately | `pending` → `completed` | `pending` → `active` |
| **Webhook needed?** | ❌ No | ✅ Yes (for reliability) | ✅ Yes (required) |
| **Redirect** | Direct to success | Stripe Checkout → Success | Stripe Checkout → Success |
| **Time to complete** | Instant (~1 second) | ~30 seconds | ~30 seconds |
| **Ongoing tracking** | None | None | Monthly webhooks |
| **Payment method** | N/A | Card, Apple Pay, Google Pay | Card, Apple Pay, Google Pay |
| **User data collected** | Email, Phone | Email, Phone (pre-filled) | Email, Phone (pre-filled) |

---

## Important Points

### 1. Free Tier
- ✅ **Bypasses Stripe completely** - No payment processing
- ✅ **Instant completion** - Status set to "completed" immediately
- ✅ **No webhook needed** - Direct database save
- ✅ **Welcome SMS** - Automatic welcome message sent
- ✅ **Fastest user experience** - User sees success page immediately

### 2. Paid Tiers
- ✅ **Go through Stripe Checkout** - Secure, hosted payment page
- ✅ **Phone Pre-filling** - Phone number automatically filled from customer record
- ✅ **Read-only Phone** - Phone field is hidden, cannot be edited
- ✅ **Webhooks ensure reliability** - Payment recorded even if user closes browser
- ✅ **Professional experience** - Apple Pay, Google Pay support
- ✅ **Data collection** - Email and phone number collected automatically

### 3. Phone Number Handling
- ✅ **localStorage Persistence** - Phone number saved across page sessions
- ✅ **URL Parameter Support** - Phone number can come from LOVE message link
- ✅ **Stripe Customer Integration** - Phone number stored in Stripe customer record
- ✅ **Read-only in Checkout** - Phone field hidden, cannot be edited
- ✅ **Fallback Support** - Falls back to form field if localStorage unavailable

### 4. Webhooks
- ✅ **Critical for subscriptions** - Required for monthly renewals
- ✅ **Reliability for one-time** - Ensures payment recorded even if redirect fails
- ✅ **Background processing** - Happens automatically, user doesn't wait
- ✅ **Event tracking** - Handles all payment lifecycle events

### 5. Status Flow
- **Free**: `completed` (immediate)
- **One-time**: `pending` → `completed` (via webhook)
- **Monthly**: `pending` → `active` (stays active with monthly renewals)

### 6. Error Handling
- **Payment failures**: Tracked via `invoice.payment_failed` webhook
- **Cancellations**: Tracked via `customer.subscription.deleted` webhook
- **User cancellation**: Redirects to `/cancel` page
- **Network issues**: Webhook ensures payment is still recorded
- **Customer creation failures**: Falls back to email-only checkout

---

## API Endpoints Used

### Frontend → Backend
- `POST /api/stripe/create-checkout-session` - Creates payment session
- `GET /api/stripe/session?session_id=xxx` - Retrieves session details

### Stripe → Backend (Webhooks)
- `POST /api/stripe/webhook` - Receives Stripe events

### Pages
- `/` - Home page with tier selection
- `/?phone=+1234567890` - Home page with phone pre-filled
- `/success` - Payment success confirmation
- `/cancel` - Payment cancellation page

---

## Airtable Record Structure

### Fields Created:
- `Email` - Customer email address
- `Phone Number` - Customer phone number (from localStorage or form)
- `Tier` - Selected tier (free, 5, 10, 25, 50, 75, 100, custom)
- `Amount` - Payment amount in USD
- `Payment Type` - one-time or monthly
- `Stripe Customer ID` - Stripe customer identifier (with phone number)
- `Stripe Subscription ID` - Stripe subscription identifier (for monthly)
- `Stripe Payment Intent ID` - Stripe payment identifier (for one-time)
- `Stripe Session ID` - Stripe checkout session identifier
- `Status` - pending, completed, active, failed, cancelled
- `Created At` - Timestamp when record was created
- `Last Updated` - Timestamp when record was last updated

---

## Testing Scenarios

### Test Free Tier:
1. Select "Free Community Access"
2. Enter email and phone (or use phone from localStorage)
3. Click "CONTINUE TO PAYMENT"
4. Should immediately redirect to success page
5. Check Airtable - record should have status "completed"
6. Verify welcome SMS received

### Test One-Time Payment:
1. Select any paid tier ($5, $10, etc.)
2. Select "One-time"
3. Phone should be pre-filled from localStorage (if available)
4. Click "CONTINUE TO PAYMENT"
5. Verify phone is pre-filled in Stripe checkout (read-only)
6. Complete payment with test card: `4242 4242 4242 4242`
7. Should redirect to success page
8. Check Airtable - record should have status "completed"
9. Check webhook logs - should receive `checkout.session.completed`
10. Verify welcome SMS received

### Test Monthly Subscription:
1. Select any paid tier
2. Select "Monthly"
3. Phone should be pre-filled from localStorage (if available)
4. Click "CONTINUE TO PAYMENT"
5. Verify phone is pre-filled in Stripe checkout (read-only)
6. Complete payment with test card
7. Should redirect to success page
8. Check Airtable - record should have status "active"
9. Check webhook logs - should receive multiple events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`
10. Verify welcome SMS received

### Test Phone Pre-filling:
1. Send "LOVE" SMS to Bird.com number
2. Click link in reply (contains phone parameter)
3. Verify phone is pre-filled on landing page
4. Verify phone is saved to localStorage
5. Select paid tier and continue
6. Verify phone is pre-filled in Stripe checkout
7. Verify phone field is hidden (read-only)

---

## Troubleshooting

### Payment not showing in Airtable:
- Check webhook is configured correctly
- Verify `STRIPE_WEBHOOK_SECRET` is set
- Check webhook logs in Stripe Dashboard
- Verify webhook endpoint is accessible

### Free tier not working:
- Check Airtable connection
- Verify `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` are set
- Check server logs for errors
- Verify welcome SMS is being sent

### Subscription not renewing:
- Verify webhook is receiving `invoice.payment_succeeded` events
- Check subscription status in Stripe Dashboard
- Verify webhook handler is updating Airtable correctly

### Phone number not pre-filling:
- Check phone number in URL parameter (check browser console)
- Verify phone saved to localStorage (check Application tab)
- Verify customer created in Stripe Dashboard
- Verify customer has phone number set
- Check server logs for customer creation
- Ensure phone number is in E.164 format (+1234567890)

### Phone field visible in checkout:
- Verify customer created with phone number
- Verify customer ID passed to checkout session
- Verify `phone_number_collection.enabled = false`
- Check server logs for customer creation

---

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
2. **Environment Variables**: Never commit secrets to version control
3. **HTTPS Only**: Webhooks must use HTTPS in production
4. **Idempotency**: Webhook handlers should be idempotent (safe to retry)
5. **Phone Number Validation**: Validate phone numbers before saving to Stripe
6. **localStorage Security**: Phone numbers in localStorage are client-side only

---

## Support

For issues or questions:
- Check server logs for error messages
- Review Stripe Dashboard for payment status
- Check Airtable for record updates
- Verify webhook events in Stripe Dashboard → Webhooks → Recent events
- Check browser console for localStorage issues
- Verify phone number format (E.164: +1234567890)

---

*Last Updated: January 2026*
