# SMS-Auto - Community Weft

A Next.js application for managing SMS-based community subscriptions with Stripe payment integration, Bird.com SMS webhooks, and Airtable data storage.

## Features

- **SMS Webhook Processing**: Receives and processes inbound SMS messages from Bird.com
- **Automatic Replies**: Handles LOVE, UNSUB, and STOP keywords with automatic responses
- **Phone Number Pre-filling**: Automatically pre-fills phone numbers in Stripe checkout (read-only)
- **localStorage Integration**: Persists phone numbers across page sessions
- **Stripe Integration**: Full payment processing with subscriptions and one-time payments
- **Airtable Integration**: Stores payment records and phone numbers
- **Monthly Messaging**: Automated monthly care message delivery

## Quick Start

### Prerequisites

- Node.js 18+ 
- Stripe account
- Bird.com account
- Airtable account

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Environment Variables

Create a `.env.local` file:

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
AIRTABLE_PAYMENTS_TABLE=...
AIRTABLE_PHONE_NUMBERS_TABLE=...

# Application
NGROK_URL=https://your-ngrok-url.ngrok-free.dev
```

### Development

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Documentation

- **[Complete Flow Documentation](./COMPLETE_FLOW_DOCUMENTATION.md)** - Complete user journey from SMS to payment
- **[STOP & UNSUB Flow Documentation](./STOP_UNSUB_FLOW.md)** - Detailed flow for STOP and UNSUB message handling
- **[Payment Flow Documentation](./PAYMENT_FLOW.md)** - Detailed payment processing flows
- **[Stripe Integration](./STRIPE_INTEGRATION.md)** - Stripe API integration details

## Key Flows

### LOVE Message Flow

1. User sends "LOVE" SMS → Webhook processes → Automatic reply with link
2. User clicks link → Landing page with phone pre-filled → Phone saved to localStorage
3. User selects tier → Stripe customer created → Checkout with phone pre-filled (read-only)
4. Payment completed → Welcome SMS sent

### UNSUB/STOP Flow

1. User sends "UNSUB" or "STOP" SMS → Webhook processes
2. Stripe subscription cancelled → Airtable updated to free tier
3. Confirmation message sent in same conversation thread

## API Endpoints

- `POST /bird-sms-webhook` - Receives Bird.com SMS webhooks
- `POST /api/stripe/create-checkout-session` - Creates Stripe checkout session
- `POST /api/stripe/webhook` - Handles Stripe webhook events
- `GET /api/bird/send-monthly-messages` - Sends monthly care messages

## Tech Stack

- **Next.js 14** - React framework
- **Stripe** - Payment processing
- **Bird.com** - SMS messaging
- **Airtable** - Data storage
- **TypeScript** - Type safety

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Bird.com API Documentation](https://docs.bird.com)
- [Airtable API Documentation](https://airtable.com/api)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
