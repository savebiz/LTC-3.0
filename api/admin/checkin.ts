import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase Client using the Service Role Key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

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
        const { error } = await supabaseAdmin
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
            console.error('Failed to write to audit log:', error);
        }
    } catch (err) {
        console.error('Error writing to audit log:', err);
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

    // Determine volunteer name
    const volunteerName = req.body.performed_by || getVolunteerName(adminSession) || getVolunteerName(adminKeyHeader) || 'Unknown Admin';

    try {
        const { qr_code_hash, registration_id } = req.body;

        if (!qr_code_hash && !registration_id) {
            return res.status(400).json({ error: 'Missing qr_code_hash or registration_id parameter' });
        }

        console.log(`API checkin: Processing request with qr_code_hash=${qr_code_hash}, registration_id=${registration_id}`);

        // 3. Find Registrant
        let query = supabaseAdmin.from('registrations').select('*');
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
            return res.status(404).json({ error: 'QR Code Not Recognised', message: 'No registration found for this QR code. Please direct the delegate to the help desk.' });
        }

        const record = records[0];

        // 4. Validate Status and Payment Status
        const st = record.status?.toLowerCase();
        const ps = record.payment_status?.toLowerCase();

        // 4a. Check Rejected status
        if (st === 'rejected' || ps === 'rejected') {
            await logAuditEvent({
                action: 'check_in_blocked_rejected',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Unknown',
                previous_value: { status: record.status, payment_status: record.payment_status },
                new_value: null,
                notes: `Rejection block. Category: ${record.category}`
            });
            return res.status(403).json({
                error: 'Registration Rejected',
                message: "This delegate's registration was not approved. Please refer them to the help desk.",
                record
            });
        }

        // 4b. Check payment cleared status (Must be 'cleared' or status must be 'confirmed')
        const isCleared = ps === 'cleared' || st === 'confirmed';
        if (!isCleared) {
            await logAuditEvent({
                action: 'check_in_blocked_pending',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Unknown',
                previous_value: { status: record.status, payment_status: record.payment_status },
                new_value: null,
                notes: `Pending payment block. Category: ${record.category}`
            });
            return res.status(402).json({
                error: 'Payment Not Cleared',
                message: "This delegate's payment has not been verified. Please direct them to the payment desk.",
                record
            });
        }

        // 4c. Check if already checked in
        if (record.checked_in) {
            await logAuditEvent({
                action: 'check_in_duplicate',
                registration_id: record.id,
                batch_reference: record.batch_reference,
                registrant_name: record.full_name,
                performed_by: volunteerName,
                device_info: req.headers['user-agent'] || 'Unknown',
                previous_value: { checked_in: true, checked_in_at: record.checked_in_at },
                new_value: null,
                notes: `Duplicate check-in attempt. Originally checked in at: ${record.checked_in_at}`
            });
            return res.status(409).json({
                error: 'Already Checked In',
                message: 'This delegate has already been checked in. Please verify their identity.',
                record
            });
        }

        // 5. Perform Check-in Update
        const { data: updatedData, error: updateError } = await supabaseAdmin
            .from('registrations')
            .update({
                checked_in: true,
                checked_in_at: new Date().toISOString()
            })
            .eq('id', record.id)
            .select();

        if (updateError) {
            console.error('Database checkin update error:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        const updatedRecord = updatedData ? updatedData[0] : record;

        await logAuditEvent({
            action: 'check_in_success',
            registration_id: record.id,
            batch_reference: record.batch_reference,
            registrant_name: record.full_name,
            performed_by: volunteerName,
            device_info: req.headers['user-agent'] || 'Unknown',
            previous_value: { checked_in: false, checked_in_at: null },
            new_value: { checked_in: true, checked_in_at: updatedRecord.checked_in_at },
            notes: qr_code_hash ? 'QR scan' : 'manual'
        });

        return res.status(200).json({
            success: true,
            message: 'Check-in Successful!',
            record: updatedRecord
        });

    } catch (err: any) {
        console.error('API /api/admin/checkin Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
