import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export interface AdminUser {
    id: string;
    full_name: string;
    role: 'Super Admin' | 'Access Admin' | 'Volunteer' | 'Supervisor';
    password_hash: string;
    is_active: boolean;
    created_at: string;
}

const DEFAULT_SUPER_ADMIN_HASH = '$2b$10$AxzKr6WI.38RGleM7v6cj.hIGx/IrEckMxTfzAshGGb3Nso.Or2hK'; // Hash for C3TC@admin2026

export function getDefaultUsers(): AdminUser[] {
    return [
        {
            id: 'd0000000-0000-0000-0000-000000000001',
            full_name: 'Victor Sabo',
            role: 'Super Admin',
            password_hash: DEFAULT_SUPER_ADMIN_HASH,
            is_active: true,
            created_at: new Date().toISOString()
        }
    ];
}

// Read users list from Supabase with fallback to settings table
export async function getAdminUsers(): Promise<AdminUser[]> {
    try {
        // Try querying the admin_users table first
        const { data, error } = await supabaseAdmin
            .from('admin_users')
            .select('*');
        
        if (!error && data) {
            return data as AdminUser[];
        }

        // If table doesn't exist, fallback to settings key 'admin_users'
        console.log('Falling back to settings table for admin_users...');
        const { data: settingData, error: settingError } = await supabaseAdmin
            .from('settings')
            .select('*')
            .eq('key', 'admin_users')
            .single();
        
        if (!settingError && settingData && Array.isArray(settingData.value)) {
            return settingData.value as AdminUser[];
        }

        // If that also fails, seed it in settings with default users
        const defaultUsers = getDefaultUsers();
        await saveAdminUsersToSettings(defaultUsers);
        return defaultUsers;
    } catch (err) {
        console.error('Error fetching admin users:', err);
        return getDefaultUsers();
    }
}

// Save users list to Supabase (saves to table if possible, otherwise to settings key 'admin_users')
export async function saveAdminUsers(users: AdminUser[]): Promise<boolean> {
    try {
        // Try writing to admin_users table first
        // Since we do updates/upserts, we can upsert or delete/insert. Let's do upsert.
        // We check if the table exists by doing a dry query.
        const { error: checkError } = await supabaseAdmin.from('admin_users').select('id').limit(1);
        
        if (!checkError) {
            // Table exists, perform upserts. 
            // But wait, if we deleted some users, upsert won't delete them.
            // So we can clear and insert, or do a comparison.
            // Let's do clear and insert (or write individual inserts/deletes).
            // A simple clear and insert:
            const { error: deleteError } = await supabaseAdmin.from('admin_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (!deleteError) {
                const { error: insertError } = await supabaseAdmin.from('admin_users').insert(users);
                if (!insertError) return true;
                console.error('Insert error in admin_users:', insertError);
            } else {
                console.error('Delete error in admin_users:', deleteError);
            }
        }
    } catch (e) {
        console.error('Error writing to admin_users table, falling back to settings:', e);
    }

    // Fallback: save to settings table as JSON array
    return await saveAdminUsersToSettings(users);
}

async function saveAdminUsersToSettings(users: AdminUser[]): Promise<boolean> {
    try {
        const { error } = await supabaseAdmin
            .from('settings')
            .upsert({ key: 'admin_users', value: users });
        
        if (error) {
            console.error('Failed to save admin_users to settings:', error);
            return false;
        }
        return true;
    } catch (err) {
        console.error('Error saving admin users to settings:', err);
        return false;
    }
}
