import { createClient } from '@supabase/supabase-js';

// Configuration placeholders (User can adjust FROM_EMAIL as needed)
const FROM_EMAIL = `C3TC Team <${process.env.RESEND_FROM_EMAIL || 'noreply@continent3teens.cc'}>`;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const resendApiKey = process.env.RESEND_API_KEY || '';

// Create a Supabase Client using the Service Role Key (preferred) or Anon Key
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
    // 1. Validate HTTP Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { record, old_record, type } = req.body;

        if (!record) {
            console.error('Webhook trigger payload missing "record" object:', req.body);
            return res.status(400).json({ error: 'Missing webhook payload record' });
        }

        console.log(`Processing webhook event. Type: ${type}, ID: ${record.id}, Payment Status: ${record.payment_status}`);

        // a) Checks if payment_status changed to 'cleared' or 'rejected'
        const newStatus = record.payment_status;
        const oldStatus = old_record?.payment_status;

        if (newStatus !== 'cleared' && newStatus !== 'rejected') {
            return res.status(200).json({ message: 'No action: payment_status is not cleared or rejected' });
        }

        if (oldStatus === newStatus) {
            return res.status(200).json({ message: 'No action: payment_status did not change' });
        }

        // b) Checks that the registrant has an email address (skip silently if not)
        const email = record.email;
        if (!email || !email.trim()) {
            console.log(`Registrant ${record.id} has no email address. Skipping silently.`);
            return res.status(200).json({ message: 'No action: Registrant has no email address' });
        }

        // c) Checks that notification_sent is not already true (to prevent duplicate emails)
        if (record.notification_sent === true) {
            console.log(`Notification already sent for registrant ${record.id}. Skipping to prevent duplicate.`);
            return res.status(200).json({ message: 'No action: Notification already sent' });
        }

        // Retrieve requesting host to construct dynamic status urls
        const host = req.headers.host || 'ltc-3-0.vercel.app';

        // d) Sends the appropriate email via Resend
        let emailSent = false;
        if (newStatus === 'cleared') {
            emailSent = await sendApprovalEmail(record, host);
        } else if (newStatus === 'rejected') {
            emailSent = await sendRejectionEmail(record, host);
        }

        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send email' });
        }

        // e) Updates notification_sent = true and notification_sent_at = now() on that record after sending
        const { error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({
                notification_sent: true,
                notification_sent_at: new Date().toISOString()
            })
            .eq('id', record.id);

        if (updateError) {
            console.error('Error updating notification status in Supabase:', updateError);
            return res.status(500).json({ error: 'Email sent but failed to update Supabase status' });
        }

        console.log(`Successfully completed notification flow for registrant ${record.id}`);
        return res.status(200).json({ success: true, message: `Notification sent successfully to ${email}` });

    } catch (err: any) {
        console.error('API /notify-registrant Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}

// -------------------------------------------------------------
// Approval Email Construction
// -------------------------------------------------------------
async function sendApprovalEmail(record: any, host: string): Promise<boolean> {
    const { full_name, email, batch_reference, category, amount_due, qr_code_hash } = record;
    const formattedCategory = category === 'teenager' ? 'Teenager' : 'Teacher / Adult';
    const amountPaid = amount_due ? amount_due.toLocaleString() : '---';

    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const logoUrl = `${protocol}://${host}/logos/LTC_Logo_white.png`;
    const statusUrl = `https://continent3teens.cc/check-status?ref=${batch_reference || ''}`;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr_code_hash || '')}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>You're In! Your C3TC '26 Registration is Confirmed ✅</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #27272a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            
            <!-- Header Banner -->
            <div style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
                <img src="${logoUrl}" alt="C3TC Logo" style="height: 80px; width: auto; display: block; margin: 0 auto 16px auto;" />
                <h2 style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: 1px;">CONTINENT 3 TEENS CONFERENCE</h2>
                <h3 style="color: #f97316; font-size: 20px; font-weight: 800; margin: 0; letter-spacing: 0.5px;">T.I.M.E '26</h3>
            </div>

            <!-- Greeting & Message -->
            <div style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6;">
                <p style="font-size: 16px; font-weight: bold; color: #09090b; margin-top: 0; margin-bottom: 12px;">Hi ${full_name},</p>
                <p style="margin: 0 0 24px 0;">Great news! Your payment has been verified and your registration for the Continent 3 Teens Conference is now confirmed. We can't wait to see you at T.I.M.E '26!</p>

                <!-- QR Code Block -->
                <div style="text-align: center; margin: 32px 0;">
                    <div style="background-color: #ffffff; padding: 12px; border: 1px solid #e4e4e7; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                        <img src="${qrCodeUrl}" alt="Check-In QR Code" style="width: 200px; height: 200px; display: block;" />
                    </div>
                    <p style="font-size: 12px; color: #71717a; margin: 8px 0 0 0; font-weight: 500;">Show this QR code at the venue for express check-in</p>
                </div>

                <!-- Event details block -->
                <div style="background-color: #f8f8f8; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Reference Code:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #f97316; font-family: monospace; font-size: 15px;">${batch_reference || '---'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Category:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${formattedCategory}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Amount Paid:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">₦${amountPaid}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Event:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">Continent 3 Teens Conference — T.I.M.E</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Date:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">Saturday, 19th September, 2026</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #71717a; font-weight: 500; vertical-align: top;">Venue:</td>
                            <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a; max-width: 250px;">Glory Arena, Redemption City of God, Ogun State</td>
                        </tr>
                    </table>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0 16px 0;">
                    <a href="${statusUrl}" target="_blank" style="display: block; background-color: #f97316; color: #ffffff !important; font-weight: bold; font-size: 15px; text-decoration: none; padding: 14px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2); text-align: center;">View Your Registration Status →</a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #0a0f1e; color: #ffffff; padding: 32px 24px; text-align: center; font-size: 13px;">
                <p style="font-size: 15px; font-weight: bold; margin: 0 0 6px 0; color: #ffffff;">See you at T.I.M.E '26!</p>
                <p style="color: #f97316; font-weight: bold; margin: 0 0 24px 0;">The C3TC Planning Committee</p>
                <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">This is an automated confirmation email. Please do not reply directly to this email.</p>
                <a href="https://continent3teens.cc" target="_blank" style="color: #ffffff !important; text-decoration: underline; font-weight: 500;">continent3teens.cc</a>
            </div>

        </div>
    </body>
    </html>
    `;

    return sendResendEmail(email, "You're In! Your C3TC '26 Registration is Confirmed ✅", htmlContent);
}

// -------------------------------------------------------------
// Rejection Email Construction
// -------------------------------------------------------------
async function sendRejectionEmail(record: any, host: string): Promise<boolean> {
    const { full_name, email, batch_reference, amount_due, rejection_reason } = record;
    const amountText = amount_due ? amount_due.toLocaleString() : '---';

    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const statusUrl = `${protocol}://${host}/check-status?ref=${batch_reference || ''}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Action Required: C3TC Registration Payment Issue</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #27272a; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }
            .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; padding: 40px 32px; text-align: center; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
            .content { padding: 32px; line-height: 1.6; font-size: 15px; }
            .greeting { font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #09090b; }
            .details-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; }
            .details-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 0; margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; letter-spacing: 0.5px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
            .detail-row:last-child { margin-bottom: 0; }
            .detail-label { color: #64748b; font-weight: 500; }
            .detail-value { font-weight: 700; color: #0f172a; text-align: right; }
            .detail-value.mono { font-family: monospace; font-size: 15px; color: #dc2626; }
            .reason-box { background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0; color: #991b1b; font-size: 14px; }
            .reason-title { font-weight: 700; margin-bottom: 6px; }
            .button-container { text-align: center; margin: 32px 0; }
            .btn { display: inline-block; background-color: #ef4444; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); transition: all 0.2s; }
            .footer { background-color: #f4f4f5; color: #71717a; text-align: center; padding: 24px; font-size: 12px; border-top: 1px solid #e4e4e7; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>C3TC 3.0</h1>
            </div>
            <div class="content">
                <p class="greeting">Hi ${full_name},</p>
                <p>Unfortunately, we were unable to verify your payment for the Continent 3 Teens Conference.</p>
                
                <div class="details-card">
                    <h3 class="details-title">Registration Summary</h3>
                    <div class="detail-row">
                        <span class="detail-label">Reference Code:</span>
                        <span class="detail-value mono">${batch_reference || '---'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Amount Due:</span>
                        <span class="detail-value">₦${amountText}</span>
                    </div>
                </div>

                ${rejection_reason ? `
                <div class="reason-box">
                    <div class="reason-title">Reason for Rejection:</div>
                    <div>${rejection_reason}</div>
                </div>
                ` : ''}
                
                <p>If you believe this is an error or have already made payment, please contact our team immediately with your reference code and proof of payment.</p>
                
                <p>Contact Details: support@c3tc.org | +234 800 000 0000</p>
                
                <div class="button-container">
                    <a href="${statusUrl}" target="_blank" class="btn">View Your Registration →</a>
                </div>
                
                <p>Best regards,<br><strong>The C3TC Planning Committee</strong></p>
            </div>
            <div class="footer">
                This is an automated notification email. Please do not reply directly to this email.
            </div>
        </div>
    </body>
    </html>
    `;

    return sendResendEmail(email, 'Action Required: C3TC Registration Payment Issue', htmlContent);
}

// -------------------------------------------------------------
// Resend HTTP API Client
// -------------------------------------------------------------
async function sendResendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    if (!resendApiKey) {
        console.error('Error: RESEND_API_KEY is not defined in the environment variables.');
        return false;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: to,
                subject: subject,
                html: htmlContent
            })
        });

        const resData = await response.json();
        if (response.ok) {
            console.log(`Email successfully dispatched via Resend. ID: ${resData.id}`);
            return true;
        } else {
            console.error('Resend API returned error response:', resData);
            return false;
        }
    } catch (error) {
        console.error('Network exception calling Resend API:', error);
        return false;
    }
}
