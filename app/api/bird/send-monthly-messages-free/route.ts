import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';
import { sendSMSDirect } from '@/app/lib/bird';

/**
 * Monthly Message Delivery — Free Tier Only
 *
 * Sends the free-tier monthly care message to subscribers with Tier = "free"
 * and status "active" or "completed". Uses Free Content message template.
 *
 * GET /api/bird/send-monthly-messages-free
 * GET /api/bird/send-monthly-messages-free?dryRun=true
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📅 Monthly Message Delivery — Free Tier Only');
    console.log(`🧪 Dry Run: ${dryRun}`);
    console.log('═══════════════════════════════════════════════════════════');

    const paymentRecords = await airtableService.getActivePayments();
    const freePayments = (paymentRecords || []).filter(
      (p: any) => (p.fields?.['Tier'] || '').toString().toLowerCase() === 'free'
    );
    console.log(`✅ Found ${freePayments.length} free-tier payments (of ${paymentRecords.length} total active/completed)`);

    if (freePayments.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        summary: {
          totalFree: 0,
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

    for (const payment of freePayments) {
      try {
        const phoneNumber = payment.fields?.['Phone Number'];
        const status = payment.fields?.['Status'];
        const email = payment.fields?.['Email'];

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
        totalFree: freePayments.length,
        eligible: results.eligible,
        skipped: results.skipped,
        sent: dryRun ? 0 : results.sent,
        errors: results.errors,
      },
      results: results.details,
    });
  } catch (error: any) {
    console.error('Error in free-tier monthly message delivery:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
