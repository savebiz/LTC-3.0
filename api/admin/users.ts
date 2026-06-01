import bcrypt from 'bcryptjs';
import { getAdminUsers, saveAdminUsers, AdminUser } from './db_helper.js';

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
    const { isPublic } = req.query;

    // 1. GET requests
    if (req.method === 'GET') {
        try {
            const users = await getAdminUsers();

            // If it is public (for the login dropdown), only return name, role, is_active (no hash, no id)
            if (isPublic === 'true') {
                const publicUsers = users
                    .filter(u => u.is_active)
                    .map(u => ({
                        full_name: u.full_name,
                        role: u.role
                    }));
                return res.status(200).json({ success: true, data: publicUsers });
            }

            // Otherwise, require authorization to fetch full list (except hashes)
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
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Return full user list without hashes
            const safeUsers = users.map(u => {
                const { password_hash, ...rest } = u;
                return rest;
            });

            return res.status(200).json({ success: true, data: safeUsers });
        } catch (err: any) {
            console.error('API GET users error:', err);
            return res.status(500).json({ error: err.message || 'Internal server error' });
        }
    }

    // 2. Write operations (POST/PUT/DELETE) require Super Admin authorization
    if (req.method === 'POST') {
        const cookies = parseCookies(req);
        const adminSession = cookies['admin_session'] || '';
        const adminKeyHeader = req.headers['x-admin-key'] || '';
        const expectedKey = process.env.ADMIN_KEY || 'C3TC@admin2026';

        const getSessionToken = (session: string) => {
            return session.includes('|') ? session.split('|')[0] : session;
        };

        const getSessionRole = (session: string) => {
            // Cookie format: secret|name|role
            const parts = session.split('|');
            return parts.length >= 3 ? decodeURIComponent(parts[2]) : '';
        };

        const isAuthorized = 
            getSessionToken(adminSession) === expectedKey || 
            getSessionToken(adminKeyHeader) === expectedKey;

        // Check if role is Super Admin
        const role = getSessionRole(adminSession) || 'Super Admin'; // fallback to super admin if header token was used
        
        if (!isAuthorized || role !== 'Super Admin') {
            return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
        }

        try {
            const { action, payload } = req.body;

            if (!action || !payload) {
                return res.status(400).json({ error: 'Missing action or payload' });
            }

            const users = await getAdminUsers();

            if (action === 'create') {
                const { full_name, role, password } = payload;
                if (!full_name || !role || !password) {
                    return res.status(400).json({ error: 'Missing fields' });
                }

                // Check for duplicate name
                if (users.some(u => u.full_name.toLowerCase() === full_name.trim().toLowerCase())) {
                    return res.status(400).json({ error: 'User with this name already exists' });
                }

                const newUser: AdminUser = {
                    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36),
                    full_name: full_name.trim(),
                    role,
                    password_hash: bcrypt.hashSync(password, 10),
                    is_active: true,
                    created_at: new Date().toISOString()
                };

                users.push(newUser);
                const success = await saveAdminUsers(users);
                if (!success) throw new Error('Save failed');

                return res.status(200).json({ success: true, message: 'User created' });
            }

            if (action === 'reset_password') {
                const { id, password } = payload;
                if (!id || !password) {
                    return res.status(400).json({ error: 'Missing id or password' });
                }

                const userIndex = users.findIndex(u => u.id === id);
                if (userIndex === -1) {
                    return res.status(404).json({ error: 'User not found' });
                }

                users[userIndex].password_hash = bcrypt.hashSync(password, 10);
                const success = await saveAdminUsers(users);
                if (!success) throw new Error('Save failed');

                return res.status(200).json({ success: true, message: 'Password reset successful' });
            }

            if (action === 'toggle_active') {
                const { id, is_active } = payload;
                if (!id || is_active === undefined) {
                    return res.status(400).json({ error: 'Missing parameters' });
                }

                const userIndex = users.findIndex(u => u.id === id);
                if (userIndex === -1) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // Prevent deactivating own self
                const adminName = adminSession.includes('|') ? decodeURIComponent(adminSession.split('|')[1]) : '';
                if (users[userIndex].full_name.toLowerCase() === adminName.toLowerCase()) {
                    return res.status(400).json({ error: 'Cannot deactivate your own account' });
                }

                users[userIndex].is_active = is_active;
                const success = await saveAdminUsers(users);
                if (!success) throw new Error('Save failed');

                return res.status(200).json({ success: true, message: 'User status updated' });
            }

            if (action === 'delete') {
                const { id } = payload;
                if (!id) {
                    return res.status(400).json({ error: 'Missing user ID' });
                }

                const userIndex = users.findIndex(u => u.id === id);
                if (userIndex === -1) {
                    return res.status(404).json({ error: 'User not found' });
                }

                // Prevent deleting own self
                const adminName = adminSession.includes('|') ? decodeURIComponent(adminSession.split('|')[1]) : '';
                if (users[userIndex].full_name.toLowerCase() === adminName.toLowerCase()) {
                    return res.status(400).json({ error: 'Cannot delete your own account' });
                }

                users.splice(userIndex, 1);
                const success = await saveAdminUsers(users);
                if (!success) throw new Error('Save failed');

                return res.status(200).json({ success: true, message: 'User deleted successfully' });
            }

            return res.status(400).json({ error: 'Unknown action' });
        } catch (err: any) {
            console.error('API POST users error:', err);
            return res.status(500).json({ error: err.message || 'Internal server error' });
        }
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
}
