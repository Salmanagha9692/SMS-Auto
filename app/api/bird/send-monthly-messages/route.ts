import { NextRequest, NextResponse } from 'next/server';
import * as airtableService from '@/app/lib/airtable';
import { PAYMENT_EMAIL_NAME_ALIAS_FIELD } from '@/app/lib/airtable';
import { sendSMSDirect } from '@/app/lib/bird';

/**
 * Monthly Message Delivery
 * 
 * Sends monthly care messages to all active and completed subscribers
 * 
 * GET /api/bird/send-monthly-messages - Send monthly messages to eligible subscribers
 * GET /api/bird/send-monthly-messages?dryRun=true - Preview without sending messages
 * 
 * Eligibility Criteria:
 * - Payment status must be "active" or "completed"
 * - Phone number must exist
 * - Last message from phone number must NOT be "STOP"
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📅 Monthly Message Delivery');
    console.log(`🧪 Dry Run: ${dryRun}`);
    console.log('═══════════════════════════════════════════════════════════');

    // Step 1: Get all active/completed payment records from Payments table (paid + main free tier; Hope tier uses Free Signups only)
    console.log('📋 Step 1: Fetching active and completed payments...');
    const paymentRecords = await airtableService.getActivePayments();
    console.log(`✅ Found ${paymentRecords.length} records (Payments table: paid + main free tier)`);

    if (paymentRecords.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        summary: {
          totalPayments: 0,
          eligible: 0,
          skipped: 0,
          sent: 0,
          errors: 0
        },
        results: []
      });
    }

    // Step 2: Process each payment record
    const results = {
      eligible: 0,
      skipped: 0,
      sent: 0,
      errors: 0,
      details: [] as any[]
    };

    console.log('📋 Step 2: Processing payment records...');

    for (const payment of paymentRecords) {
      try {
        const phoneNumber = payment.fields?.['Phone Number'];
        const status = payment.fields?.['Status'];
        const email = payment.fields?.[PAYMENT_EMAIL_NAME_ALIAS_FIELD] ?? payment.fields?.['Email'];
        const tier = payment.fields?.['Tier'];
        const paymentType = payment.fields?.['Payment Type'];

        // Skip if no phone number
        if (!phoneNumber) {
          console.log(`   ⏩ Skipping payment ${payment.id} - no phone number`);
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: null,
            status,
            reason: 'No phone number'
          });
          continue;
        }

        // Normalize phone number
        const normalizedPhone = phoneNumber.toString().trim();
        const phoneWithPlus = normalizedPhone.startsWith('+') 
          ? normalizedPhone 
          : `+${normalizedPhone}`;

        // Step 3: Check if phone number exists in Phone Numbers table (REQUIRED)
        console.log(`   🔍 Checking if ${phoneWithPlus} exists in Phone Numbers table...`);
        const phoneRecord = await airtableService.findByPhone(phoneWithPlus);
        
        if (!phoneRecord) {
          console.log(`   ⏩ Skipping ${phoneWithPlus} - phone number not found in Phone Numbers table`);
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            reason: 'Phone number not found in Phone Numbers table'
          });
          continue;
        }

        console.log(`   ✅ Phone number ${phoneWithPlus} found in Phone Numbers table`);

        // Step 4: Check if phone number has STOP message
        console.log(`   🔍 Checking ${phoneWithPlus} for STOP message...`);
        const hasStop = await airtableService.hasStopMessage(phoneWithPlus);

        if (hasStop) {
          console.log(`   ⏩ Skipping ${phoneWithPlus} - has STOP message`);
          results.skipped++;
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            reason: 'STOP message found'
          });
          continue;
        }

        // Step 5: Eligible to receive message
        results.eligible++;
        console.log(`   ✅ ${phoneWithPlus} is eligible for monthly message`);

        if (!dryRun) {
          // Step 6: Send monthly message
          try {
            // Get message template from Airtable
            const messages = await airtableService.getMessageTemplates();
            const monthlyMessage = messages.monthlyMessage;
            
            console.log(`   📤 Sending monthly message to ${phoneWithPlus}...`);
            await sendSMSDirect(phoneWithPlus, monthlyMessage);
            
            results.sent++;
            console.log(`   ✅ Message sent successfully to ${phoneWithPlus}`);
            
            results.details.push({
              paymentId: payment.id,
              phoneNumber: phoneWithPlus,
              status,
              email,
              tier,
              paymentType,
              sent: true,
              timestamp: new Date().toISOString()
            });

          } catch (smsError: any) {
            results.errors++;
            console.error(`   ❌ Failed to send message to ${phoneWithPlus}:`, smsError.message);
            
            results.details.push({
              paymentId: payment.id,
              phoneNumber: phoneWithPlus,
              status,
              email,
              tier,
              paymentType,
              sent: false,
              error: smsError.message
            });
          }
        } else {
          // Dry run - just mark as would be sent
          console.log(`   🔍 [DRY RUN] Would send message to ${phoneWithPlus}`);
          results.details.push({
            paymentId: payment.id,
            phoneNumber: phoneWithPlus,
            status,
            email,
            tier,
            paymentType,
            sent: false,
            dryRun: true
          });
        }

      } catch (error: any) {
        results.errors++;
        console.error(`   ❌ Error processing payment ${payment.id}:`, error.message);
        results.details.push({
          paymentId: payment.id,
          error: error.message
        });
      }
    }

    console.log('───────────────────────────────────────────────────────────');
    console.log(`📊 Monthly Message Delivery Results:`);
    console.log(`   📋 Total Payments: ${paymentRecords.length}`);
    console.log(`   ✅ Eligible: ${results.eligible}`);
    console.log(`   ⏩ Skipped: ${results.skipped}`);
    if (!dryRun) {
      console.log(`   📤 Sent: ${results.sent}`);
      console.log(`   ❌ Errors: ${results.errors}`);
    } else {
      console.log(`   🔍 [DRY RUN] Would send: ${results.eligible}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalPayments: paymentRecords.length,
        eligible: results.eligible,
        skipped: results.skipped,
        sent: dryRun ? 0 : results.sent,
        errors: results.errors
      },
      results: results.details
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Error in monthly message delivery:', error.message);
    console.error('═══════════════════════════════════════════════════════════\n');
    
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

