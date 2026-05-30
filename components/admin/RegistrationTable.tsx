
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
  payment_status?: string;
  rejection_reason?: string;
}

export default function RegistrationTable() {
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectingReg, setRejectingReg] = useState<Registration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleApprove(id: string) {
    if (!confirm('Mark this payment as cleared?')) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          status: 'confirmed',
          payment_status: 'cleared',
          cleared_by: 'admin',
          cleared_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        alert('Error clearing registration: ' + error.message);
      } else {
        fetchRegistrations();
      }
    } catch (err: any) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectConfirm(id: string, reason: string) {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('registrations')
        .update({
          status: 'rejected',
          payment_status: 'rejected',
          rejection_reason: reason.trim() || null,
          cleared_by: 'admin',
          cleared_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        alert('Error rejecting registration: ' + error.message);
      } else {
        fetchRegistrations();
      }
    } catch (err: any) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
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
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Receipt</th>
                <th className="px-6 py-4">Actions</th>
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
                filteredData.map((reg: any) => (
                  <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{reg.full_name}</td>
                    <td className="px-6 py-4 text-slate-500">
                      <div>{reg.email}</div>
                      <div className="text-xs">{reg.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono">
                      Manual Transfer
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize
                            ${(reg.payment_status === 'cleared' || reg.status === 'confirmed') ? 'bg-green-100 text-green-700' :
                          (reg.payment_status === 'rejected' || reg.status === 'rejected') ? 'bg-red-100 text-red-700' :
                          (reg.payment_status === 'pending' || reg.status === 'pending_verification' || reg.status === 'pending_payment') ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-100 text-slate-700'}
                        `}>
                        {reg.payment_status || reg.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {reg.receipt_url ? (
                        <a href={reg.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs">
                          View Proof
                        </a>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        {(reg.status === 'pending_verification' || reg.payment_status === 'pending' || reg.status === 'pending_payment') && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white font-semibold"
                              onClick={() => handleApprove(reg.id)}
                              disabled={isSubmitting}
                            >
                              Mark as Cleared
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                              onClick={() => setRejectingReg(reg)}
                              disabled={isSubmitting}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(reg.payment_status === 'cleared' || reg.status === 'confirmed') && (
                          <span className="text-xs text-green-600 font-semibold">✓ Cleared</span>
                        )}
                        {(reg.payment_status === 'rejected' || reg.status === 'rejected') && (
                          <span className="text-xs text-red-600 font-semibold">✗ Rejected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectingReg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in duration-200 text-slate-900">
            <h3 className="text-lg font-bold">Reject Registration Payment</h3>
            <p className="text-sm text-slate-500 mt-1">
              Enter an optional reason for rejecting the payment for <strong className="text-slate-700">{rejectingReg.full_name}</strong>.
            </p>
            <div className="mt-4">
              <textarea
                placeholder="e.g. Transaction reference not found in bank statement"
                className="w-full min-h-[100px] p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectingReg(null);
                  setRejectionReason('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                onClick={async () => {
                  await handleRejectConfirm(rejectingReg.id, rejectionReason);
                  setRejectingReg(null);
                  setRejectionReason('');
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Rejecting...' : 'Reject Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
