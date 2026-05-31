import { useState } from 'react';
import {
    LayoutDashboard, Users, BarChart3, QrCode,
    Settings, LogOut, Menu, X, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type UserRole = 'Super Admin' | 'Access Admin' | 'Volunteer' | 'Supervisor';

export const ROLE_ACCESS: Record<UserRole, string[]> = {
    'Super Admin': ['overview', 'registrations', 'volunteers', 'analytics', 'auditlog', 'checkin', 'settings'],
    'Access Admin': ['overview', 'registrations', 'volunteers', 'analytics', 'checkin'],
    'Volunteer': ['overview', 'checkin'],
    'Supervisor': ['overview', 'analytics']
};

interface AdminLayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
    isSidebarOpen?: boolean;
    onSidebarOpenChange?: (open: boolean) => void;
}

export default function AdminLayout({ 
    children, 
    activePage, 
    onNavigate, 
    onLogout,
    isSidebarOpen: externalSidebarOpen,
    onSidebarOpenChange
}: AdminLayoutProps) {
    const [localSidebarOpen, setLocalSidebarOpen] = useState(false);
    
    const isSidebarOpen = externalSidebarOpen !== undefined ? externalSidebarOpen : localSidebarOpen;
    const setIsSidebarOpen = onSidebarOpenChange !== undefined ? onSidebarOpenChange : setLocalSidebarOpen;

    // Read volunteer name & role from session storage
    const volunteerName = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_volunteer') : null;
    const volunteerRole = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_role') : null;
    const activeRole = (volunteerRole || 'Super Admin') as UserRole;

    // Calculate volunteer initials
    const initials = volunteerName 
        ? volunteerName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : 'AD';

    const NAV_ITEMS = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'registrations', label: 'Registrations', icon: Users },
        { id: 'volunteers', label: 'Volunteers', icon: Users },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'auditlog', label: 'Audit Log', icon: ClipboardList },
        { id: 'checkin', label: 'Check-in', icon: QrCode },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    // Filter nav items based on user role
    const allowedTabs = ROLE_ACCESS[activeRole] || ROLE_ACCESS['Super Admin'];
    const filteredNavItems = NAV_ITEMS.filter(item => allowedTabs.includes(item.id));

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* MOBILE OVERLAY */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside className={cn(
                "fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:translate-x-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6 flex items-center justify-between">
                    <h1 className="text-2xl font-black font-heading tracking-tighter text-orange-500">
                        C3TC ADMIN
                    </h1>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400">
                        <X size={24} />
                    </button>
                </div>

                <nav className="px-4 space-y-2 mt-4">
                    {filteredNavItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                onNavigate(item.id);
                                setIsSidebarOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                                activePage === item.id
                                    ? "bg-orange-500 text-white font-bold shadow-lg shadow-orange-500/20"
                                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                            )}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-2 cursor-pointer"
                        onClick={onLogout}
                    >
                        <LogOut size={18} />
                        Logout
                    </Button>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* HEADER */}
                <header className="h-16 bg-white border-b flex items-center justify-between px-6">
                    <button
                        className="md:hidden text-slate-500"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right hidden md:flex md:flex-col md:items-end justify-center">
                            <p className="text-sm font-bold text-slate-900 leading-tight">{volunteerName || 'Super Admin'}</p>
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg mt-0.5 inline-block shrink-0">
                                {activeRole}
                            </span>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold border-2 border-orange-200 shadow-sm" title={`${volunteerName || 'Super Admin'} / ${activeRole}`}>
                            {initials}
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="flex-1 overflow-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
