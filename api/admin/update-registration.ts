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

    try {
        const { id, field, value, updates } = req.body;

        if (!id) {
            return res.status(400).json({ error: 'Missing registration id' });
        }

        // Support both single-field updates and batch update objects
        let updatePayload: any = {};
        if (updates && typeof updates === 'object') {
            updatePayload = { ...updates };
        } else if (field) {
            updatePayload[field] = value;
        } else {
            return res.status(400).json({ error: 'Missing field or updates payload' });
        }

        console.log(`API update-registration: Performing update on record ${id}:`, updatePayload);

        const { data, error } = await supabaseAdmin
            .from('registrations')
            .update(updatePayload)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Supabase update error:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('API /api/admin/update-registration Error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
