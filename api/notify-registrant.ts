import { getSupabaseAdmin } from './admin/db_helper.js';

const FROM_EMAIL = `C3TC Team <${process.env.RESEND_FROM_EMAIL || 'noreply@continent3teens.cc'}>`;
const resendApiKey = process.env.RESEND_API_KEY || '';

export default async function handler(req: any, res: any) {
    // 1. Validate HTTP Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                console.error('Failed to parse req.body as JSON string:', body);
            }
        }

        const record = body?.record ?? body?.new ?? body;
        const old_record = body?.old_record ?? body?.old ?? null;
        const type = body?.type || 'UPDATE';

        if (!record) {
            console.error('Webhook trigger payload missing "record" / "new" object:', body);
            return res.status(400).json({ error: 'Missing webhook payload record' });
        }

        console.log(`Processing webhook event. Type: ${type}, ID: ${record.id}, Payment Status: ${record.payment_status}`);

        const oldStatus = body?.old_record?.payment_status ?? body?.old?.payment_status;
        const newStatus = record?.payment_status;

        if (oldStatus === newStatus) {
            console.log(`No status change, skipping email (old: "${oldStatus}", new: "${newStatus}").`);
            return res.status(200).json({ message: "No status change, skipping email" });
        }

        if (newStatus !== "cleared" && newStatus !== "rejected") {
            console.log(`Status not actionable, skipping email: "${newStatus}"`);
            return res.status(200).json({ message: "Status not actionable, skipping email" });
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
            console.error(`Email dispatch returned false for registrant ${record.id}`);
            return res.status(500).json({ error: 'Failed to send email' });
        }

        // e) Updates notification_sent = true and notification_sent_at = now() on that record after sending
        const { error: updateError } = await getSupabaseAdmin()
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
    const dtceLogoUrl = `${protocol}://${host}/logos/DTCE_Junior_Church_Revised-bg.png`;
    const ltcLogoUrl = `${protocol}://${host}/logos/LTC_Logo_white.png`;
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
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; border-spacing: 0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            <!-- Header Banner -->
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
                    <!-- Dual Logo Table -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-spacing: 0;">
                        <tr>
                            <td style="padding: 0; vertical-align: middle;">
                                <img src="${dtceLogoUrl}" alt="DTCE Junior Church Global" height="55" style="display: block; border: 0; height: 55px; width: auto;" />
                            </td>
                            <td style="width: 5px;"></td>
                            <td style="padding: 0; vertical-align: middle;">
                                <img src="${ltcLogoUrl}" alt="Continent 3 Teens Conference" height="55" style="display: block; border: 0; height: 55px; width: auto;" />
                            </td>
                        </tr>
                    </table>
                    <h3 style="color: #f97316; font-size: 20px; font-weight: 800; margin: 16px 0 0 0; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">T.I.M.E '26</h3>
                </td>
            </tr>

            <!-- Greeting & Message -->
            <tr>
                <td style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
                </td>
            </tr>

            <!-- Hidden space to break Gmail pattern detection -->
            <tr>
                <td style="padding: 0; margin: 0; line-height: 0;">
                    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                        &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
                    </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #0a0f1e; color: #ffffff; padding: 32px 24px; text-align: center; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; max-width: 600px;">
                    <p style="font-size: 15px; font-weight: bold; margin: 0 0 6px 0; color: #ffffff;">See you at T.I.M.E '26!</p>
                    <p style="color: #f97316; font-weight: bold; margin: 0 0 24px 0;">The C3TC Planning Committee</p>
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">This is an automated confirmation email. Please do not reply directly to this email.</p>
                    <a href="https://www.continent3teens.cc" target="_blank" style="color: #ffffff !important; text-decoration: underline; font-weight: 500;">www.continent3teens.cc</a>
                </td>
            </tr>
        </table>
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
    const dtceLogoUrl = `${protocol}://${host}/logos/DTCE_Junior_Church_Revised-bg.png`;
    const ltcLogoUrl = `${protocol}://${host}/logos/LTC_Logo_white.png`;
    const statusUrl = `https://continent3teens.cc/check-status?ref=${batch_reference || ''}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Action Required: C3TC Registration Payment Issue</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #27272a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; border-spacing: 0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            <!-- Header Banner -->
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
                    <!-- Dual Logo Table -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-spacing: 0;">
                        <tr>
                            <td style="padding: 0; vertical-align: middle;">
                                <img src="${dtceLogoUrl}" alt="DTCE Junior Church Global" height="55" style="display: block; border: 0; height: 55px; width: auto;" />
                            </td>
                            <td style="width: 5px;"></td>
                            <td style="padding: 0; vertical-align: middle;">
                                <img src="${ltcLogoUrl}" alt="Continent 3 Teens Conference" height="55" style="display: block; border: 0; height: 55px; width: auto;" />
                            </td>
                        </tr>
                    </table>
                    <h3 style="color: #ef4444; font-size: 20px; font-weight: 800; margin: 16px 0 0 0; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Action Required</h3>
                </td>
            </tr>

            <!-- Greeting & Message -->
            <tr>
                <td style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="font-size: 16px; font-weight: bold; color: #09090b; margin-top: 0; margin-bottom: 12px;">Hi ${full_name},</p>
                    <p style="margin: 0 0 24px 0;">Unfortunately, we were unable to verify your payment for the Continent 3 Teens Conference.</p>

                    <!-- Details block -->
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                        <h4 style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-top: 0; margin-bottom: 16px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Registration Summary</h4>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Reference Code:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #dc2626; font-family: monospace; font-size: 15px;">${batch_reference || '---'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #64748b; font-weight: 500;">Amount Due:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">₦${amountText}</td>
                            </tr>
                        </table>
                    </div>

                    ${rejection_reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0; color: #991b1b; font-size: 14px;">
                        <div style="font-weight: 700; margin-bottom: 6px;">Reason for Rejection:</div>
                        <div>${rejection_reason}</div>
                    </div>
                    ` : ''}

                    <p style="margin: 0 0 24px 0;">If you believe this is an error or have already made payment, please contact our team immediately with your reference code and proof of payment.</p>
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748b;">Contact Details: <a href="mailto:victor.sabo@hotmail.com" style="color: #ef4444; text-decoration: none; font-weight: bold;">victor.sabo@hotmail.com</a> | +234 809 400 7679 (WhatsApp chat only &mdash; no calls)</p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 32px 0 16px 0;">
                        <a href="${statusUrl}" target="_blank" style="display: block; background-color: #ef4444; color: #ffffff !important; font-weight: bold; font-size: 15px; text-decoration: none; padding: 14px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2); text-align: center;">View Your Registration →</a>
                    </div>

                    <p style="margin: 24px 0 0 0;">Best regards,<br><strong>The C3TC Planning Committee</strong></p>
                </td>
            </tr>

            <!-- Hidden space to break Gmail pattern detection -->
            <tr>
                <td style="padding: 0; margin: 0; line-height: 0;">
                    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
                        &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
                    </div>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #0a0f1e; color: #ffffff; padding: 32px 24px; text-align: center; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; max-width: 600px;">
                    <p style="color: #71717a; font-size: 12px; margin: 0; line-height: 1.5;">This is an automated notification email. Please do not reply directly to this email.</p>
                </td>
            </tr>
        </table>
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
        console.log(`Sending email via Resend: to=${to}, subject="${subject}", from=${FROM_EMAIL}`);
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

        const responseText = await response.text();
        console.log(`Resend API HTTP status: ${response.status}`);
        
        let resData: any = {};
        try {
            resData = JSON.parse(responseText);
        } catch (e) {
            console.warn('Failed to parse Resend API response as JSON:', responseText);
        }

        if (response.ok) {
            console.log(`Email successfully dispatched via Resend. ID: ${resData.id || 'unknown'}`);
            return true;
        } else {
            console.error('Resend API returned error response:', {
                status: response.status,
                statusText: response.statusText,
                body: resData || responseText
            });
            return false;
        }
    } catch (error) {
        console.error('Network exception calling Resend API:', error);
        return false;
    }
}
