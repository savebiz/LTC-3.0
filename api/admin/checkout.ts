import { getSupabaseAdmin } from './db_helper.js';

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

async function logAuditEvent(event: {
    action: string;
    registration_id: string;
    batch_reference?: string;
    registrant_name?: string;
    performed_by: string;
    device_info?: string;
    ip_address?: string;
    previous_value?: any;
    new_value?: any;
    notes?: string;
}) {
    try {
        const { error } = await getSupabaseAdmin()
            .from('audit_log')
            .insert({
                action: event.action,
                registration_id: event.registration_id,
                batch_reference: event.batch_reference,
                registrant_name: event.registrant_name,
                performed_by: event.performed_by,
                device_info: event.device_info,
                ip_address: event.ip_address,
                previous_value: event.previous_value,
                new_value: event.new_value,
                notes: event.notes
            });
        if (error) {
            console.error('Failed to write to audit log in checkout:', error);
        }
    } catch (err) {
        console.error('Error writing to audit log in checkout:', err);
    }
}

export default async function handler(req: any, res: any) {
    // 1. Validate HTTP Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Validate Admin Authorization (Cookie or Header)
    const cookies = parseCookies(req);
    const adminSession = cookies['admin_session'] || '';
    const adminKeyHeader = req.headers['x-admin-key'] || '';
    const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

    const getSessionToken = (session: string) => {
        return session.includes('|') ? session.split('|')[0] : session;
    };

    const getVolunteerName = (session: string) => {
        return session.includes('|') ? session.split('|')[1] : '';
    };

    const sessionToken = getSessionToken(adminSession);
    const headerToken = getSessionToken(adminKeyHeader);
    const isAuthorized = sessionToken === expectedKey || headerToken === expectedKey;

    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials' });
    }

    const volunteerName = req.body.performed_by || getVolunteerName(adminSession) || getVolunteerName(adminKeyHeader) || 'Restroom Gate Usher';

    try {
        const { qr_code_hash, registration_id, mode = 'auto' } = req.body;

        if (!qr_code_hash && !registration_id) {
            return res.status(400).json({ error: 'Missing qr_code_hash or registration_id parameter' });
        }

        // 3. Find Registrant
        let query = getSupabaseAdmin().from('registrations').select('*');
        if (qr_code_hash) {
            query = query.eq('qr_code_hash', qr_code_hash);
        } else {
            query = query.eq('id', registration_id);
        }

        const { data: records, error: fetchError } = await query;

        if (fetchError) {
            console.error('Database fetch error:', fetchError);
            return res.status(500).json({ error: fetchError.message });
        }

        if (!records || records.length === 0) {
            return res.status(404).json({ 
                error: 'QR Code Not Recognised', 
                message: 'No registration record found for this credential. Direct delegate to the Help Desk.' 
            });
        }

        const record = records[0];

        // 4. Verification Check: Delegate MUST be cleared and checked in at the primary gate first
        const st = record.status?.toLowerCase();
        const ps = record.payment_status?.toLowerCase();
        const isCleared = ps === 'cleared' || st === 'confirmed';

        if (!isCleared) {
            return res.status(402).json({
                error: 'Payment Not Cleared',
                message: "This delegate has not completed clearance. Direct them to the Payment Verification desk.",
                record
            });
        }

        if (!record.checked_in) {
            // Anti-Fraud Defense: Tried to exit or re-enter without ever going through Gate 1
            await logAuditEvent({
                action: 'checkout_rejected_never_checked_in',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Restroom Gate Scanner',
                notes: 'Delegate attempted to use restroom pass without primary Gate 1 Check-In'
            });

            return res.status(400).json({
                error: 'Not Checked In',
                message: 'This delegate was never checked in at Gate 1. They must proceed to the main entrance first.',
                record
            });
        }

        // 5. Determine Current Inside vs Restroom State via Audit Log
        const { data: recentLogs } = await getSupabaseAdmin()
            .from('audit_log')
            .select('action, created_at')
            .eq('registration_id', record.id)
            .in('action', ['check_in_success', 'restroom_checkout', 'restroom_reentry'])
            .order('created_at', { ascending: false })
            .limit(1);

        const latestAction = recentLogs && recentLogs.length > 0 ? recentLogs[0].action : 'check_in_success';
        const latestTime = recentLogs && recentLogs.length > 0 ? recentLogs[0].created_at : record.checked_in_at;

        // Is delegate currently inside the hall?
        // If latest action was checkout, they are OUT. Otherwise, they are IN.
        const isCurrentlyInside = latestAction !== 'restroom_checkout';

        // 6. Execute Transition
        let actionToPerform: 'checkout' | 'reenter' = 'checkout';
        if (mode === 'checkout') {
            actionToPerform = 'checkout';
        } else if (mode === 'reenter') {
            actionToPerform = 'reenter';
        } else {
            // Auto Mode: Toggle state
            actionToPerform = isCurrentlyInside ? 'checkout' : 'reenter';
        }

        const now = new Date();
        const nowISO = now.toISOString();

        if (actionToPerform === 'checkout') {
            // ISSUING RESTROOM PASS (CHECK-OUT)
            await logAuditEvent({
                action: 'restroom_checkout',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Restroom Gate Scanner',
                previous_value: { is_inside: true },
                new_value: { is_inside: false, exit_time: nowISO },
                notes: 'Restroom exit pass issued'
            });

            return res.status(200).json({
                success: true,
                type: 'checkout',
                title: 'Restroom Pass Issued',
                message: `Temporary exit pass active for ${record.full_name}. Please return within 20-30 minutes.`,
                record,
                exit_time: nowISO
            });
        } else {
            // RE-ENTRY CONFIRMATION (CHECK-IN BACK)
            let minutesOut = 0;
            if (latestTime) {
                const exitDate = new Date(latestTime);
                const diffMs = now.getTime() - exitDate.getTime();
                minutesOut = Math.max(1, Math.round(diffMs / 60000));
            }

            await logAuditEvent({
                action: 'restroom_reentry',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Restroom Gate Scanner',
                previous_value: { is_inside: false, exit_time: latestTime },
                new_value: { is_inside: true, reenter_time: nowISO },
                notes: `Re-entry authorized. Minutes out: ${minutesOut}`
            });

            return res.status(200).json({
                success: true,
                type: 'reentry',
                title: 'Re-Entry Authorized!',
                message: `Welcome back, ${record.full_name}! Re-entry confirmed.`,
                record,
                minutes_out: minutesOut,
                reenter_time: nowISO
            });
        }
    } catch (err: any) {
        console.error('API /api/admin/checkout Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
