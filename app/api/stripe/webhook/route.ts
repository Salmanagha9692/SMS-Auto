import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/app/lib/stripe';
import * as airtableService from '@/app/lib/airtable';
import { sendSMS, sendSMSDirect } from '@/app/lib/bird';
import Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 * 
 * Handles Stripe webhook events:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = verifyWebhookSignature(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('📨 Stripe webhook event received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('✅ Checkout session completed:', session.id);

  try {
    const metadata = session.metadata || {};
    const tier = metadata.tier || 'unknown';
    const paymentType = metadata.paymentType as 'one-time' | 'monthly' || 'one-time';
    
    // Extract phone number - prioritize customer_details (from Stripe Checkout) over metadata
    // customer_details.phone is more reliable as it's collected during checkout
    const phoneNumber = session.customer_details?.phone || 
                       (metadata.phoneNumber && metadata.phoneNumber.trim() ? metadata.phoneNumber : undefined);

    // Extract customer information
    const email = session.customer_details?.email || undefined;
    const customerId = session.customer as string || undefined;
    const subscriptionId = session.subscription as string || undefined;
    const paymentIntentId = session.payment_intent as string || undefined;
    const amount = session.amount_total ? session.amount_total / 100 : 0;

    // Extract shipping address information
    const shipping = (session as any).shipping;
    const shippingAddress = shipping?.address;
    const name = shipping?.name || undefined;
    const addressLine1 = shippingAddress?.line1 || undefined;
    const addressLine2 = shippingAddress?.line2 || undefined;
    const city = shippingAddress?.city || undefined;
    const state = shippingAddress?.state || undefined;
    const postalCode = shippingAddress?.postal_code || undefined;
    const country = shippingAddress?.country || undefined;

    // Find existing payment record by session ID
    const existingRecord = await airtableService.findPaymentBySessionId(session.id);

    if (existingRecord) {
      // Update existing record
      console.log('Updating existing payment record:', existingRecord.id);
      await airtableService.updatePaymentRecord(existingRecord.id, {
        email,
        phoneNumber,
        name,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePaymentIntentId: paymentIntentId,
        status: paymentType === 'monthly' ? 'active' : 'completed',
      });
    } else {
      // Create new record
      console.log('Creating new payment record');
      await airtableService.createPaymentRecord({
        email,
        phoneNumber,
        name,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country,
        tier,
        amount,
        paymentType,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripePaymentIntentId: paymentIntentId,
        stripeSessionId: session.id,
        status: paymentType === 'monthly' ? 'active' : 'completed',
      });
    }

    console.log('✅ Payment record saved to Airtable');

    // Send welcome message if phone number is available
    if (phoneNumber) {
      try {
        // Get message template from Airtable
        const messages = await airtableService.getMessageTemplates();
        const welcomeMessage = messages.welcomeMessage;
        
        console.log(`📱 Sending welcome message to ${phoneNumber}`);
        // Use direct method as primary (matches curl format)
        await sendSMSDirect(phoneNumber, welcomeMessage);
        console.log('✅ Welcome message sent successfully');
      } catch (smsError: any) {
        // Log error but don't fail the webhook - payment is already processed
        console.error('⚠️  Failed to send welcome message:', smsError.message);
        
        // Try alternative conversation method
        try {
          console.log('🔄 Trying alternative SMS sending method...');
          const messages = await airtableService.getMessageTemplates();
          await sendSMS(phoneNumber, messages.welcomeMessage);
          console.log('✅ Welcome message sent successfully (alternative method)');
        } catch (retryError: any) {
          console.error('❌ Failed to send welcome message (both methods):', retryError.message);
        }
      }
    } else {
      console.log('⚠️  No phone number available, skipping welcome message');
    }

  } catch (error) {
    console.error('Error handling checkout session completed:', error);
    throw error;
  }
}

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🆕 Subscription created:', subscription.id);

  try {
    const customerId = subscription.customer as string;
    const existingRecord = await airtableService.findPaymentByCustomerId(customerId);

    if (existingRecord) {
      await airtableService.updatePaymentRecord(existingRecord.id, {
        stripeSubscriptionId: subscription.id,
        status: subscription.status === 'active' ? 'active' : 'pending',
      });
      console.log('✅ Updated payment record with subscription ID');
    }
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  try {
    const existingRecord = await airtableService.findPaymentBySubscriptionId(subscription.id);

    if (existingRecord) {
      let status = 'active';
      if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        status = 'cancelled';
      } else if (subscription.status === 'past_due') {
        status = 'failed';
      } else if (subscription.status === 'active') {
        status = 'active';
      }

      await airtableService.updatePaymentRecord(existingRecord.id, {
        status,
      });
      console.log('✅ Updated subscription status:', status);
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('❌ Subscription deleted:', subscription.id);

  try {
    const existingRecord = await airtableService.findPaymentBySubscriptionId(subscription.id);

    if (existingRecord) {
      await airtableService.updatePaymentRecord(existingRecord.id, {
        status: 'cancelled',
      });
      console.log('✅ Marked subscription as cancelled');
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

/**
 * Handle invoice.payment_succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💰 Invoice payment succeeded:', invoice.id);

  try {
    // subscription can be a string ID or a Subscription object
    // Using type assertion to access subscription property
    const subscription = (invoice as any).subscription;
    const subscriptionId = typeof subscription === 'string' 
      ? subscription 
      : subscription?.id;
    
    if (!subscriptionId) return;

    const existingRecord = await airtableService.findPaymentBySubscriptionId(subscriptionId);

    if (existingRecord) {
      await airtableService.updatePaymentRecord(existingRecord.id, {
        status: 'active',
      });
      console.log('✅ Updated subscription payment status');
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('❌ Invoice payment failed:', invoice.id);

  try {
    // subscription can be a string ID or a Subscription object
    // Using type assertion to access subscription property
    const subscription = (invoice as any).subscription;
    const subscriptionId = typeof subscription === 'string' 
      ? subscription 
      : subscription?.id;
    
    if (!subscriptionId) return;

    const existingRecord = await airtableService.findPaymentBySubscriptionId(subscriptionId);

    if (existingRecord) {
      await airtableService.updatePaymentRecord(existingRecord.id, {
        status: 'failed',
      });
      console.log('✅ Updated subscription payment status to failed');
    }
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

