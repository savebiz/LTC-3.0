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
        const { id, status } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing volunteer id' });
        }

        if (!status || !['confirmed', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid or missing status value' });
        }

        console.log(`API update-volunteer: Performing status update on volunteer ${id}: ${status}`);

        const { data, error } = await supabaseAdmin
            .from('volunteers')
            .update({ status })
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
