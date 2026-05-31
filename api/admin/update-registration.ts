import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create a Supabase Client using the Service Role Key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
    // 1. Validate HTTP Method
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Validate Admin Key Header
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';
    if (!adminKey || adminKey !== expectedKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin key' });
    }

    try {
        const { id, field, value, updates } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing registration id' });
        }

        // Support both single-field updates, batch updates object, and root-level fields
        let updatePayload: any = {};
        
        if (updates && typeof updates === 'object') {
            updatePayload = { ...updates };
            // Handle double-nesting if updates contains updates
            if (updatePayload.updates && typeof updatePayload.updates === 'object') {
                updatePayload = { ...updatePayload.updates };
            }
        } else if (field && field !== 'updates') {
            updatePayload[field] = value;
        } else if (field === 'updates' && typeof value === 'object') {
            updatePayload = { ...value };
        } else {
            // Fallback to any other keys in req.body except metadata
            const { id: _, field: __, value: ___, ...rest } = req.body;
            updatePayload = { ...rest };
            // Handle nesting in fallback case
            if (updatePayload.updates && typeof updatePayload.updates === 'object') {
                updatePayload = { ...updatePayload.updates };
            }
        }

        // Safety cleanup to ensure no metadata/unsupported columns are passed to Supabase
        delete updatePayload.updates;
        delete updatePayload.id;
        delete updatePayload.field;
        delete updatePayload.value;

        // Ensure there is actually something to update
        if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ error: 'Missing updates payload fields' });
        }

        console.log(`API update-registration: Performing update on record ${id}:`, updatePayload);

        // Fetch the existing record to know the old payment_status and notification state
        const { data: oldRecord, error: fetchError } = await supabaseAdmin
            .from('registrations')
            .select('payment_status, notification_sent, email')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error fetching old record for notification check:', fetchError);
        }

        const { data, error } = await supabaseAdmin
            .from('registrations')
            .update(updatePayload)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            return res.status(500).json({ error: error.message });
        }

        // Trigger notifications if payment_status changed to 'cleared' or 'rejected'
        if (data && data.length > 0) {
            const updatedRecord = data[0];
            const newStatus = updatedRecord.payment_status;
            const oldStatus = oldRecord?.payment_status;
            const wasNotificationSent = oldRecord?.notification_sent;

            if (
                updatedRecord.email &&
                (newStatus === 'cleared' || newStatus === 'rejected') &&
                newStatus !== oldStatus &&
                !wasNotificationSent
            ) {
                const protocol = req.headers.host?.includes('localhost') || req.headers.host?.includes('127.0.0.1') ? 'http' : 'https';
                const notifyUrl = `${protocol}://${req.headers.host}/api/notify-registrant`;
                console.log(`Directly triggering notification endpoint ${notifyUrl} for record ${updatedRecord.id}`);

                fetch(notifyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        record: updatedRecord,
                        old_record: oldRecord || { payment_status: 'pending' },
                        type: 'UPDATE'
                    })
                }).then(async (notifyRes) => {
                    const notifyData = await notifyRes.json().catch(() => ({}));
                    console.log(`Direct notification endpoint response: status ${notifyRes.status}`, notifyData);
                }).catch(err => {
                    console.error('Error calling notify-registrant API directly:', err);
                });
            }
        }

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('API /api/admin/update-registration Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
