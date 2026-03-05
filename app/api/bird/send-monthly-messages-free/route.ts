import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';
import { PAYMENT_EMAIL_NAME_ALIAS_FIELD } from '@/app/lib/airtable';
import { sendSMSDirect } from '@/app/lib/bird';

/**
 * Monthly Message Delivery — Hope Tier Only (separate from paid campaigns)
 *
 * Sends the monthly care message to all Hope-tier signups only. Reads from
 * Free Signups table only (no data from Payments table). Hope = signup via HOPE link.
 *
 * GET /api/bird/send-monthly-messages-free
 * GET /api/bird/send-monthly-messages-free?dryRun=true
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📅 Monthly Message Delivery — Hope Tier Only');
    console.log(`🧪 Dry Run: ${dryRun}`);
    console.log('═══════════════════════════════════════════════════════════');

    const hopeSignups = await airtableService.getActiveFreePayments();
    console.log(`✅ Found ${hopeSignups.length} Hope-tier signups (Free Signups table only)`);

    if (hopeSignups.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        summary: {
          totalHopeTier: 0,
          eligible: 0,
          skipped: 0,
          sent: 0,
          errors: 0,
        },
        results: [],
      });
    }

    const results = {
      eligible: 0,
      skipped: 0,
      sent: 0,
      errors: 0,
      details: [] as any[],
    };

    const messages = await airtableService.getFreeMessageTemplates();
    const monthlyMessage = messages.monthlyMessage || '';

    for (const payment of hopeSignups) {
      try {
        const phoneNumber = payment.fields?.['Phone Number'];
        const status = payment.fields?.['Status'];
        const email = payment.fields?.[PAYMENT_EMAIL_NAME_ALIAS_FIELD];

        if (!phoneNumber) {
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: null,
            status,
            reason: 'No phone number',
          });
          continue;
        }

        const normalizedPhone = phoneNumber.toString().trim();
        const phoneWithPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;

        const phoneRecord = await airtableService.findByPhone(phoneWithPlus);
        if (!phoneRecord) {
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            reason: 'Phone number not found in Phone Numbers table',
          });
          continue;
        }

        const hasStop = await airtableService.hasStopMessage(phoneWithPlus);
        if (hasStop) {
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            reason: 'STOP message found',
          });
          continue;
        }

        results.eligible++;

        if (!dryRun && monthlyMessage) {
          try {
            await sendSMSDirect(phoneWithPlus, monthlyMessage);
            results.sent++;
            results.details.push({
              paymentId: payment.id,
              phoneNumber: phoneWithPlus,
              status,
              email,
              sent: true,
              timestamp: new Date().toISOString(),
            });
          } catch (smsError: any) {
            results.errors++;
            results.details.push({
              paymentId: payment.id,
              phoneNumber: phoneWithPlus,
              status,
              email,
              sent: false,
              error: smsError.message,
            });
          }
        } else if (dryRun) {
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            email,
            sent: false,
            dryRun: true,
          });
        }
      } catch (err: any) {
        results.errors++;
        results.details.push({ paymentId: payment.id, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalHopeTier: hopeSignups.length,
        eligible: results.eligible,
        skipped: results.skipped,
        sent: dryRun ? 0 : results.sent,
        errors: results.errors,
      },
      results: results.details,
    });
  } catch (error: any) {
    console.error('Error in Hope-tier monthly message delivery:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
