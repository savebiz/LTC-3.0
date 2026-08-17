import { getSupabaseAdmin } from './db_helper.js';

const FROM_EMAIL = `C3TC Team <${process.env.RESEND_FROM_EMAIL || 'noreply@continent3teens.cc'}>`;
const resendApiKey = process.env.RESEND_API_KEY || '';

function parseCookies(req: any) {
    const list: Record<string, string> = {};
    const rc = req.headers.cookie;

    if (rc) {
        rc.split(';').forEach((cookie: string) => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                list[parts.shift()!.trim()] = decodeURI(parts.join('='));
            }
        });
    }

    return list;
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!resendApiKey) {
        console.error('RESEND_API_KEY is not set in environment variables');
        return false;
    }
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: [to],
                subject,
                html
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('Resend API error:', response.status, errBody);
            return false;
        }

        const resData = await response.json();
        console.log(`Resend Email API Success (${subject} -> ${to}):`, resData);
        return true;
    } catch (err) {
        console.error('Resend Exception:', err);
        return false;
    }
}

async function sendDelegateApprovalEmail(record: any, host: string): Promise<boolean> {
    const { full_name, category, amount_due, batch_reference, qr_code_hash } = record;
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
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
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
            <tr>
                <td style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="font-size: 16px; font-weight: bold; color: #09090b; margin-top: 0; margin-bottom: 12px;">Hi ${full_name},</p>
                    <p style="margin: 0 0 24px 0;">Great news! Your payment has been verified and your registration for the Continent 3 Teens Conference is now confirmed. We can't wait to see you at T.I.M.E '26!</p>

                    <div style="text-align: center; margin: 32px 0;">
                        <div style="background-color: #ffffff; padding: 12px; border: 1px solid #e4e4e7; border-radius: 12px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                            <img src="${qrCodeUrl}" alt="Check-In QR Code" style="width: 200px; height: 200px; display: block;" />
                        </div>
                        <p style="font-size: 12px; color: #71717a; margin: 8px 0 0 0; font-weight: 500;">Show this QR code at the venue for express check-in</p>
                    </div>

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

                    <div style="text-align: center; margin: 32px 0 16px 0;">
                        <a href="${statusUrl}" target="_blank" style="display: block; background-color: #f97316; color: #ffffff !important; font-weight: bold; font-size: 15px; text-decoration: none; padding: 14px 24px; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(249, 115, 22, 0.2); text-align: center;">View Your Registration Status →</a>
                    </div>
                </td>
            </tr>
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

    return sendResendEmail(record.email, "You're In! Your C3TC '26 Registration is Confirmed ✅", htmlContent);
}

async function sendVolunteerApprovalEmail(record: any, host: string): Promise<boolean> {
    const { full_name, role, department, region } = record;
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
            <tr>
                <td style="background-color: #0a0f1e; padding: 40px 20px; text-align: center;">
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
            <tr>
                <td style="background-color: #ffffff; padding: 32px; font-size: 15px; color: #27272a; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <p style="font-size: 16px; font-weight: bold; color: #09090b; margin-top: 0; margin-bottom: 12px;">Hi ${full_name},</p>
                    <p style="margin: 0 0 24px 0;">Great news! Your application to join the Continent 3 Teens Conference Volunteer Force has been reviewed and approved. Welcome to the team!</p>

                    <div style="background-color: #f8f8f8; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Name:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a;">${full_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 6px 0; color: #71717a; font-weight: 500;">Category:</td>
                                <td style="padding: 6px 0; text-align: right; font-weight: bold; color: #0f172a; text-transform: capitalize;">${role || 'Volunteer'}</td>
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

    return sendResendEmail(record.email, "Your C3TC Volunteer Application is Approved! 🎉", htmlContent);
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const cookies = parseCookies(req);
    const adminSession = cookies['admin_session'] || '';
    const adminKeyHeader = req.headers['x-admin-key'] || '';
    const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

    const getSessionToken = (session: string) => session.includes('|') ? session.split('|')[0] : session;
    const getVolunteerName = (session: string) => session.includes('|') ? session.split('|')[1] : '';

    const sessionToken = getSessionToken(adminSession);
    const headerToken = getSessionToken(adminKeyHeader);

    if (sessionToken !== expectedKey && headerToken !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials' });
    }

    const volunteerName = req.body.performed_by || getVolunteerName(adminSession) || getVolunteerName(adminKeyHeader) || 'Admin';

    try {
        const { id, type = 'delegate' } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Missing registration id' });
        }

        const host = req.headers.host || 'ltc-3-0.vercel.app';
        const table = type === 'volunteer' ? 'volunteers' : 'registrations';

        const { data: record, error: fetchErr } = await getSupabaseAdmin()
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !record) {
            return res.status(404).json({ error: 'Record not found' });
        }

        if (!record.email || !record.email.trim()) {
            return res.status(400).json({ error: 'Registrant does not have a valid email address' });
        }

        let sent = false;
        if (type === 'volunteer') {
            sent = await sendVolunteerApprovalEmail(record, host);
        } else {
            sent = await sendDelegateApprovalEmail(record, host);
        }

        if (!sent) {
            return res.status(500).json({ error: 'Failed to send email via Resend' });
        }

        // Update notification state
        await getSupabaseAdmin()
            .from(table)
            .update({
                notification_sent: true,
                notification_sent_at: new Date().toISOString()
            })
            .eq('id', id);

        // Audit logging
        if (type === 'delegate') {
            await getSupabaseAdmin()
                .from('audit_log')
                .insert({
                    action: 'email_resent',
                    registration_id: id,
                    batch_reference: record.batch_reference,
                    registrant_name: record.full_name,
                    performed_by: volunteerName,
                    device_info: req.headers['user-agent'] || 'Unknown',
                    notes: `Confirmation email resent manually to ${record.email}`
                });
        }

        return res.status(200).json({
            success: true,
            message: `Confirmation email resent successfully to ${record.email}`
        });

    } catch (err: any) {
        console.error('API /api/admin/resend-email Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
