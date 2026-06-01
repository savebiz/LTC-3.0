import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout, { ROLE_ACCESS, UserRole } from './components/admin/AdminLayout';
import DashboardOverview from './components/admin/DashboardOverview';
import RegistrationTable from './components/admin/RegistrationTable';
import VolunteerTable from './components/admin/VolunteerTable';
import CheckInModule from './components/admin/CheckInModule';
import SettingsPage from './components/admin/SettingsPage';
import AuditLogTable from './components/admin/AuditLogTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, User, Check, ChevronDown } from "lucide-react";
import { useDialog } from './components/ui/DialogProvider';

export default function AdminPage({ initialPage = 'overview' }: { initialPage?: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useDialog();

    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('c3tc_admin_logged_in') === 'true';
        }
        return false;
    });

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Active users list fetched from backend public endpoint
    const [activeUsers, setActiveUsers] = useState<{ full_name: string; role: string }[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Mobile sidebar state to propagate to camera module
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const getPageFromPath = () => {
        if (location.pathname === '/admin/checkin') return 'checkin';
        return initialPage;
    };

    const [activePage, setActivePage] = useState(getPageFromPath);

    // Synchronize page path
    useEffect(() => {
        if (location.pathname === '/admin/checkin') {
            setActivePage('checkin');
        } else if (location.pathname === '/admin') {
            if (activePage === 'checkin') {
                setActivePage('overview');
            }
        }
    }, [location.pathname]);

    // Fetch active users for the login dropdown on mount
    useEffect(() => {
        async function fetchActiveUsers() {
            try {
                const res = await fetch('/api/admin/users?isPublic=true');
                if (res.ok) {
                    const resData = await res.json();
                    if (resData.success && Array.isArray(resData.data)) {
                        setActiveUsers(resData.data);
                    }
                }
            } catch (err) {
                console.error('Failed to load active users for login screen:', err);
            }
        }
        if (!isLoggedIn) {
            fetchActiveUsers();
        }
    }, [isLoggedIn]);

    // Close searchable user dropdown on outside clicks
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Enforce Role-Based Access Control and redirection checks on activePage change
    useEffect(() => {
        if (isLoggedIn) {
            const role = (sessionStorage.getItem('c3tc_admin_role') || 'Super Admin') as UserRole;
            const allowed = ROLE_ACCESS[role] || ROLE_ACCESS['Super Admin'];
            
            // Normalize finances tab to analytics
            let targetPage = activePage;
            if (targetPage === 'finances') targetPage = 'analytics';

            if (!allowed.includes(targetPage)) {
                setActivePage('overview');
                navigate('/admin');
                toast.error("Access Denied", "You don't have permission to access that page.");
            }
        }
    }, [activePage, isLoggedIn, navigate]);

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setIsLoggingIn(true);

        if (!username.trim() || !password) {
            setLoginError('Please enter both your name and password.');
            setIsLoggingIn(false);
            return;
        }

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const { full_name, role } = data.user;
                
                // Write session keys to sessionStorage
                sessionStorage.setItem('c3tc_admin_logged_in', 'true');
                sessionStorage.setItem('c3tc_admin_volunteer', full_name);
                sessionStorage.setItem('c3tc_admin_role', role);

                // Write authorization cookie format expected by backend API handlers
                const expectedKey = 'C3TC@admin2026';
                document.cookie = `admin_session=${expectedKey}|${encodeURIComponent(full_name)}|${encodeURIComponent(role)}; path=/; max-age=86400; SameSite=Strict`;

                setIsLoggedIn(true);
                // Set default page based on role access
                const allowed = ROLE_ACCESS[role as UserRole] || ROLE_ACCESS['Super Admin'];
                if (allowed.includes('overview')) {
                    setActivePage('overview');
                } else if (allowed.length > 0) {
                    setActivePage(allowed[0]);
                }
                toast.success('Login Successful', `Welcome back, ${full_name}`);
            } else {
                setLoginError(data.error || 'Invalid credentials. Please try again.');
            }
        } catch (err: any) {
            console.error('Login submit error:', err);
            setLoginError('Failed to connect to authentication services.');
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('c3tc_admin_logged_in');
        sessionStorage.removeItem('c3tc_admin_volunteer');
        sessionStorage.removeItem('c3tc_admin_role');
        // Clear authorization cookies
        document.cookie = `admin_session=; path=/; max-age=0; SameSite=Strict`;
        setIsLoggedIn(false);
        setUsername('');
        setPassword('');
        setLoginError('');
        setLoginError('');
    };

    const handleNavigate = (page: string) => {
        // Map finances to analytics
        const finalPage = page === 'finances' ? 'analytics' : page;
        if (finalPage === 'checkin') {
            navigate('/admin/checkin');
        } else {
            navigate('/admin');
            setActivePage(finalPage);
        }
    };

    // Filter active users on typing
    const filteredUsers = activeUsers.filter(u => 
        u.full_name.toLowerCase().includes(username.toLowerCase())
    );

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-x-hidden overflow-y-auto text-white font-sans">
                <style dangerouslySetInnerHTML={{__html: `
                    .admin-password-input {
                        color: #111827 !important;
                        -webkit-text-fill-color: #111827 !important;
                        background-color: #ffffff !important;
                        caret-color: #111827 !important;
                    }
                    .admin-password-input:-webkit-autofill,
                    .admin-password-input:-webkit-autofill:hover,
                    .admin-password-input:-webkit-autofill:focus,
                    .admin-password-input:-webkit-autofill:active {
                        -webkit-text-fill-color: #111827 !important;
                        -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
                        box-shadow: 0 0 0px 1000px #ffffff inset !important;
                        caret-color: #111827 !important;
                    }
                `}} />
                {/* Background glow effects */}
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[150px] pointer-events-none"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none"></div>

                <div className="w-full max-w-md relative z-10 animate-in fade-in duration-500">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black font-heading tracking-tighter text-orange-500 mb-2">
                            C3TC
                        </h1>
                        <p className="text-sm text-slate-400">
                            Continent 3 Teens Conference Admin Portal
                        </p>
                    </div>

                    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-800/80 text-white shadow-2xl rounded-2xl p-6">
                        <CardContent className="p-0 space-y-6">
                            <div className="flex flex-col items-center justify-center space-y-2">
                                <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-full flex items-center justify-center">
                                    <Lock size={20} />
                                </div>
                                <h2 className="text-xl font-bold">Admin Portal Login</h2>
                                <p className="text-xs text-slate-400 text-center">
                                    Enter your credentials to access the administrative dashboard
                                </p>
                            </div>

                            <form onSubmit={handleLoginSubmit} className="space-y-4">
                                {/* Searchable Dropdown for User Name */}
                                <div className="space-y-2 relative" ref={dropdownRef}>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Name</label>
                                    <div className="relative flex items-center">
                                        <Input
                                            type="text"
                                            placeholder="Select or enter your name"
                                            value={username}
                                            onChange={(e) => {
                                                setUsername(e.target.value);
                                                setLoginError('');
                                                setShowDropdown(true);
                                            }}
                                            onFocus={() => setShowDropdown(true)}
                                            className="w-full !bg-white !text-slate-900 border-slate-200 focus:border-orange-500 h-12 pr-10 rounded-xl font-medium"
                                            required
                                        />
                                        <ChevronDown 
                                            size={18} 
                                            className="absolute right-3 text-slate-400 cursor-pointer pointer-events-none"
                                        />
                                    </div>
                                    
                                    {showDropdown && (filteredUsers.length > 0 || username.trim() !== '') && (
                                        <div className="absolute left-0 right-0 top-[76px] z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-800/50">
                                            {filteredUsers.map((user) => (
                                                <div
                                                    key={user.full_name}
                                                    onClick={() => {
                                                        setUsername(user.full_name);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="flex items-center px-4 py-3 hover:bg-slate-800 cursor-pointer text-sm font-medium transition-colors"
                                                >
                                                    <span>{user.full_name}</span>
                                                </div>
                                            ))}
                                            {username.trim() !== '' && !filteredUsers.some(u => u.full_name.toLowerCase() === username.trim().toLowerCase()) && (
                                                <div 
                                                    onClick={() => setShowDropdown(false)}
                                                    className="px-4 py-3 text-xs text-orange-500 italic font-medium cursor-pointer hover:bg-slate-800"
                                                >
                                                    Use custom: "{username.trim()}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Password field */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                                    <div className="relative flex items-center w-full">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            value={password}
                                            onChange={(e) => {
                                                setPassword(e.target.value);
                                                setLoginError('');
                                            }}
                                            className="admin-password-input w-full !bg-white !text-[#111827] border-slate-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 h-12 pr-12 placeholder:!text-[#9ca3af] rounded-xl font-medium"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all focus:outline-none cursor-pointer"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    {loginError && (
                                        <p className="text-xs text-red-500 mt-1 font-medium animate-pulse">{loginError}</p>
                                    )}
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoggingIn}
                                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold tracking-wide rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                                >
                                    {isLoggingIn ? 'Logging in...' : 'Login'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout 
            activePage={activePage} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout}
            isSidebarOpen={isSidebarOpen}
            onSidebarOpenChange={setIsSidebarOpen}
        >
            {activePage === 'overview' && <DashboardOverview />}

            {activePage === 'registrations' && <RegistrationTable />}

            {activePage === 'volunteers' && <VolunteerTable />}

            {activePage === 'checkin' && <CheckInModule isSidebarOpen={isSidebarOpen} />}

            {activePage === 'auditlog' && <AuditLogTable />}

            {activePage === 'settings' && <SettingsPage />}

            {/* Placeholder for Analytics Page */}
            {activePage === 'analytics' && (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <h2 className="text-2xl font-bold capitalize">Analytics</h2>
                    <p>Module under construction</p>
                </div>
            )}
        </AdminLayout>
    );
}
