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
 * Create or retrieve a Stripe customer with phone number
 * This ensures the phone number is pre-filled in checkout
 */
async function getOrCreateCustomerWithPhone(email?: string, phoneNumber?: string): Promise<string | undefined> {
  if (!phoneNumber) {
    console.log('⚠️  No phone number provided for customer creation');
    return undefined;
  }

  try {
    console.log('🔍 Searching for customer with phone:', phoneNumber);
    
    // Search for existing customer by email first (more reliable than phone search)
    let customerId: string | undefined;
    
    if (email) {
      const customersByEmail = await stripe.customers.list({
        email: email,
        limit: 1,
      });
      
      if (customersByEmail.data.length > 0) {
        customerId = customersByEmail.data[0].id;
        console.log('✅ Found existing customer by email:', customerId);
        
        // Update customer with phone number if not already set
        if (customersByEmail.data[0].phone !== phoneNumber) {
          await stripe.customers.update(customerId, {
            phone: phoneNumber,
          });
          console.log('📱 Updated customer phone number');
        }
        return customerId;
      }
    }

    // If no customer found by email, try searching by phone
    // Note: Stripe's phone search might not work perfectly, so we'll create if not found
    const customersByPhone = await stripe.customers.list({
      limit: 100, // Get more customers to search through
    });
    
    const customerWithPhone = customersByPhone.data.find(c => c.phone === phoneNumber);
    if (customerWithPhone) {
      console.log('✅ Found existing customer by phone:', customerWithPhone.id);
      // Update email if provided and different
      if (email && customerWithPhone.email !== email) {
        await stripe.customers.update(customerWithPhone.id, {
          email: email,
        });
      }
      return customerWithPhone.id;
    }

    // Create new customer with phone number
    console.log('➕ Creating new customer with phone:', phoneNumber);
    const customer = await stripe.customers.create({
      email: email,
      phone: phoneNumber,
    });

    console.log('✅ Created new customer:', customer.id);
    return customer.id;
  } catch (error: any) {
    console.error('❌ Error creating/retrieving customer:', error.message);
    // Return undefined if customer creation fails - checkout will still work
    return undefined;
  }
}

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

  // Create or retrieve customer with phone number to pre-fill in checkout
  let customerId: string | undefined;
  if (phoneNumber && phoneNumber.trim()) {
    console.log('📱 Creating/retrieving customer with phone:', phoneNumber);
    customerId = await getOrCreateCustomerWithPhone(email, phoneNumber.trim());
    console.log('📱 Customer with phone number:', customerId ? `✅ ${customerId}` : '❌ Failed');
  } else {
    console.log('⚠️  No phone number provided, skipping customer creation');
  }

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

  // If we have a customer ID with phone number, use it to pre-fill and make read-only
  // By disabling phone collection, the phone from customer record is used but field is hidden (read-only)
  if (customerId) {
    sessionParams.customer = customerId;
    // Disable phone collection - phone from customer record will be used automatically
    // This makes it effectively read-only (user can't see or edit it)
    sessionParams.phone_number_collection = {
      enabled: false,
    };
    console.log('📱 Phone number will be auto-filled from customer record and is read-only (field hidden)');
  } else if (email) {
    // Fallback: use email if no customer created
    sessionParams.customer_email = email;
    // Enable phone collection if no customer (user can enter phone)
    sessionParams.phone_number_collection = {
      enabled: true,
    };
  } else {
    // Enable phone collection if no customer/email
    sessionParams.phone_number_collection = {
      enabled: true,
    };
  }

  // Add shipping address collection
  sessionParams.shipping_address_collection = {
    allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ'], // Add more countries as needed
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

