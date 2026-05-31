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

export default async function handler(req: any, res: any) {
    // 1. Validate HTTP Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Validate Admin Authorization (Cookie or Header)
    const cookies = parseCookies(req);
    const adminSession = cookies['admin_session'];
    const adminKeyHeader = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

    const isAuthorized = (adminSession && adminSession === expectedKey) || (adminKeyHeader && adminKeyHeader === expectedKey);

    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials' });
    }

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
            return res.status(403).json({
                error: 'Registration Rejected',
                message: "This delegate's registration was not approved. Please refer them to the help desk.",
                record
            });
        }

        // 4b. Check payment cleared status (Must be 'cleared' or status must be 'confirmed')
        const isCleared = ps === 'cleared' || st === 'confirmed';
        if (!isCleared) {
            return res.status(402).json({
                error: 'Payment Not Cleared',
                message: "This delegate's payment has not been verified. Please direct them to the payment desk.",
                record
            });
        }

        // 4c. Check if already checked in
        if (record.checked_in) {
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
