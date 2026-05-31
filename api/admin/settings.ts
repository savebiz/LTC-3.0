import { getSupabaseAdmin } from './db_helper';

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
    if (req.method === 'GET') {
        try {
            const { key } = req.query;
            let query = getSupabaseAdmin().from('settings').select('*');
            if (key) {
                query = query.eq('key', key);
            }
            const { data, error } = await query;
            if (error) {
                console.error('Error fetching settings:', error);
                return res.status(500).json({ error: error.message });
            }
            return res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('API GET settings error:', err);
            return res.status(500).json({ error: err.message || 'Internal server error' });
        }
    }

    if (req.method === 'POST') {
        // Validate Authorization
        const cookies = parseCookies(req);
        const adminSession = cookies['admin_session'] || '';
        const adminKeyHeader = req.headers['x-admin-key'] || '';
        const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

        const getSessionToken = (session: string) => {
            return session.includes('|') ? session.split('|')[0] : session;
        };

        const isAuthorized = 
            getSessionToken(adminSession) === expectedKey || 
            getSessionToken(adminKeyHeader) === expectedKey;

        if (!isAuthorized) {
            return res.status(401).json({ error: 'Unauthorized: Invalid admin credentials' });
        }

        try {
            const { key, value } = req.body;

            if (!key) {
                return res.status(400).json({ error: 'Missing setting key' });
            }

            const { data, error } = await getSupabaseAdmin()
                .from('settings')
                .upsert({ key, value })
                .select();

            if (error) {
                console.error('Supabase settings upsert error:', error);
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json({ success: true, data });
        } catch (err: any) {
            console.error('API POST settings error:', err);
            return res.status(500).json({ error: err.message || 'Internal server error' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
}
