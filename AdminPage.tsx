import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout';
import DashboardOverview from './components/admin/DashboardOverview';
import RegistrationTable from './components/admin/RegistrationTable';
import VolunteerTable from './components/admin/VolunteerTable';
import CheckInModule from './components/admin/CheckInModule';
import SettingsPage from './components/admin/SettingsPage';
import AuditLogTable from './components/admin/AuditLogTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, UserCheck } from "lucide-react";
import { supabase } from '@/lib/supabase';

export default function AdminPage({ initialPage = 'overview' }: { initialPage?: string }) {
    const navigate = useNavigate();
    const location = useLocation();

    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('c3tc_admin_logged_in') === 'true';
        }
        return false;
    });

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');

    // Volunteer identity states
    const [volunteers, setVolunteers] = useState<string[]>([]);
    const [loginStep, setLoginStep] = useState<'password' | 'volunteer'>('password');
    const [selectedVolunteer, setSelectedVolunteer] = useState('');
    const [customVolunteer, setCustomVolunteer] = useState('');

    const getPageFromPath = () => {
        if (location.pathname === '/admin/checkin') return 'checkin';
        return initialPage;
    };

    const [activePage, setActivePage] = useState(getPageFromPath);

    useEffect(() => {
        if (location.pathname === '/admin/checkin') {
            setActivePage('checkin');
        } else if (location.pathname === '/admin') {
            if (activePage === 'checkin') {
                setActivePage('overview');
            }
        }
    }, [location.pathname]);

    // Fetch authorized volunteers list from settings table
    useEffect(() => {
        async function fetchVolunteers() {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('*')
                    .eq('key', 'checkin_volunteers')
                    .single();
                if (!error && data && Array.isArray(data.value)) {
                    setVolunteers(data.value);
                    if (data.value.length > 0) {
                        setSelectedVolunteer(data.value[0]);
                    }
                } else {
                    const fallback = ["Registration Team Lead", "Victor Sabo", "Volunteer Name 1", "Volunteer Name 2"];
                    setVolunteers(fallback);
                    setSelectedVolunteer(fallback[0]);
                }
            } catch (err) {
                console.error('Error loading checkin volunteers settings:', err);
                const fallback = ["Registration Team Lead", "Victor Sabo", "Volunteer Name 1", "Volunteer Name 2"];
                setVolunteers(fallback);
                setSelectedVolunteer(fallback[0]);
            }
        }

        fetchVolunteers();
    }, [isLoggedIn]); // Refresh if logout happens

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'C3TC@admin2026') {
            setLoginStep('volunteer');
            setLoginError('');
        } else {
            setLoginError('Incorrect password. Please try again.');
        }
    };

    const handleVolunteerSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const volunteerName = selectedVolunteer === 'Other' ? customVolunteer.trim() : selectedVolunteer;

        if (!volunteerName) {
            setLoginError('Please select or enter your name.');
            return;
        }

        sessionStorage.setItem('c3tc_admin_logged_in', 'true');
        sessionStorage.setItem('c3tc_admin_volunteer', volunteerName);
        // Save combined cookie for serverless API authorization verification
        document.cookie = `admin_session=C3TC@admin2026|${encodeURIComponent(volunteerName)}; path=/; max-age=86400; SameSite=Strict`;
        setIsLoggedIn(true);
        setLoginError('');
    };

    const handleLogout = () => {
        sessionStorage.removeItem('c3tc_admin_logged_in');
        sessionStorage.removeItem('c3tc_admin_volunteer');
        // Clear session cookie
        document.cookie = `admin_session=; path=/; max-age=0; SameSite=Strict`;
        setIsLoggedIn(false);
        setLoginStep('password');
        setPassword('');
        setSelectedVolunteer(volunteers[0] || 'Registration Team Lead');
        setCustomVolunteer('');
    };

    const handleNavigate = (page: string) => {
        if (page === 'checkin') {
            navigate('/admin/checkin');
        } else {
            navigate('/admin');
            setActivePage(page);
        }
    };

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
                            {loginStep === 'password' ? (
                                <>
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-full flex items-center justify-center">
                                            <Lock size={20} />
                                        </div>
                                        <h2 className="text-xl font-bold">Admin Authorization</h2>
                                        <p className="text-xs text-slate-400 text-center">
                                            Enter the password to access administrative modules
                                        </p>
                                    </div>

                                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                                            <div className="relative flex items-center w-full">
                                                <Input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
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
                                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold tracking-wide rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                                        >
                                            Authorize Access
                                        </Button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center">
                                            <UserCheck size={20} />
                                        </div>
                                        <h2 className="text-xl font-bold">Volunteer Identity</h2>
                                        <p className="text-xs text-slate-400 text-center">
                                            Who is operating the admin dashboard today?
                                        </p>
                                    </div>

                                    <form onSubmit={handleVolunteerSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Who are you today?</label>
                                            <select
                                                value={selectedVolunteer}
                                                onChange={(e) => {
                                                    setSelectedVolunteer(e.target.value);
                                                    setLoginError('');
                                                }}
                                                className="w-full bg-slate-800 text-white border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 h-12 px-4 rounded-xl font-medium outline-none"
                                            >
                                                {volunteers.map((name) => (
                                                    <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>
                                                ))}
                                                <option value="Other" className="bg-slate-900 text-white">Other (Write-in)</option>
                                            </select>
                                        </div>

                                        {selectedVolunteer === 'Other' && (
                                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Enter Your Name</label>
                                                <Input
                                                    type="text"
                                                    placeholder="Your full name"
                                                    value={customVolunteer}
                                                    onChange={(e) => {
                                                        setCustomVolunteer(e.target.value);
                                                        setLoginError('');
                                                    }}
                                                    className="!bg-white !text-slate-900 border-slate-200 focus:border-orange-500 h-12 placeholder:text-slate-400 rounded-xl font-medium"
                                                    required
                                                />
                                            </div>
                                        )}

                                        {loginError && (
                                            <p className="text-xs text-red-500 mt-1 font-medium animate-pulse">{loginError}</p>
                                        )}

                                        <Button
                                            type="submit"
                                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold tracking-wide rounded-xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all"
                                        >
                                            Confirm & Login
                                        </Button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLoginStep('password');
                                                setLoginError('');
                                            }}
                                            className="w-full text-center text-xs text-slate-400 hover:text-white mt-2 transition-colors focus:outline-none cursor-pointer"
                                        >
                                            ← Back to Password Entry
                                        </button>
                                    </form>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout activePage={activePage} onNavigate={handleNavigate} onLogout={handleLogout}>
            {activePage === 'overview' && <DashboardOverview />}

            {activePage === 'registrations' && <RegistrationTable />}

            {activePage === 'volunteers' && <VolunteerTable />}

            {activePage === 'checkin' && <CheckInModule />}

            {activePage === 'auditlog' && <AuditLogTable />}

            {activePage === 'settings' && <SettingsPage />}

            {/* Placeholders for other pages */}
            {['finances'].includes(activePage) && (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <h2 className="text-2xl font-bold capitalize">{activePage}</h2>
                    <p>Module under construction</p>
                </div>
            )}
        </AdminLayout>
    );
}
