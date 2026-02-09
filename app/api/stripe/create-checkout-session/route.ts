import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/app/lib/stripe';
import * as airtableService from '@/app/lib/airtable';

/**
 * Create Stripe Checkout Session
 * POST /api/stripe/create-checkout-session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tier, customAmount, paymentType, email, phoneNumber } = body;

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

    // For free tier, skip Stripe and directly save to Airtable
    if (tier === 'free') {
      try {
        await airtableService.createPaymentRecord({
          email,
          phoneNumber,
          tier: 'free',
          amount: 0,
          paymentType,
          status: 'completed',
        });

        // Redirect to success page with free tier info
        const successUrl = `${request.nextUrl.origin}/success?tier=free&amount=0`;
        return NextResponse.json({ url: successUrl });
      } catch (error: any) {
        console.error('Error creating free tier record:', error);
        return NextResponse.json(
          { error: 'Failed to process free tier signup' },
          { status: 500 }
        );
      }
    }

    // Get the base URL
    const baseUrl = request.nextUrl.origin;
    const successUrl = `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/cancel`;

    console.log('Creating Stripe checkout session:', {
      tier,
      amount,
      paymentType,
      email,
      phoneNumber,
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

