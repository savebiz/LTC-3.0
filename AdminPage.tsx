
import { useState } from 'react';
import AdminLayout from './components/admin/AdminLayout';
import DashboardOverview from './components/admin/DashboardOverview';
import RegistrationTable from './components/admin/RegistrationTable';
import { Card, CardContent } from "@/components/ui/card";

export default function AdminPage() {
    const [activePage, setActivePage] = useState('overview');

    return (
        <AdminLayout activePage={activePage} onNavigate={setActivePage}>
            {activePage === 'overview' && <DashboardOverview />}

            {activePage === 'registrations' && <RegistrationTable />}

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
