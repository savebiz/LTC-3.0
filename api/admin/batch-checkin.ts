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

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Authorize Admin
    const cookies = parseCookies(req);
    const adminSession = cookies['admin_session'] || '';
    const adminKeyHeader = req.headers['x-admin-key'] || '';
    const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

    const getSessionToken = (session: string) => session.includes('|') ? session.split('|')[0] : session;
    const getVolunteerName = (session: string) => session.includes('|') ? session.split('|')[1] : '';

    const sessionToken = getSessionToken(adminSession);
    const headerToken = getSessionToken(adminKeyHeader);

    const isAuthorized = sessionToken === expectedKey || headerToken === expectedKey;
    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin credentials' });
    }

    const volunteerName = req.body.performed_by || getVolunteerName(adminSession) || getVolunteerName(adminKeyHeader) || 'Gate Usher';

    try {
        const { 
            registration_ids, 
            coordinator_id,
            coordinator_name, 
            province, 
            region, 
            batch_reference, 
            headcount_verified,
            batch_label
        } = req.body;

        const supabase = getSupabaseAdmin();
        let targetIds: string[] = Array.isArray(registration_ids) ? registration_ids : [];

        // If no explicit IDs provided, dynamically resolve the first N eligible delegates by province/batch
        if (targetIds.length === 0) {
            const requestedCount = parseInt(headcount_verified, 10) || 0;
            if (requestedCount <= 0) {
                return res.status(400).json({ error: 'Please provide either registration IDs or a positive headcount number.' });
            }

            let poolQuery = supabase
                .from('registrations')
                .select('id, status, payment_status, checked_in')
                .eq('checked_in', false);

            if (batch_reference && batch_reference !== 'DEFAULT' && batch_reference !== '-') {
                poolQuery = poolQuery.eq('batch_reference', batch_reference);
            } else if (province) {
                poolQuery = poolQuery.eq('province', province);
            } else {
                return res.status(400).json({ error: 'Province or Batch Reference is required for headcount check-in.' });
            }

            const { data: poolRows, error: poolErr } = await poolQuery.order('full_name', { ascending: true });
            if (poolErr) return res.status(500).json({ error: poolErr.message });

            const eligiblePool = (poolRows || []).filter((d: any) => {
                const st = d.status?.toLowerCase();
                const ps = d.payment_status?.toLowerCase();
                const isCleared = ps === 'cleared' || st === 'confirmed';
                const isRejected = st === 'rejected' || ps === 'rejected';
                return isCleared && !isRejected;
            });

            if (eligiblePool.length === 0) {
                return res.status(400).json({ 
                    error: 'No Eligible Delegates', 
                    message: 'No remaining cleared delegates found for this province/batch.' 
                });
            }

            targetIds = eligiblePool.slice(0, requestedCount).map((d: any) => d.id);
        }

        // 2. Fetch the target registrations to confirm they exist and check clearance
        const { data: delegates, error: fetchErr } = await supabase
            .from('registrations')
            .select('id, full_name, category, status, payment_status, checked_in, batch_reference, region, province')
            .in('id', targetIds);

        if (fetchErr) {
            console.error('Batch fetch error:', fetchErr);
            return res.status(500).json({ error: fetchErr.message });
        }

        if (!delegates || delegates.length === 0) {
            return res.status(404).json({ error: 'No matching registrations found' });
        }

        // 3. Filter delegates eligible for check-in (cleared/confirmed, not rejected, and not already checked in)
        const eligibleDelegates = delegates.filter((d: any) => {
            const st = d.status?.toLowerCase();
            const ps = d.payment_status?.toLowerCase();
            const isCleared = ps === 'cleared' || st === 'confirmed';
            const isRejected = st === 'rejected' || ps === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        if (eligibleDelegates.length === 0) {
            const alreadyInCount = delegates.filter((d: any) => d.checked_in).length;
            if (alreadyInCount > 0) {
                return res.status(409).json({ 
                    error: 'Already Checked In', 
                    message: `All ${alreadyInCount} delegates in this selection have already been checked in.` 
                });
            }
            return res.status(400).json({ 
                error: 'Ineligible Delegates', 
                message: 'None of the selected delegates are cleared for check-in. Check payments or approval status.' 
            });
        }

        const eligibleIds = eligibleDelegates.map((d: any) => d.id);
        const checkInTimestamp = new Date().toISOString();

        // 4. Batch update checked_in status in database
        const { data: updatedDelegates, error: updateErr } = await supabase
            .from('registrations')
            .update({
                checked_in: true,
                checked_in_at: checkInTimestamp
            })
            .in('id', eligibleIds)
            .select();

        if (updateErr) {
            console.error('Batch check-in update error:', updateErr);
            return res.status(500).json({ error: updateErr.message });
        }

        // 5. Insert an aggregated audit log entry for this batch check-in
        const targetBatchRef = batch_reference || eligibleDelegates[0]?.batch_reference || 'BATCH';
        const targetProvince = province || eligibleDelegates[0]?.province || 'General';
        const targetRegion = region || eligibleDelegates[0]?.region || 'General';
        const targetCoordinator = coordinator_name || 'Group Coordinator';
        const targetLabel = batch_label ? ` [${batch_label}]` : '';

        await supabase.from('audit_log').insert({
            action: 'batch_coordinator_checkin',
            registration_id: coordinator_id || eligibleIds[0],
            batch_reference: targetBatchRef,
            registrant_name: targetCoordinator,
            performed_by: volunteerName,
            device_info: req.headers['user-agent'] || 'Check-In Gate',
            new_value: {
                batch_count: eligibleIds.length,
                headcount_verified: headcount_verified || eligibleIds.length,
                batch_label: batch_label || null,
                province: targetProvince,
                region: targetRegion,
                checked_in_at: checkInTimestamp
            },
            notes: `Batch Check-In${targetLabel}: ${eligibleIds.length} delegates checked in for "${targetCoordinator}" (${targetProvince}, ${targetRegion}). Verified headcount: ${headcount_verified || eligibleIds.length}.`
        });

        return res.status(200).json({
            success: true,
            message: `Batch Check-In Successful! Checked in ${eligibleIds.length} delegates${targetLabel}.`,
            checked_in_count: eligibleIds.length,
            headcount_verified: headcount_verified || eligibleIds.length,
            batch_label: batch_label || null,
            coordinator_name: targetCoordinator,
            province: targetProvince,
            region: targetRegion,
            updated_ids: eligibleIds
        });

    } catch (err: any) {
        console.error('API /api/admin/batch-checkin Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
