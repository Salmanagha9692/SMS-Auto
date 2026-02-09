# Stripe Integration Documentation

## Overview

This application integrates Stripe for payment processing, supporting both one-time payments and monthly subscriptions. The integration includes:

- Multiple payment tiers ($5, $10, $25, $50, $75, $100, custom amounts)
- Free tier with no payment required
- One-time and monthly recurring payments
- Apple Pay and Google Pay support
- Webhook handling for payment events
- Airtable integration for payment tracking

## Setup Instructions

### 1. Install Dependencies

Dependencies are already installed:
- `stripe` - Server-side Stripe SDK
- `@stripe/stripe-js` - Client-side Stripe SDK

### 2. Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Stripe Keys (Get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (Get from https://dashboard.stripe.com/test/webhooks)
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Stripe Dashboard Setup

#### Create Products (Optional)

You can pre-create products in Stripe Dashboard, but the integration uses dynamic pricing which creates products on-the-fly. This gives you more flexibility.

#### Configure Webhook

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret and add to `.env.local` as `STRIPE_WEBHOOK_SECRET`

## Architecture

### Frontend Flow

1. User selects tier and payment type on home page (`app/page.tsx`)
2. Clicks "CONTINUE TO PAYMENT"
3. Frontend calls `/api/stripe/create-checkout-session`
4. User is redirected to Stripe Checkout
5. After payment, user is redirected to success/cancel page

### Backend API Routes

#### `/api/stripe/create-checkout-session` (POST)

Creates a Stripe Checkout Session.

**Request Body:**
```json
{
  "tier": "5" | "10" | "25" | "50" | "75" | "100" | "custom" | "free",
  "customAmount": "15.00", // Required if tier is "custom"
  "paymentType": "one-time" | "monthly",
  "email": "user@example.com", // Optional
  "phoneNumber": "+1234567890" // Optional
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

#### `/api/stripe/webhook` (POST)

Handles Stripe webhook events. This endpoint:
- Verifies webhook signature
- Processes payment events
- Updates Airtable with payment status

#### `/api/stripe/session` (GET)

Retrieves checkout session details for the success page.

**Query Parameters:**
- `session_id`: Stripe Checkout Session ID

### Airtable Integration

The integration creates a "Payments" table in Airtable with the following fields:

- **Email** (email)
- **Phone Number** (phoneNumber)
- **Tier** (singleSelect: free, 5, 10, 25, 50, 75, 100, custom)
- **Amount** (number)
- **Payment Type** (singleSelect: one-time, monthly)
- **Stripe Customer ID** (singleLineText)
- **Stripe Subscription ID** (singleLineText)
- **Stripe Payment Intent ID** (singleLineText)
- **Stripe Session ID** (singleLineText)
- **Status** (singleSelect: pending, completed, failed, cancelled, active, inactive)
- **Created At** (dateTime)
- **Last Updated** (dateTime)

## Testing

### Test Mode

Use Stripe test mode for development:

1. Use test API keys (starting with `sk_test_` and `pk_test_`)
2. Use test card numbers:
   - Success: `4242 4242 4242 4242`
   - Requires authentication: `4000 0025 0000 3155`
   - Declined: `4000 0000 0000 9995`

### Webhook Testing

#### Option 1: Stripe CLI (Recommended for local development)

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy the webhook signing secret and add to .env.local
```

#### Option 2: ngrok (For testing with real URL)

```bash
# Install ngrok
# Download from https://ngrok.com/download

# Start ngrok
ngrok http 3000

# Use the ngrok URL in Stripe Dashboard webhook settings
# Example: https://abc123.ngrok.io/api/stripe/webhook
```

### Test Payment Flow

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`

3. Select a payment tier (e.g., $5)

4. Choose payment type (one-time or monthly)

5. Click "CONTINUE TO PAYMENT"

6. Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code

7. Complete the payment

8. Verify:
   - Redirected to success page
   - Payment recorded in Airtable
   - Webhook events received

## Payment Types

### One-Time Payment

- Creates a single charge
- User pays once
- Status changes to "completed" after payment

### Monthly Subscription

- Creates a recurring subscription
- User is charged monthly
- Status changes to "active" after first payment
- Subsequent payments trigger `invoice.payment_succeeded` webhook

## Free Tier

The free tier bypasses Stripe entirely:
- No payment required
- Directly saves to Airtable with status "completed"
- Redirects to success page immediately

## Error Handling

### Frontend Errors

- Display error message below payment form
- Allow user to retry

### Backend Errors

- Log errors to console
- Return appropriate HTTP status codes
- Send error messages to frontend

### Webhook Errors

- Webhook failures are logged
- Return 200 status to prevent Stripe retries for handled errors
- Return 500 status for unhandled errors (Stripe will retry)

## Security

1. **API Key Security**
   - Never expose secret keys in frontend code
   - Use environment variables
   - Use different keys for test/production

2. **Webhook Verification**
   - Always verify webhook signatures
   - Use `STRIPE_WEBHOOK_SECRET` for verification

3. **Amount Validation**
   - Validate amounts server-side
   - Never trust client-side values

## Production Checklist

- [ ] Replace test API keys with production keys
- [ ] Update webhook endpoint to production URL
- [ ] Test webhook delivery
- [ ] Enable Apple Pay domain verification
- [ ] Configure Stripe tax settings
- [ ] Set up subscription email notifications
- [ ] Configure customer portal for subscription management
- [ ] Test all payment scenarios
- [ ] Monitor Stripe Dashboard for errors
- [ ] Set up billing alerts

## Support

For Stripe-specific issues:
- Stripe Documentation: https://stripe.com/docs
- Stripe Dashboard: https://dashboard.stripe.com
- Stripe Support: https://support.stripe.com

For application issues:
- Check logs in terminal
- Check Airtable for payment records
- Verify webhook events in Stripe Dashboard

