
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Loader2, Users, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useDialog } from '../ui/DialogProvider';
import { Card, CardContent } from '@/components/ui/card';

export default function VolunteerTable() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { confirm, toast } = useDialog();

    useEffect(() => {
        fetchVolunteers();
    }, []);

    async function fetchVolunteers() {
        setLoading(true);
        const { data: vols, error } = await supabase
            .from('volunteers')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && vols) {
            setData(vols);
        }
        setLoading(false);
    }

    async function handleApprove(id: string) {
        const { confirmed } = await confirm({
            type: 'success',
            title: 'Approve Volunteer Application',
            body: 'Are you sure you want to approve this volunteer application? They will be marked as Confirmed.',
            confirmText: 'Approve Volunteer'
        });
        if (!confirmed) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/update-volunteer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': 'C3TC@admin2026'
                },
                body: JSON.stringify({ id, status: 'confirmed' })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }

            setData(prev => prev.map(v => v.id === id ? { ...v, status: 'confirmed' } : v));
            toast.success('Volunteer Approved', 'Volunteer application confirmed');
            fetchVolunteers();
        } catch (err: any) {
            console.error(err);
            toast.error('Error Approving Volunteer', err.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleRejectClick(id: string) {
        const { confirmed, value: reason } = await confirm({
            type: 'danger',
            title: 'Reject Volunteer Application',
            body: 'Are you sure you want to reject this volunteer application?',
            showInput: true,
            placeholder: 'Reason for rejection (optional)',
            confirmText: 'Reject Volunteer'
        });
        if (!confirmed) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/update-volunteer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': 'C3TC@admin2026'
                },
                body: JSON.stringify({ id, status: 'rejected', rejection_reason: reason?.trim() || '' })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }

            setData(prev => prev.map(v => v.id === id ? { ...v, status: 'rejected', rejection_reason: reason?.trim() || '' } : v));
            toast.success('Volunteer Rejected', 'Volunteer application updated');
            fetchVolunteers();
        } catch (err: any) {
            console.error(err);
            toast.error('Error Rejecting Volunteer', err.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    const filteredData = data.filter(r => {
        const matchesSearch = 
            r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.department?.toLowerCase().includes(searchTerm.toLowerCase());
            
        const matchesStatus = statusFilter === 'all' || (r.status || 'pending') === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    function exportCSV() {
        const headers = ['Full Name', 'Email', 'Phone', 'Role', 'Department', 'Region', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(r => [
                `"${r.full_name}"`, r.email, r.phone, r.role, `"${r.department}"`, `"${r.region}"`, `"${r.status || 'pending'}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ltc_volunteers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    const totalVolunteers = data.length;
    const confirmedVolunteers = data.filter(v => (v.status || 'pending') === 'confirmed').length;
    const pendingVolunteers = data.filter(v => (v.status || 'pending') === 'pending').length;
    const rejectedVolunteers = data.filter(v => (v.status || 'pending') === 'rejected').length;

    return (
        <div className="space-y-6">
            {/* Volunteers Summary Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* Card 1: Total */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                    <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
                        <Users size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div className="mt-2 w-full">
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Volunteers</p>
                        <h3 className="text-lg md:text-2xl font-black text-blue-600 mt-1">{totalVolunteers.toLocaleString()}</h3>
                    </div>
                </Card>
                {/* Card 2: Confirmed */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                    <div className="p-2 md:p-3 bg-emerald-50 text-emerald-500 rounded-xl shrink-0">
                        <CheckCircle2 size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div className="mt-2 w-full">
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Confirmed</p>
                        <h3 className="text-lg md:text-2xl font-black text-emerald-600 mt-1">{confirmedVolunteers.toLocaleString()}</h3>
                    </div>
                </Card>
                {/* Card 3: Pending */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                    <div className="p-2 md:p-3 bg-amber-50 text-amber-500 rounded-xl shrink-0">
                        <Clock size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div className="mt-2 w-full">
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
                        <h3 className="text-lg md:text-2xl font-black text-amber-600 mt-1">{pendingVolunteers.toLocaleString()}</h3>
                    </div>
                </Card>
                {/* Card 4: Rejected */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                    <div className="p-2 md:p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                        <XCircle size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div className="mt-2 w-full">
                        <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Rejected</p>
                        <h3 className="text-lg md:text-2xl font-black text-red-600 mt-1">{rejectedVolunteers.toLocaleString()}</h3>
                    </div>
                </Card>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold font-heading text-slate-800">Volunteers ({filteredData.length})</h2>
                <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="Search name, dept..."
                            className="pl-10 h-10 border-slate-200 rounded-xl"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="w-full md:w-auto h-10 border border-slate-200 rounded-xl px-3 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                    <Button variant="outline" onClick={exportCSV} className="gap-2 h-10 border-slate-200 rounded-xl font-bold text-xs">
                        <Download size={16} />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="hidden md:block bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Region</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                                        Loading data...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        No volunteers found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((vol) => {
                                    const statusVal = vol.status || 'pending';
                                    const isPending = statusVal === 'pending';

                                    return (
                                        <tr key={vol.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-slate-900">{vol.full_name}</td>
                                            <td className="px-6 py-4 text-slate-500">
                                                <div className="font-medium text-slate-700">{vol.email}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{vol.phone}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="status-badge px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 capitalize shrink-0">
                                                    {vol.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 font-medium">{vol.department}</td>
                                            <td className="px-6 py-4 text-slate-600">{vol.region}</td>
                                            <td className="px-6 py-4">
                                                <span className={`status-badge px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize shrink-0
                                                    ${statusVal === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                      statusVal === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                                      'bg-amber-50 border-amber-100 text-amber-700'}
                                                `}>
                                                    {statusVal}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {new Date(vol.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isPending ? (
                                                    <div className="flex gap-1.5 justify-end items-center">
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white font-bold"
                                                            onClick={() => handleApprove(vol.id)}
                                                            disabled={isSubmitting}
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white font-bold"
                                                            onClick={() => handleRejectClick(vol.id)}
                                                            disabled={isSubmitting}
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card List View (Visible only below 768px) */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="bg-white border rounded-xl p-6 text-center text-slate-500 shadow-sm">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2 text-orange-500" />
                        Loading data...
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="bg-white border rounded-xl p-6 text-center text-slate-500 shadow-sm">
                        No volunteers found.
                    </div>
                ) : (
                    filteredData.map((vol) => {
                        const statusVal = vol.status || 'pending';
                        const isPending = statusVal === 'pending';

                        return (
                            <div key={vol.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3 text-sm">
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-base text-slate-900 leading-tight">{vol.full_name}</h4>
                                    <span className={`status-badge px-2.5 py-0.5 rounded-full text-[11px] font-bold border capitalize shrink-0 whitespace-nowrap
                                        ${statusVal === 'confirmed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                          statusVal === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' :
                                          'bg-amber-50 border-amber-100 text-amber-700'}
                                    `}>
                                        {statusVal}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="status-badge px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 capitalize shrink-0 whitespace-nowrap">
                                        {vol.role}
                                    </span>
                                    <span className="text-slate-600 font-semibold">{vol.department}</span>
                                </div>

                                <div className="space-y-0.5 text-slate-500 text-xs">
                                    <div className="font-medium text-slate-700 break-all">{vol.email}</div>
                                    <div>{vol.phone}</div>
                                </div>

                                <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                                    <span>Region: <strong className="text-slate-700 font-semibold">{vol.region}</strong></span>
                                    <span>{new Date(vol.created_at).toLocaleDateString()}</span>
                                </div>

                                {isPending && (
                                    <div className="flex gap-2 pt-2 border-t border-slate-100 w-full">
                                        <Button
                                            size="sm"
                                            className="flex-1 h-9 text-xs bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg cursor-pointer active:scale-95 transition-all"
                                            onClick={() => handleApprove(vol.id)}
                                            disabled={isSubmitting}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="flex-1 h-9 text-xs bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg cursor-pointer active:scale-95 transition-all"
                                            onClick={() => handleRejectClick(vol.id)}
                                            disabled={isSubmitting}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
