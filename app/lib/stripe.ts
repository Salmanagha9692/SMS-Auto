import Stripe from 'stripe';

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

/**
 * Create a Stripe Checkout Session for payment
 */
export async function createCheckoutSession(params: {
  tier: string;
  amount: number;
  paymentType: 'one-time' | 'monthly';
  email?: string;
  phoneNumber?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const { tier, amount, paymentType, email, phoneNumber, successUrl, cancelUrl } = params;

  // Base session parameters
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    payment_method_types: ['card'],
    mode: paymentType === 'monthly' ? 'subscription' : 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      tier,
      paymentType,
      phoneNumber: phoneNumber || '',
    },
    allow_promotion_codes: true,
  };

  // Add customer email if provided
  if (email) {
    sessionParams.customer_email = email;
  }

  // Add phone number collection
  sessionParams.phone_number_collection = {
    enabled: true,
  };

  // Configure line items based on payment type
  if (paymentType === 'monthly') {
    // Create subscription with price_data
    sessionParams.line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: tier === 'free' ? 'Community Weft - Free Access' : `Community Weft - $${amount}/month`,
            description: 'Monthly text practice of care and connection',
          },
          recurring: {
            interval: 'month',
          },
          unit_amount: amount * 100, // Convert to cents
        },
        quantity: 1,
      },
    ];
  } else {
    // One-time payment
    sessionParams.line_items = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: tier === 'free' ? 'Community Weft - Free Access' : `Community Weft - $${amount}`,
            description: 'One-time contribution to Community Weft',
          },
          unit_amount: amount * 100, // Convert to cents
        },
        quantity: 1,
      },
    ];
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(sessionId: string) {
  return await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['customer', 'subscription', 'payment_intent'],
  });
}

/**
 * Create a customer portal session for subscription management
 */
export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Retrieve a subscription by ID
 */
export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

