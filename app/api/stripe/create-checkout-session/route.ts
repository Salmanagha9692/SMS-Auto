import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/app/lib/stripe';
import * as airtableService from '@/app/lib/airtable';
import { sendSMS, sendSMSDirect, sendSMSSequence } from '@/app/lib/bird';

/**
 * Get the base URL, checking for ngrok or forwarded host headers
 */
function getBaseUrl(request: NextRequest): string {
  // Check for NGROK_URL environment variable first (highest priority)
  if (process.env.NGROK_URL) {
    return process.env.NGROK_URL;
  }

  // Check for forwarded host (ngrok, reverse proxy, etc.)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Check the host header if it's not localhost
  const host = request.headers.get('host');
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const protocol = request.nextUrl.protocol === 'https:' ? 'https' : 'http';
    return `${protocol}://${host}`;
  }

  // Fallback to request origin
  return request.nextUrl.origin;
}

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout-session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier, customAmount, paymentType, email, phoneNumber, signupSource } = body;
    // signupSource: 'hope' = HOPE link (/free page) → Free Signups table + Hope content. Omitted or 'main' = main site free tier → Payments table + main content.
    const isHopeSignup = tier === 'free' && signupSource === 'hope';

    // Validate required fields
    if (!tier || !paymentType) {
      return NextResponse.json(
        { error: 'Missing required fields: tier, paymentType' },
        { status: 400 }
      );
    }

    // Calculate amount based on tier
    let amount = 0;
    if (tier === 'free') {
      amount = 0;
    } else if (tier === 'custom') {
      amount = parseFloat(customAmount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'Invalid custom amount' },
          { status: 400 }
        );
      }
    } else {
      amount = parseFloat(tier);
      if (isNaN(amount)) {
        return NextResponse.json(
          { error: 'Invalid tier amount' },
          { status: 400 }
        );
      }
    }

    // Free tier: two separate flows — Hope link (separate table + Hope content) vs main site free (Payments + main content)
    if (tier === 'free') {
      try {
        if (isHopeSignup) {
          // HOPE link signup: save to Free Signups table only; use Hope (Free Content) templates
          await airtableService.createFreePaymentRecord({
            email,
            phoneNumber,
            status: 'completed',
          });
          if (phoneNumber) {
            try {
              const messages = await airtableService.getFreeMessageTemplates();
              const welcomeMessages = [
                messages.welcomeMessage1,
                messages.welcomeMessage2,
                messages.welcomeMessage3,
                messages.welcomeMessage4
              ].filter(msg => msg && msg.trim());
              if (welcomeMessages.length > 0) {
                console.log(`📱 [Hope] Sending ${welcomeMessages.length} welcome messages to ${phoneNumber}`);
                await sendSMSSequence(phoneNumber, welcomeMessages, 2000);
              }
            } catch (smsError: any) {
              console.error('⚠️  Failed to send Hope welcome sequence:', smsError.message);
            }
          }
        } else {
          // Main site free tier: save to Payments table; use main message templates
          await airtableService.createPaymentRecord({
            email,
            phoneNumber,
            tier: 'free',
            amount: 0,
            paymentType,
            status: 'completed',
          });
          if (phoneNumber) {
            try {
              const messages = await airtableService.getMessageTemplates();
              const welcomeMessages = [
                messages.welcomeMessage1,
                messages.welcomeMessage2,
                messages.welcomeMessage3,
                messages.welcomeMessage4
              ].filter(msg => msg && msg.trim());
              if (welcomeMessages.length > 0) {
                console.log(`📱 [Main free] Sending ${welcomeMessages.length} welcome messages to ${phoneNumber}`);
                await sendSMSSequence(phoneNumber, welcomeMessages, 2000);
              }
            } catch (smsError: any) {
              console.error('⚠️  Failed to send main free welcome sequence:', smsError.message);
            }
          }
        }

        const baseUrl = getBaseUrl(request);
        const successUrl = `${baseUrl}/success?tier=free&amount=0`;
        return NextResponse.json({ url: successUrl });
      } catch (error: any) {
        console.error('Error creating free tier record:', error);
        return NextResponse.json(
          { error: 'Failed to process free tier signup' },
          { status: 500 }
        );
      }
    }

    // Get the base URL - check for ngrok or forwarded host
    const baseUrl = getBaseUrl(request);
    const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cancel`;

    console.log('Creating Stripe checkout session:', {
      tier,
      amount,
      paymentType,
      email,
      phoneNumber,
      baseUrl, // Log the base URL being used
    });

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      tier,
      amount,
      paymentType,
      email,
      phoneNumber,
      successUrl,
      cancelUrl,
    });

    console.log('Stripe session created:', session.id);

    // Save pending payment record to Airtable
    try {
      await airtableService.createPaymentRecord({
        email,
        phoneNumber,
        tier,
        amount,
        paymentType,
        stripeSessionId: session.id,
        stripeCustomerId: session.customer as string | undefined,
        status: 'pending',
      });
      console.log('Payment record created in Airtable');
    } catch (error) {
      console.error('Error saving to Airtable:', error);
      // Continue anyway - webhook will handle it
    }

    // Return the checkout URL
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

