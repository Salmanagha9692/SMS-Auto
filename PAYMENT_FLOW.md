# Payment Flow Documentation

This document describes the complete user payment flow for all payment scenarios in the SMS-Auto application.

---

## Table of Contents

1. [Free Community Access Flow](#flow-1-free-community-access-no-payment)
2. [One-Time Payment Flow](#flow-2-paid-tier--one-time-payment)
3. [Monthly Subscription Flow](#flow-3-paid-tier--monthly-subscription)
4. [Key Differences Summary](#key-differences)
5. [Important Points](#important-points)

---

## Flow 1: Free Community Access (No Payment)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User on Home Page                                    │
│ - User selects "Free Community Access" tier                  │
│ - Payment frequency doesn't matter (one-time/monthly)        │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend (app/page.tsx)                             │
│ - Calls POST /api/stripe/create-checkout-session             │
│ - Sends: { tier: "free", paymentType: "monthly/one-time" }  │
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
│   • status: "completed"                                       │
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
- **User experience**: Fastest path - user sees success page immediately

---

## Flow 2: Paid Tier - One-Time Payment

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User on Home Page                                    │
│ - User selects tier: $5, $10, $25, $50, $75, $100, or custom│
│ - Selects "One-time" payment frequency                      │
│ - If custom: enters custom amount                           │
│ - Clicks "CONTINUE TO PAYMENT"                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Frontend (app/page.tsx)                             │
│ - Shows "PROCESSING..." button state                         │
│ - Calls POST /api/stripe/create-checkout-session            │
│ - Sends: { tier, amount, paymentType: "one-time" }         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Backend API (create-checkout-session/route.ts)     │
│ - Creates Stripe Checkout Session (one-time payment)       │
│ - Saves PENDING record to Airtable:                         │
│   • tier, amount, paymentType                               │
│   • stripeSessionId                                          │
│   • status: "pending"                                        │
│ - Returns: { url: "https://checkout.stripe.com/..." }       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Stripe Checkout (Hosted by Stripe)                 │
│ - User redirected to Stripe's secure checkout page          │
│ - User enters:                                              │
│   • Email (optional, but collected)                        │
│   • Phone number (collected automatically)                  │
│   • Payment method (card, Apple Pay, Google Pay)            │
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
│ - Displays: amount, payment type, email                    │
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
│ - This happens even if user closes browser!                │
└─────────────────────────────────────────────────────────────┘

✅ RESULT: Payment completed, record in Airtable with status "completed"
```

### Details:

- **Stripe Checkout**: User redirected to Stripe's hosted payment page
- **Pending status**: Initial record created with "pending" status
- **Webhook confirmation**: Final status updated via webhook for reliability
- **User experience**: ~30 seconds from click to confirmation
- **Fallback**: Webhook ensures payment is recorded even if user closes browser

---

## Flow 3: Paid Tier - Monthly Subscription

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1-3: Same as One-Time Payment                           │
│ (User selects tier, clicks continue, backend creates session) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Stripe Checkout (Subscription Mode)                │
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
- **Active status**: Status set to "active" after first payment
- **Automatic renewals**: Webhooks handle monthly payments automatically
- **Lifecycle tracking**: Webhooks track all subscription changes
- **User experience**: Same checkout, but ongoing billing

---

## Key Differences

| Aspect | Free Tier | One-Time Payment | Monthly Subscription |
|--------|-----------|-----------------|---------------------|
| **Stripe involved?** | ❌ No | ✅ Yes | ✅ Yes |
| **Airtable status** | `completed` immediately | `pending` → `completed` | `pending` → `active` |
| **Webhook needed?** | ❌ No | ✅ Yes (for reliability) | ✅ Yes (required) |
| **Redirect** | Direct to success | Stripe Checkout → Success | Stripe Checkout → Success |
| **Time to complete** | Instant (~1 second) | ~30 seconds | ~30 seconds |
| **Ongoing tracking** | None | None | Monthly webhooks |
| **Payment method** | N/A | Card, Apple Pay, Google Pay | Card, Apple Pay, Google Pay |
| **User data collected** | None (optional) | Email, Phone | Email, Phone |

---

## Important Points

### 1. Free Tier
- ✅ **Bypasses Stripe completely** - No payment processing
- ✅ **Instant completion** - Status set to "completed" immediately
- ✅ **No webhook needed** - Direct database save
- ✅ **Fastest user experience** - User sees success page immediately

### 2. Paid Tiers
- ✅ **Go through Stripe Checkout** - Secure, hosted payment page
- ✅ **Webhooks ensure reliability** - Payment recorded even if user closes browser
- ✅ **Professional experience** - Apple Pay, Google Pay support
- ✅ **Data collection** - Email and phone number collected automatically

### 3. Webhooks
- ✅ **Critical for subscriptions** - Required for monthly renewals
- ✅ **Reliability for one-time** - Ensures payment recorded even if redirect fails
- ✅ **Background processing** - Happens automatically, user doesn't wait
- ✅ **Event tracking** - Handles all payment lifecycle events

### 4. Status Flow
- **Free**: `completed` (immediate)
- **One-time**: `pending` → `completed` (via webhook)
- **Monthly**: `pending` → `active` (stays active with monthly renewals)

### 5. Error Handling
- **Payment failures**: Tracked via `invoice.payment_failed` webhook
- **Cancellations**: Tracked via `customer.subscription.deleted` webhook
- **User cancellation**: Redirects to `/cancel` page
- **Network issues**: Webhook ensures payment is still recorded

---

## API Endpoints Used

### Frontend → Backend
- `POST /api/stripe/create-checkout-session` - Creates payment session
- `GET /api/stripe/session?session_id=xxx` - Retrieves session details

### Stripe → Backend (Webhooks)
- `POST /api/stripe/webhook` - Receives Stripe events

### Pages
- `/` - Home page with tier selection
- `/success` - Payment success confirmation
- `/cancel` - Payment cancellation page

---

## Airtable Record Structure

### Fields Created:
- `Email` - Customer email address
- `Phone Number` - Customer phone number
- `Tier` - Selected tier (free, 5, 10, 25, 50, 75, 100, custom)
- `Amount` - Payment amount in USD
- `Payment Type` - one-time or monthly
- `Stripe Customer ID` - Stripe customer identifier
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
2. Click "CONTINUE TO PAYMENT"
3. Should immediately redirect to success page
4. Check Airtable - record should have status "completed"

### Test One-Time Payment:
1. Select any paid tier ($5, $10, etc.)
2. Select "One-time"
3. Click "CONTINUE TO PAYMENT"
4. Complete payment with test card: `4242 4242 4242 4242`
5. Should redirect to success page
6. Check Airtable - record should have status "completed"
7. Check webhook logs - should receive `checkout.session.completed`

### Test Monthly Subscription:
1. Select any paid tier
2. Select "Monthly"
3. Click "CONTINUE TO PAYMENT"
4. Complete payment with test card
5. Should redirect to success page
6. Check Airtable - record should have status "active"
7. Check webhook logs - should receive multiple events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `invoice.payment_succeeded`

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

### Subscription not renewing:
- Verify webhook is receiving `invoice.payment_succeeded` events
- Check subscription status in Stripe Dashboard
- Verify webhook handler is updating Airtable correctly

---

## Security Considerations

1. **Webhook Verification**: Always verify webhook signatures using `STRIPE_WEBHOOK_SECRET`
2. **Environment Variables**: Never commit secrets to version control
3. **HTTPS Only**: Webhooks must use HTTPS in production
4. **Idempotency**: Webhook handlers should be idempotent (safe to retry)

---

## Support

For issues or questions:
- Check server logs for error messages
- Review Stripe Dashboard for payment status
- Check Airtable for record updates
- Verify webhook events in Stripe Dashboard → Webhooks → Recent events

