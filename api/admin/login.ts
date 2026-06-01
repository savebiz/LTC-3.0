import bcrypt from 'bcryptjs';
import { getAdminUsers } from './db_helper.js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Missing username or password' });
        }

        const users = await getAdminUsers();
        
        // Find active user with matching name case-insensitively
        const user = users.find(u => u.full_name.toLowerCase() === username.trim().toLowerCase() && u.is_active);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials. Please try again.' });
        }

        // Verify password hash
        const isValid = bcrypt.compareSync(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials. Please try again.' });
        }

        // Return user profile on success
        return res.status(200).json({
            success: true,
            user: {
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (err: any) {
        console.error('API login error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
