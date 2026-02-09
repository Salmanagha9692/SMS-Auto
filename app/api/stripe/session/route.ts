import { NextRequest, NextResponse } from 'next/server';
import { getCheckoutSession } from '@/app/lib/stripe';

/**
 * Get Stripe Checkout Session details
 * GET /api/stripe/session?session_id=cs_xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    // Retrieve session from Stripe
    const session = await getCheckoutSession(sessionId);

    // Extract relevant information
    const metadata = session.metadata || {};
    const tier = metadata.tier || 'unknown';
    const paymentType = metadata.paymentType || 'one-time';
    const amount = session.amount_total ? session.amount_total / 100 : 0;
    const email = session.customer_details?.email;
    const phone = session.customer_details?.phone;

    return NextResponse.json({
      tier,
      amount,
      paymentType,
      email,
      phone,
      status: session.payment_status,
    });

  } catch (error: any) {
    console.error('Error retrieving session:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session details' },
      { status: 500 }
    );
  }
}

