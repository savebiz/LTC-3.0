
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Loader2 } from 'lucide-react';

export default function VolunteerTable() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredData = data.filter(r =>
        r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.department?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function exportCSV() {
        const headers = ['Full Name', 'Email', 'Phone', 'Role', 'Department', 'Region'];
        const csvContent = [
            headers.join(','),
            ...filteredData.map(r => [
                `"${r.full_name}"`, r.email, r.phone, r.role, `"${r.department}"`, `"${r.region}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ltc_volunteers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold font-heading text-slate-800">Volunteers ({filteredData.length})</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="Search name, dept..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" onClick={exportCSV} className="gap-2">
                        <Download size={18} />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 border-b text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Role</th>
                                <th className="px-6 py-4">Department</th>
                                <th className="px-6 py-4">Region</th>
                                <th className="px-6 py-4">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                                        Loading data...
                                    </td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        No volunteers found.
                                    </td>
                                </tr>
                            ) : (
                                filteredData.map((vol) => (
                                    <tr key={vol.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">{vol.full_name}</td>
                                        <td className="px-6 py-4 text-slate-500">
                                            <div>{vol.email}</div>
                                            <div className="text-xs">{vol.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                {vol.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700">{vol.department}</td>
                                        <td className="px-6 py-4 text-slate-600">{vol.region}</td>
                                        <td className="px-6 py-4 text-slate-400">
                                            {new Date(vol.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
