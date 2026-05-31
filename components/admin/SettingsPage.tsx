import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDialog } from '../ui/DialogProvider';
import { Plus, Trash2, Loader2, Users, ShieldAlert, Key, Eye, EyeOff, Check, X } from 'lucide-react';

interface AdminUser {
    id: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export default function SettingsPage() {
    const { toast, confirm } = useDialog();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Create User Form States
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('Volunteer');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Password Reset Modal/Inline States
    const [resettingUserId, setResettingUserId] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showResetPassword, setShowResetPassword] = useState(false);

    // Verify role permissions
    const volunteerRole = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_role') : null;
    const volunteerName = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_volunteer') : null;
    const isSuperAdmin = volunteerRole === 'Super Admin';

    // Fetch users list
    async function fetchUsers() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const resData = await res.json();
                if (resData.success && Array.isArray(resData.data)) {
                    setUsers(resData.data);
                }
            } else {
                toast.error('Failed to Load Users', 'Could not retrieve administrator accounts list.');
            }
        } catch (err) {
            console.error('Error fetching admin users:', err);
            toast.error('Connection Error', 'Failed to connect to users management API.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isSuperAdmin) {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [isSuperAdmin]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim() || !password) return;

        setSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create',
                    payload: {
                        full_name: fullName.trim(),
                        role,
                        password
                    }
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success('User Created', `User "${fullName}" has been added as a ${role}.`);
                setFullName('');
                setPassword('');
                fetchUsers();
            } else {
                toast.error('Creation Failed', data.error || 'Could not create user account.');
            }
        } catch (err: any) {
            console.error('Create user error:', err);
            toast.error('Error', err.message || 'API request failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean, userName: string) => {
        if (userName.toLowerCase() === volunteerName?.toLowerCase()) {
            toast.error('Denied', 'You cannot deactivate your own account.');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'toggle_active',
                    payload: {
                        id,
                        is_active: !currentStatus
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Status Updated', `User "${userName}" has been ${!currentStatus ? 'activated' : 'deactivated'}.`);
                fetchUsers();
            } else {
                toast.error('Update Failed', data.error || 'Failed to update user status.');
            }
        } catch (err: any) {
            console.error('Toggle active error:', err);
            toast.error('Error', err.message || 'API request failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resettingUserId || !newPassword) return;

        setSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'reset_password',
                    payload: {
                        id: resettingUserId,
                        password: newPassword
                    }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Password Reset', 'The password has been updated successfully.');
                setResettingUserId(null);
                setNewPassword('');
            } else {
                toast.error('Reset Failed', data.error || 'Failed to reset password.');
            }
        } catch (err: any) {
            console.error('Reset password error:', err);
            toast.error('Error', err.message || 'API request failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (id: string, userName: string) => {
        if (userName.toLowerCase() === volunteerName?.toLowerCase()) {
            toast.error('Denied', 'You cannot delete your own account.');
            return;
        }

        const proceed = await confirm({
            title: 'Delete User Account',
            body: `Are you sure you want to delete the user account for "${userName}"? This action is permanent.`,
            confirmText: 'Delete Account',
            type: 'danger'
        });

        if (!proceed) return;

        setSaving(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete',
                    payload: { id }
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('User Deleted', `User "${userName}" has been removed.`);
                fetchUsers();
            } else {
                toast.error('Delete Failed', data.error || 'Failed to delete user.');
            }
        } catch (err: any) {
            console.error('Delete user error:', err);
            toast.error('Error', err.message || 'API request failed.');
        } finally {
            setSaving(false);
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-96 max-w-md mx-auto text-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <ShieldAlert size={32} />
                </div>
                <div className="space-y-1">
                    <h3 className="text-xl font-bold text-slate-800">Access Restricted</h3>
                    <p className="text-sm text-slate-500">
                        You do not have permission to access the Settings configuration console. Settings management is restricted to Super Admin roles.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-3">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                <p className="text-sm text-slate-500">Loading settings console...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div>
                <h2 className="text-3xl font-bold font-heading text-slate-800">Admin Settings</h2>
                <p className="text-sm text-slate-500">Configure administrative access controls, users, and passwords.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* CREATE USER CARD */}
                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden lg:col-span-1">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5">
                        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Plus size={18} className="text-orange-500" />
                            Create User Account
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500">Full Name</label>
                                <Input
                                    placeholder="Enter full name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    disabled={saving}
                                    className="h-11 border-slate-200 focus:border-orange-500 rounded-xl"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500">Role Access</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    disabled={saving}
                                    className="w-full h-11 border border-slate-200 bg-white rounded-xl px-3 text-sm font-semibold outline-none text-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                                >
                                    <option value="Super Admin">Super Admin</option>
                                    <option value="Access Admin">Access Admin</option>
                                    <option value="Volunteer">Volunteer</option>
                                    <option value="Supervisor">Supervisor</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-500">Password</label>
                                <div className="relative flex items-center">
                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Set password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={saving}
                                        className="h-11 pr-10 border-slate-200 focus:border-orange-500 rounded-xl"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={saving || !fullName.trim() || !password}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all mt-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
                                Add Account
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* USER LIST CONSOLE */}
                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden lg:col-span-2">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-5 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-orange-500" />
                                User Management ({users.length})
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {users.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 border border-dashed m-6 rounded-xl bg-slate-50/50">
                                No admin user accounts found.
                            </div>
                        ) : (
                            <div className="overflow-x-auto w-full">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                            <th className="py-3.5 px-5">User</th>
                                            <th className="py-3.5 px-4">Role</th>
                                            <th className="py-3.5 px-4">Password</th>
                                            <th className="py-3.5 px-4 text-center">Status</th>
                                            <th className="py-3.5 px-5 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map((user) => {
                                            const isSelf = user.full_name.toLowerCase() === volunteerName?.toLowerCase();
                                            return (
                                                <tr key={user.id} className="hover:bg-slate-50/40 transition-colors">
                                                    <td className="py-4 px-5">
                                                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                            {user.full_name}
                                                            {isSelf && (
                                                                <span className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 px-1 rounded font-bold uppercase">You</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                            Added: {new Date(user.created_at).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className="font-bold text-[10px] bg-slate-100 border text-slate-600 px-2 py-0.5 rounded uppercase">
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {resettingUserId === user.id ? (
                                                            <form onSubmit={handleResetPassword} className="flex items-center gap-1.5 animate-in fade-in duration-200">
                                                                <Input
                                                                    type="password"
                                                                    placeholder="New password"
                                                                    value={newPassword}
                                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                                    className="h-8 w-28 text-xs border-slate-200 focus:border-orange-500 rounded-lg p-1.5"
                                                                    required
                                                                    autoFocus
                                                                />
                                                                <button 
                                                                    type="submit" 
                                                                    className="p-1 bg-green-50 text-green-600 border border-green-200 rounded-md hover:bg-green-100 cursor-pointer active:scale-95 transition-all"
                                                                    title="Save new password"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => setResettingUserId(null)}
                                                                    className="p-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer active:scale-95 transition-all"
                                                                    title="Cancel"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </form>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono text-slate-400 tracking-widest text-[10px]">••••••••</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setResettingUserId(user.id);
                                                                        setNewPassword('');
                                                                    }}
                                                                    className="text-slate-400 hover:text-orange-500 p-1 rounded hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                                                                    title="Reset Password"
                                                                >
                                                                    <Key size={13} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        <button
                                                            type="button"
                                                            disabled={isSelf || saving}
                                                            onClick={() => handleToggleActive(user.id, user.is_active, user.full_name)}
                                                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border uppercase shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                                                                ${user.is_active 
                                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50' 
                                                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                                                                }
                                                            `}
                                                            title={isSelf ? "Cannot deactivate yourself" : `Click to ${user.is_active ? 'deactivate' : 'activate'}`}
                                                        >
                                                            {user.is_active ? 'Active' : 'Inactive'}
                                                        </button>
                                                    </td>
                                                    <td className="py-4 px-5 text-right">
                                                        <button
                                                            type="button"
                                                            disabled={isSelf || saving}
                                                            onClick={() => handleDeleteUser(user.id, user.full_name)}
                                                            className="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors cursor-pointer"
                                                            title={isSelf ? "Cannot delete yourself" : `Delete ${user.full_name}`}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
