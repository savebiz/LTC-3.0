import { getSupabaseAdmin } from './admin/db_helper.js';

const FROM_EMAIL = `C3TC Team <${process.env.RESEND_FROM_EMAIL || 'noreply@continent3teens.cc'}>`;
const resendApiKey = process.env.RESEND_API_KEY || '';

export default async function handler(req: any, res: any) {
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

        const adminKeyHeader = req.headers['x-admin-key'] || '';
        const expectedSecret = process.env.ADMIN_SECRET || process.env.ADMIN_KEY || 'C3TC@admin2026';

        if (adminKeyHeader !== expectedSecret) {
            console.warn('Unauthorized volunteer notification attempt - key mismatch');
            return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin secret key' });
        }

        const record = body?.record ?? body?.new ?? body;
        const old_record = body?.old_record ?? body?.old ?? null;
        const type = body?.type || 'UPDATE';

        if (!record) {
            console.error('Webhook trigger payload missing "record" / "new" object:', body);
            return res.status(400).json({ error: 'Missing webhook payload record' });
        }

        console.log(`Processing volunteer webhook event. Type: ${type}, ID: ${record.id}, Status: ${record.status}`);

        const oldStatus = body?.old_record?.status ?? body?.old?.status;
        const newStatus = record?.status;

        if (oldStatus === newStatus) {
            console.log(`No status change, skipping email (old: "${oldStatus}", new: "${newStatus}").`);
            return res.status(200).json({ message: "No status change, skipping email" });
        }

        if (newStatus !== "confirmed" && newStatus !== "rejected") {
            console.log(`Status not actionable, skipping email: "${newStatus}"`);
            return res.status(200).json({ message: "Status not actionable, skipping email" });
        }

        const email = record.email;
        if (!email || !email.trim()) {
            console.log(`Volunteer ${record.id} has no email address. Skipping silently.`);
            return res.status(200).json({ message: 'No action: Volunteer has no email address' });
        }

        if (record.notification_sent === true) {
            console.log(`Notification already sent for volunteer ${record.id}. Skipping to prevent duplicate.`);
            return res.status(200).json({ message: 'No action: Notification already sent' });
        }

        const host = req.headers.host || 'ltc-3-0.vercel.app';

        let emailSent = false;
        if (newStatus === 'confirmed') {
            emailSent = await sendApprovalEmail(record, host);
        } else if (newStatus === 'rejected') {
            emailSent = await sendRejectionEmail(record, host);
        }

        if (!emailSent) {
            return res.status(500).json({ error: 'Failed to send email' });
        }

        const { error: updateError } = await getSupabaseAdmin()
            .from('volunteers')
            .update({
                notification_sent: true,
                notification_sent_at: new Date().toISOString()
            })
            .eq('id', record.id);

        if (updateError) {
            console.error('Error updating notification status in Supabase:', updateError);
            return res.status(500).json({ error: 'Email sent but failed to update Supabase status' });
        }

        console.log(`Successfully completed notification flow for volunteer ${record.id}`);
        return res.status(200).json({ success: true, message: `Notification sent successfully to ${email}` });

    } catch (err: any) {
        console.error('API /api/notify-volunteer Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}

async function sendApprovalEmail(record: any, host: string): Promise<boolean> {
    const { full_name, email, role, department, region } = record;

    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const dtceLogoUrl = `${protocol}://${host}/logos/DTCE_Junior_Church_Revised-bg.png`;
    const ltcLogoUrl = `${protocol}://${host}/logos/LTC_Logo_white.png`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your C3TC Volunteer Application is Approved! 🎉</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #27272a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; border-spacing: 0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            <!-- Header Banner -->
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
                    <!-- Dual Logo Table -->
                    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-spacing: 0;">
                        <tr>
                            <td style="vertical-align: middle; padding: 0;">
                                <img src="${dtceLogoUrl}" alt="DTCE Junior Church Global" style="height: 50px; width: auto; display: block; border: 0;" />
                            </td>
                            <td style="vertical-align: middle; padding: 0 32px;">
                                &nbsp;
                            </td>
                            <td style="vertical-align: middle; padding: 0;">
                                <img src="${ltcLogoUrl}" alt="Continent 3 Teens Conference" style="height: 50px; width: auto; display: block; border: 0;" />
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
                    <p style="margin: 0 0 24px 0;">Great news! Your application to join the Continent 3 Teens Conference Volunteer Force has been reviewed and approved. Welcome to the team!</p>

                    <!-- Details block -->
                    <div style="background-color: #f8f8f8; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Name:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${full_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Role:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a; capitalize">${role || 'Volunteer'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Department:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${department || '---'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Region:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${region || '---'}</td>
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

                    <p style="margin: 24px 0 0 0;">Our team will be in touch with further details about your volunteer duties and reporting time. Please save this email for reference.</p>
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
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">This is an automated notification. Please do not reply directly to this email.</p>
                    <a href="https://continent3teens.cc" target="_blank" style="color: #ffffff !important; text-decoration: underline; font-weight: 500;">continent3teens.cc</a>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendResendEmail(email, "Your C3TC Volunteer Application is Approved! 🎉", htmlContent);
}

async function sendRejectionEmail(record: any, host: string): Promise<boolean> {
    const { full_name, email, rejection_reason } = record;

    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const dtceLogoUrl = `${protocol}://${host}/logos/DTCE_Junior_Church_Revised-bg.png`;
    const ltcLogoUrl = `${protocol}://${host}/logos/LTC_Logo_white.png`;
    const ctaUrl = 'https://continent3teens.cc';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Update on Your C3TC Volunteer Application</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #27272a; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; border-spacing: 0; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
            <!-- Header Banner -->
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
                    <!-- Dual Logo Table -->
                    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto; border-spacing: 0;">
                        <tr>
                            <td style="vertical-align: middle; padding: 0;">
                                <img src="${dtceLogoUrl}" alt="DTCE Junior Church Global" style="height: 50px; width: auto; display: block; border: 0;" />
                            </td>
                            <td style="vertical-align: middle; padding: 0 32px;">
                                &nbsp;
                            </td>
                            <td style="vertical-align: middle; padding: 0;">
                                <img src="${ltcLogoUrl}" alt="Continent 3 Teens Conference" style="height: 50px; width: auto; display: block; border: 0;" />
                            </td>
                        </tr>
                    </table>
                    <h3 style="color: #ef4444; font-size: 20px; font-weight: 800; margin: 16px 0 0 0; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Update on Application</h3>
                </td>
            </tr>

            <!-- Greeting & Message -->
            <tr>
                <td style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="font-size: 16px; font-weight: bold; color: #09090b; margin-top: 0; margin-bottom: 12px;">Hi ${full_name},</p>
                    <p style="margin: 0 0 24px 0;">Thank you for your interest in volunteering at the Continent 3 Teens Conference. After careful review, we are unable to accommodate your application at this time.</p>

                    <!-- Rejection Reason if provided -->
                    ${rejection_reason ? `
                    <div style="background-color: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 20px 0; color: #991b1b; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                        <div style="font-weight: 700; margin-bottom: 6px;">Reason:</div>
                        <div>${rejection_reason}</div>
                    </div>
                    ` : ''}

                    <p style="margin: 0 0 24px 0;">We appreciate your willingness to serve and encourage you to register as a delegate and join us at T.I.M.E '26!</p>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 32px 0 16px 0;">
                        <a href="${ctaUrl}" target="_blank" style="display: block; background-color: #f97316; color: #ffffff !important; font-weight: bold; font-size: 15px; text-decoration: none; padding: 14px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2); text-align: center;">Register as a Delegate →</a>
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
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0; line-height: 1.5;">This is an automated notification. Please do not reply directly to this email.</p>
                    <a href="https://continent3teens.cc" target="_blank" style="color: #ffffff !important; text-decoration: underline; font-weight: 500;">continent3teens.cc</a>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    return sendResendEmail(email, 'Update on Your C3TC Volunteer Application', htmlContent);
}

async function sendResendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    if (!resendApiKey) {
        console.error('Error: RESEND_API_KEY is not defined in the environment variables.');
        return false;
    }

    try {
        console.log(`Sending volunteer email via Resend: to=${to}, subject="${subject}", from=${FROM_EMAIL}`);
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
