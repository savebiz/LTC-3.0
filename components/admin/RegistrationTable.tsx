
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Loader2 } from 'lucide-react';

interface Registration {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  region: string;
  type: string;
  status: string;
}

export default function RegistrationTable() {
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRegistrations();
  }, []);

  async function fetchRegistrations() {
    setLoading(true);
    const { data: regs, error } = await supabase
      .from('registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && regs) {
      setData(regs);
    }
    setLoading(false);
  }

  const filteredData = data.filter(r => 
    r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function exportCSV() {
    const headers = ['Full Name', 'Email', 'Phone', 'Region', 'Type', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(r => [
        `"${r.full_name}"`, r.email, r.phone, `"${r.region}"`, r.type, r.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ltc_registrations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold font-heading text-slate-800">Registrations ({filteredData.length})</h2>
        <div className="flex gap-2 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                    placeholder="Search name, email..." 
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
                <th className="px-6 py-4">Region</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Status</th>
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
                        No registrations found.
                    </td>
                 </tr>
              ) : (
                filteredData.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{reg.full_name}</td>
                    <td className="px-6 py-4 text-slate-500">
                        <div>{reg.email}</div>
                        <div className="text-xs">{reg.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{reg.region}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize
                            ${reg.type === 'delegate' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
                        `}>
                            {reg.type}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize
                            ${reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 
                              reg.status === 'checked_in' ? 'bg-slate-100 text-slate-700' :
                              'bg-yellow-100 text-yellow-700'}
                        `}>
                            {reg.status.replace('_', ' ')}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                        {new Date(reg.created_at).toLocaleDateString()}
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
