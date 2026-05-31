import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/Toast';
import { 
    Search, Download, Loader2, ChevronRight, ChevronDown, 
    Calendar, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, RefreshCw
} from 'lucide-react';

interface AuditLogEntry {
    id: string;
    created_at: string;
    action: string;
    registration_id: string | null;
    batch_reference: string | null;
    registrant_name: string | null;
    performed_by: string;
    device_info: string | null;
    ip_address: string | null;
    previous_value: any;
    new_value: any;
    notes: string | null;
}

export default function AuditLogTable() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    
    // Filters and search states
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [performedByFilter, setPerformedByFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [operators, setOperators] = useState<string[]>([]);
    
    // Expanded row tracking
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    // Fetch unique operator list for dropdown filter
    async function fetchOperators() {
        try {
            const { data, error } = await supabase
                .from('audit_log')
                .select('performed_by');
            if (!error && data) {
                const unique = Array.from(new Set(data.map(d => d.performed_by)))
                    .filter(Boolean)
                    .sort();
                setOperators(unique);
            }
        } catch (err) {
            console.error('Failed to fetch operators:', err);
        }
    }

    // Fetch audit logs with pagination and filters
    async function fetchLogs() {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_log')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            // Apply search term (registrant_name or batch_reference)
            if (searchTerm.trim()) {
                const term = searchTerm.trim();
                query = query.or(`registrant_name.ilike.%${term}%,batch_reference.ilike.%${term}%`);
            }

            // Apply action grouping filters
            if (actionFilter === 'check-ins') {
                query = query.eq('action', 'check_in_success');
            } else if (actionFilter === 'payments') {
                query = query.in('action', ['payment_cleared', 'payment_rejected']);
            } else if (actionFilter === 'registrations') {
                query = query.eq('action', 'registration_created');
            } else if (actionFilter === 'blocked') {
                query = query.in('action', ['check_in_blocked_pending', 'check_in_blocked_rejected', 'check_in_duplicate']);
            } else if (actionFilter === 'system') {
                query = query.eq('action', 'db_update');
            }

            // Apply operator filter
            if (performedByFilter) {
                query = query.eq('performed_by', performedByFilter);
            }

            // Apply date filters
            if (startDate) {
                query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
            }

            // Apply pagination range (20 records per page)
            const from = (page - 1) * 20;
            const to = from + 19;
            query = query.range(from, to);

            const { data, count, error } = await query;

            if (error) throw error;
            setLogs((data as AuditLogEntry[]) || []);
            setTotalCount(count || 0);
        } catch (err: any) {
            console.error('Failed to load audit logs:', err);
            toast.error('Error Loading Logs', err.message || 'Audit trail database query failed.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchLogs();
    }, [page, actionFilter, performedByFilter, startDate, endDate]);

    useEffect(() => {
        fetchOperators();
    }, []);

    // Search input handler
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    // Toggle expand details row
    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Action color badge mapper
    const getActionBadge = (action: string) => {
        let badgeStyle = "bg-slate-100 border-slate-200 text-slate-700";
        let label = action;

        if (action === 'payment_cleared') {
            badgeStyle = "bg-emerald-50 border-emerald-100 text-emerald-700";
            label = "Payment Cleared";
        } else if (action === 'check_in_success') {
            badgeStyle = "bg-emerald-50 border-emerald-100 text-emerald-700";
            label = "Checked In ✓";
        } else if (action === 'registration_created') {
            badgeStyle = "bg-blue-50 border-blue-100 text-blue-700";
            label = "Registered";
        } else if (action === 'payment_rejected') {
            badgeStyle = "bg-red-50 border-red-100 text-red-700";
            label = "Payment Rejected";
        } else if (action === 'check_in_blocked_rejected') {
            badgeStyle = "bg-red-50 border-red-100 text-red-700";
            label = "Check-in Blocked (Rejected)";
        } else if (action === 'check_in_blocked_pending') {
            badgeStyle = "bg-amber-50 border-amber-100 text-amber-700";
            label = "Check-in Blocked (Pending)";
        } else if (action === 'check_in_duplicate') {
            badgeStyle = "bg-amber-50 border-amber-100 text-amber-700";
            label = "Duplicate Check-in Attempt";
        } else if (action === 'db_update') {
            badgeStyle = "bg-slate-100 border-slate-200 text-slate-600 font-mono";
            label = "System DB Update";
        }

        return (
            <span className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border capitalize whitespace-nowrap inline-flex items-center gap-1.5 ${badgeStyle}`}>
                {label}
            </span>
        );
    };

    // Export Filtered Logs to CSV
    async function handleExportCSV() {
        try {
            let query = supabase
                .from('audit_log')
                .select('*')
                .order('created_at', { ascending: false });

            if (searchTerm.trim()) {
                const term = searchTerm.trim();
                query = query.or(`registrant_name.ilike.%${term}%,batch_reference.ilike.%${term}%`);
            }
            if (actionFilter === 'check-ins') {
                query = query.eq('action', 'check_in_success');
            } else if (actionFilter === 'payments') {
                query = query.in('action', ['payment_cleared', 'payment_rejected']);
            } else if (actionFilter === 'registrations') {
                query = query.eq('action', 'registration_created');
            } else if (actionFilter === 'blocked') {
                query = query.in('action', ['check_in_blocked_pending', 'check_in_blocked_rejected', 'check_in_duplicate']);
            } else if (actionFilter === 'system') {
                query = query.eq('action', 'db_update');
            }
            if (performedByFilter) {
                query = query.eq('performed_by', performedByFilter);
            }
            if (startDate) {
                query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
            }
            if (endDate) {
                query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
            }

            const { data, error } = await query;
            if (error) throw error;
            if (!data || data.length === 0) {
                toast.error('No Data', 'No records match your filters to export.');
                return;
            }

            const headers = ['Timestamp', 'Action', 'Registrant Name', 'Batch Reference', 'Performed By', 'Device', 'Notes'];
            const rows = data.map(r => [
                new Date(r.created_at).toLocaleString(),
                r.action,
                r.registrant_name || 'N/A',
                r.batch_reference || 'N/A',
                r.performed_by,
                r.device_info || 'Unknown',
                r.notes || ''
            ]);

            const csvContent = [
                headers.join(','), 
                ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ltc_audit_log_${new Date().toISOString().split('T')[0]}.csv`);
            link.click();
            toast.success('Export Successful', `Exported ${data.length} audit lines.`);
        } catch (err: any) {
            console.error('Failed to export:', err);
            toast.error('Export Failed', err.message || 'CSV writing error.');
        }
    }

    const totalPages = Math.ceil(totalCount / 20);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-heading text-slate-800">System Audit Trail</h2>
                    <p className="text-sm text-slate-500">Immutable chronological record of all administrative checks and payment approvals.</p>
                </div>
                <Button
                    onClick={handleExportCSV}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-850 text-white font-bold h-11 px-5 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shrink-0"
                >
                    <Download size={16} />
                    Export CSV
                </Button>
            </div>

            {/* FILTERS & SEARCH */}
            <Card className="shadow-sm border-slate-200 bg-white rounded-2xl p-4">
                <CardContent className="p-0 space-y-4">
                    <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <Input
                                placeholder="Search registrant name or batch ref..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 border-slate-200 focus:border-orange-500 rounded-xl bg-slate-50/50 font-medium text-slate-700"
                            />
                        </div>

                        {/* Action Categories */}
                        <div className="col-span-1">
                            <select
                                value={actionFilter}
                                onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                                className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none"
                            >
                                <option value="all">All Actions</option>
                                <option value="check-ins">Check-in Success</option>
                                <option value="payments">Payment Actions</option>
                                <option value="registrations">Registrations</option>
                                <option value="blocked">Blocked Attempts</option>
                                <option value="system">System Updates</option>
                            </select>
                        </div>

                        {/* Performed By Dropdown */}
                        <div className="col-span-1">
                            <select
                                value={performedByFilter}
                                onChange={e => { setPerformedByFilter(e.target.value); setPage(1); }}
                                className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none"
                            >
                                <option value="">All Operators</option>
                                {operators.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Force Refresh */}
                        <div className="col-span-1 flex gap-2">
                            <Button 
                                type="submit"
                                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 rounded-xl cursor-pointer active:scale-95 transition-all"
                            >
                                Filter
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSearchTerm('');
                                    setActionFilter('all');
                                    setPerformedByFilter('');
                                    setStartDate('');
                                    setEndDate('');
                                    setPage(1);
                                    fetchLogs();
                                    fetchOperators();
                                }}
                                className="h-11 px-3 border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl cursor-pointer"
                                title="Reset filters"
                            >
                                <RefreshCw size={16} />
                            </Button>
                        </div>
                    </form>

                    {/* Date Picker Fields */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            <span>Date Range:</span>
                        </div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPage(1); }}
                            className="bg-slate-50 border rounded-lg px-2 py-1 text-slate-700 outline-none border-slate-200"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPage(1); }}
                            className="bg-slate-50 border rounded-lg px-2 py-1 text-slate-700 outline-none border-slate-200"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* TABLE DISPLAY */}
            <Card className="shadow-sm border-slate-200 bg-white rounded-2xl overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                            <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                            <span className="text-sm font-medium">Querying audit logs...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="py-24 text-center text-slate-400 border border-dashed rounded-b-2xl bg-slate-50/50">
                            No matching audit log entries found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-150">
                                        <th className="py-4 px-4 w-10"></th>
                                        <th className="py-4 px-4">Timestamp</th>
                                        <th className="py-4 px-4">Action</th>
                                        <th className="py-4 px-4">Registrant</th>
                                        <th className="py-4 px-4">Batch Ref</th>
                                        <th className="py-4 px-4">Performed By</th>
                                        <th className="py-4 px-4">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map((log) => {
                                        const isExpanded = !!expandedRows[log.id];
                                        return (
                                            <>
                                                <tr 
                                                    key={log.id} 
                                                    onClick={() => toggleRow(log.id)}
                                                    className="hover:bg-slate-50/50 transition-colors cursor-pointer text-slate-700 text-xs font-semibold"
                                                >
                                                    <td className="py-4 px-4">
                                                        {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                                                    </td>
                                                    <td className="py-4 px-4 text-slate-500">
                                                        {new Date(log.created_at).toLocaleString()}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {getActionBadge(log.action)}
                                                    </td>
                                                    <td className="py-4 px-4 text-slate-900 font-bold max-w-[150px] truncate" title={log.registrant_name || ''}>
                                                        {log.registrant_name || '-'}
                                                    </td>
                                                    <td className="py-4 px-4 font-mono text-slate-600 font-bold">
                                                        {log.batch_reference || '-'}
                                                    </td>
                                                    <td className="py-4 px-4 text-slate-800 font-bold">
                                                        {log.performed_by}
                                                    </td>
                                                    <td className="py-4 px-4 max-w-[200px] truncate text-slate-500" title={log.notes || ''}>
                                                        {log.notes || '-'}
                                                    </td>
                                                </tr>

                                                {/* Expanded Details Panel */}
                                                {isExpanded && (
                                                    <tr className="bg-slate-50/70 border-t-0">
                                                        <td colSpan={7} className="py-4 px-8 border-b border-slate-200">
                                                            <div className="space-y-4 text-xs font-medium">
                                                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-500 font-semibold border-b border-slate-200 pb-2">
                                                                    <span><strong>Log ID:</strong> {log.id}</span>
                                                                    <span><strong>Device:</strong> {log.device_info || 'N/A'}</span>
                                                                    <span><strong>IP Address:</strong> {log.ip_address || 'N/A'}</span>
                                                                </div>

                                                                {/* JSON DIFF COMPONENT */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Previous Values Snapshot</span>
                                                                        {log.previous_value ? (
                                                                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs overflow-auto max-h-48 font-mono border shadow-inner leading-relaxed">
                                                                                {JSON.stringify(log.previous_value, null, 2)}
                                                                            </pre>
                                                                        ) : (
                                                                            <div className="p-3 bg-slate-100 text-slate-400 rounded-xl italic border border-slate-200 font-mono text-center">
                                                                                No previous record values (creation event)
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">New Values Snapshot</span>
                                                                        {log.new_value ? (
                                                                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-xs overflow-auto max-h-48 font-mono border shadow-inner leading-relaxed">
                                                                                {JSON.stringify(log.new_value, null, 2)}
                                                                            </pre>
                                                                        ) : (
                                                                            <div className="p-3 bg-slate-100 text-slate-400 rounded-xl italic border border-slate-200 font-mono text-center">
                                                                                No new record values (deletion/block event)
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* PAGINATION PANEL */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-xs font-semibold text-slate-500">
                    <span>
                        Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, totalCount)} of {totalCount} records
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(prev => Math.max(1, prev - 1))}
                            disabled={page === 1}
                            className="h-8 rounded-lg border-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all"
                        >
                            Previous
                        </Button>
                        <span className="px-2 text-slate-700 font-bold">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={page === totalPages}
                            className="h-8 rounded-lg border-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
