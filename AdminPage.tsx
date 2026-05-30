import { useState } from 'react';
import AdminLayout from './components/admin/AdminLayout';
import DashboardOverview from './components/admin/DashboardOverview';
import RegistrationTable from './components/admin/RegistrationTable';
import VolunteerTable from './components/admin/VolunteerTable';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function AdminPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('c3tc_admin_logged_in') === 'true';
        }
        return false;
    });
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [activePage, setActivePage] = useState('overview');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === 'C3TC@admin2026') {
            sessionStorage.setItem('c3tc_admin_logged_in', 'true');
            setIsLoggedIn(true);
            setLoginError('');
        } else {
            setLoginError('Incorrect password. Please try again.');
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('c3tc_admin_logged_in');
        setIsLoggedIn(false);
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden text-white font-sans">
                {/* Background glow effects */}
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-orange-600/10 blur-[150px] pointer-events-none"></div>
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none"></div>

                <div className="w-full max-w-md relative z-10 animate-in fade-in duration-500">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-black font-heading tracking-tighter text-orange-500 mb-2">
                            C3TC 3.0
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
                                <h2 className="text-xl font-bold">Admin Authorization</h2>
                                <p className="text-xs text-slate-400 text-center">
                                    Enter the password to access administrative modules
                                </p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-950/80 border-slate-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 h-12 pr-10 text-white placeholder:text-slate-600 rounded-xl"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <AdminLayout activePage={activePage} onNavigate={setActivePage} onLogout={handleLogout}>
            {activePage === 'overview' && <DashboardOverview />}

            {activePage === 'registrations' && <RegistrationTable />}

            {activePage === 'volunteers' && <VolunteerTable />}

            {/* Placeholders for other pages */}
            {['finances', 'checkin', 'settings'].includes(activePage) && (
                <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                    <h2 className="text-2xl font-bold capitalize">{activePage}</h2>
                    <p>Module under construction</p>
                </div>
            )}
        </AdminLayout>
    );
}
