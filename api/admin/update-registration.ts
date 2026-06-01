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
        delete updatePayload.performed_by;

        // Ensure there is actually something to update
        if (Object.keys(updatePayload).length === 0) {
            return res.status(400).json({ error: 'Missing updates payload fields' });
        }

        console.log(`API update-registration: Performing update on record ${id}:`, updatePayload);

        // Fetch the existing record to know the old values
        const { data: oldRecord, error: fetchError } = await getSupabaseAdmin()
            .from('registrations')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Error fetching old record for audit/notification check:', fetchError);
        }

        const { data, error } = await getSupabaseAdmin()
            .from('registrations')
            .update(updatePayload)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            return res.status(500).json({ error: error.message });
        }

        if (data && data.length > 0) {
            const updatedRecord = data[0];
            
            // Audit Logging Logic
            const prevPaymentStatus = oldRecord?.payment_status || 'pending';
            const newPaymentStatus = updatedRecord.payment_status;

            if (newPaymentStatus && newPaymentStatus !== prevPaymentStatus) {
                if (newPaymentStatus === 'cleared') {
                    await logAuditEvent({
                        action: 'payment_cleared',
                        registration_id: id,
                        batch_reference: updatedRecord.batch_reference,
                        registrant_name: updatedRecord.full_name,
                        performed_by: volunteerName,
                        device_info: req.headers['user-agent'] || 'Unknown',
                        previous_value: { payment_status: prevPaymentStatus, status: oldRecord?.status },
                        new_value: { payment_status: newPaymentStatus, status: updatedRecord.status },
                        notes: `Payment cleared. Payment reference: ${updatedRecord.payment_reference || 'N/A'}`
                    });
                } else if (newPaymentStatus === 'rejected') {
                    await logAuditEvent({
                        action: 'payment_rejected',
                        registration_id: id,
                        batch_reference: updatedRecord.batch_reference,
                        registrant_name: updatedRecord.full_name,
                        performed_by: volunteerName,
                        device_info: req.headers['user-agent'] || 'Unknown',
                        previous_value: { payment_status: prevPaymentStatus, status: oldRecord?.status },
                        new_value: { payment_status: newPaymentStatus, status: updatedRecord.status },
                        notes: `Payment rejected. Reason: ${updatedRecord.rejection_reason || 'N/A'}`
                    });
                }
            }

            // Check-in via update-registration (e.g. from registration table actions)
            if (updatedRecord.checked_in && !oldRecord?.checked_in) {
                await logAuditEvent({
                    action: 'check_in_success',
                    registration_id: id,
                    batch_reference: updatedRecord.batch_reference,
                    registrant_name: updatedRecord.full_name,
                    performed_by: volunteerName,
                    device_info: req.headers['user-agent'] || 'Unknown',
                    previous_value: { checked_in: false, checked_in_at: null },
                    new_value: { checked_in: true, checked_in_at: updatedRecord.checked_in_at },
                    notes: 'Checked in from registration table actions'
                });
            }

            // Trigger notifications if payment_status changed to 'cleared' or 'rejected'
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
                console.log(`Direct triggering notification endpoint ${notifyUrl} for record ${updatedRecord.id}`);

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
