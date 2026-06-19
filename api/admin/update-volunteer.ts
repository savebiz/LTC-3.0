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

    const sessionToken = getSessionToken(adminSession);
    const headerToken = getSessionToken(adminKeyHeader);

    const isAuthorized = sessionToken === expectedKey || headerToken === expectedKey;

    if (!isAuthorized) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin credentials' });
    }

    try {
        const { id, status, rejection_reason } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing volunteer id' });
        }

        if (!status || !['confirmed', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid or missing status value' });
        }

        console.log(`API update-volunteer: Performing status update on volunteer ${id}: ${status}`);

        const updatePayload: any = { status };
        if (status === 'rejected' && rejection_reason) {
            updatePayload.rejection_reason = rejection_reason;
        }

        const { data, error } = await getSupabaseAdmin()
            .from('volunteers')
            .update(updatePayload)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('API /api/admin/update-volunteer Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
