import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Download, Search, Loader2, Users, CheckCircle2, 
  AlertCircle, MapPin, CreditCard, UserCheck, Trash2
} from 'lucide-react';
import { LAGOS_REGIONS, OGUN_REGIONS } from "@/constants";
import { useDialog } from '../ui/DialogProvider';

interface Registration {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  region: string;
  province: string;
  category: string;
  amount_due: number;
  payment_method: string;
  payment_reference?: string;
  payment_status?: string;
  status: string;
  checked_in: boolean;
  checked_in_at?: string;
  rejection_reason?: string;
  batch_reference: string;
}

export default function RegistrationTable() {
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { confirm, toast } = useDialog();

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
      setData(regs as Registration[]);
    }
    setLoading(false);
  }

  async function updateRegistration(id: string, updates: Record<string, any>) {
    const res = await fetch('/api/admin/update-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'C3TC@admin2026',
      },
      body: JSON.stringify({ id, updates }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }
    return res.json();
  }

  async function handleMarkAsCleared(id: string) {
    const { confirmed } = await confirm({
      type: 'success',
      title: 'Confirm Payment Clearance',
      body: 'Are you sure you want to mark this payment as cleared? The registrant will receive a confirmation email.',
      confirmText: 'Yes, Clear Payment'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await updateRegistration(id, {
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      } : r));

      toast.success('Payment cleared successfully', 'Confirmation email sent to registrant');
      fetchRegistrations();
    } catch (err: any) {
      console.error(err);
      toast.error('Error clearing registration', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkAsPaid(id: string) {
    const { confirmed } = await confirm({
      type: 'success',
      title: 'Mark as Paid',
      body: 'Confirm that this delegate has paid at the gate.',
      confirmText: 'Confirm Payment'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await updateRegistration(id, {
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      } : r));

      toast.success('Payment recorded', 'Delegate cleared for entry');
      fetchRegistrations();
    } catch (err: any) {
      console.error(err);
      toast.error('Error updating payment', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCheckIn(id: string, fullName: string) {
    const { confirmed } = await confirm({
      type: 'primary',
      title: 'Check In Delegate',
      body: 'Confirm that this delegate is present at the venue and mark them as checked in.',
      confirmText: 'Confirm Check In'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await updateRegistration(id, {
        checked_in: true,
        checked_in_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        checked_in: true,
        checked_in_at: new Date().toISOString()
      } : r));

      toast.success('Delegate checked in', `${fullName} has been marked as present`);
      fetchRegistrations();
    } catch (err: any) {
      console.error(err);
      toast.error('Error checking in', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRejectClick(id: string) {
    const { confirmed, value: reason } = await confirm({
      type: 'danger',
      title: 'Reject Payment',
      body: 'This registrant will be notified that their payment could not be verified.',
      showInput: true,
      placeholder: 'Reason for rejection (optional)',
      confirmText: 'Reject Payment'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await updateRegistration(id, {
        status: 'rejected',
        payment_status: 'rejected',
        rejection_reason: reason?.trim() || '',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'rejected',
        payment_status: 'rejected',
        rejection_reason: reason?.trim() || '',
        cleared_by: 'admin',
        cleared_at: new Date().toISOString()
      } : r));

      toast.error('Registration rejected', 'Registrant has been notified');
      fetchRegistrations();
    } catch (err: any) {
      console.error(err);
      toast.error('Error rejecting payment', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Helper to categorize regions
  const getRegionGroup = (regionStr: string) => {
    if (!regionStr) return 'Other';
    if (LAGOS_REGIONS.includes(regionStr) || regionStr.toLowerCase().includes('lagos')) {
      return 'Lagos';
    }
    if (OGUN_REGIONS.includes(regionStr) || regionStr.toLowerCase().includes('ogun')) {
      return 'Ogun';
    }
    return 'Other';
  };

  // Metrics (computed from all registrations fetched)
  const totalRegistered = data.length;
  const totalCleared = data.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    return ps === 'cleared' || st === 'confirmed';
  }).length;
  const totalPending = data.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    return ps === 'pending' || st === 'pending_payment' || st === 'pending_verification';
  }).length;
  const totalPayOnArrival = data.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    return ps === 'pay_on_arrival' || st === 'pay_on_arrival';
  }).length;
  const totalAmountCollected = data.reduce((sum, r) => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    const isCleared = ps === 'cleared' || st === 'confirmed';
    return isCleared ? sum + (Number(r.amount_due) || 0) : sum;
  }, 0);

  // Filters application
  const filteredData = data.filter(r => {
    // 1. Search term match
    const matchesSearch = !searchTerm.trim() || (
      r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.batch_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.payment_reference?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. Status filter match
    const payStatus = r.payment_status?.toLowerCase() || '';
    const status = r.status?.toLowerCase() || '';
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = payStatus === 'pending' || status === 'pending_payment' || status === 'pending_verification';
    } else if (statusFilter === 'cleared') {
      matchesStatus = payStatus === 'cleared' || status === 'confirmed';
    } else if (statusFilter === 'pay_on_arrival') {
      matchesStatus = payStatus === 'pay_on_arrival' || status === 'pay_on_arrival';
    }

    // 3. Category filter match
    const c = r.category?.toLowerCase() || '';
    let matchesCategory = true;
    if (categoryFilter === 'teenager') {
      matchesCategory = c === 'teenager';
    } else if (categoryFilter === 'teacher') {
      matchesCategory = c === 'teacher' || c === 'teacher_adult' || c === 'teacher / adult' || c.includes('teacher');
    }

    // 4. Region filter match
    const regionGroup = getRegionGroup(r.region);
    let matchesRegion = true;
    if (regionFilter !== 'all') {
      matchesRegion = regionGroup === regionFilter;
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesRegion;
  });

  function exportCSV() {
    const headers = [
      'Reference Code', 'Full Name', 'Region', 'Province', 'Category', 
      'Amount Due', 'Payment Method', 'Payment Reference', 'Payment Status', 'Checked In', 'Date Registered'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(r => [
        `"${r.batch_reference || ''}"`, 
        `"${r.full_name || ''}"`, 
        `"${r.region || ''}"`, 
        `"${r.province || ''}"`, 
        `"${r.category || ''}"`, 
        r.amount_due || 0,
        `"${r.payment_method || ''}"`, 
        `"${r.payment_reference || ''}"`, 
        `"${r.payment_status || r.status || ''}"`, 
        r.checked_in ? 'Yes' : 'No',
        `"${new Date(r.created_at).toLocaleDateString()}"`
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
    <div className="space-y-6">
      
      {/* Dashboard Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Card 1: Registered */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
          <CardContent className="p-3 md:p-4 flex flex-row items-center gap-3 w-full">
            <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
              <Users size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Registered">Registered</p>
              <h3 className="text-sm md:text-xl font-black text-slate-800 mt-0.5 whitespace-nowrap">{totalRegistered.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        {/* Card 2: Cleared */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
          <CardContent className="p-3 md:p-4 flex flex-row items-center gap-3 w-full">
            <div className="p-2 md:p-3 bg-emerald-50 text-emerald-500 rounded-xl shrink-0">
              <CheckCircle2 size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Cleared">Cleared</p>
              <h3 className="text-sm md:text-xl font-black text-emerald-600 mt-0.5 whitespace-nowrap">{totalCleared.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        {/* Card 3: Pending */}
        <Card className="col-span-1 md:col-span-2 lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
          <CardContent className="p-3 md:p-4 flex flex-row items-center gap-3 w-full">
            <div className="p-2 md:p-3 bg-orange-50 text-orange-500 rounded-xl shrink-0">
              <AlertCircle size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Pending">Pending</p>
              <h3 className="text-sm md:text-xl font-black text-orange-600 mt-0.5 whitespace-nowrap">{totalPending.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        {/* Card 4: On Arrival */}
        <Card className="col-span-1 md:col-span-3 lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
          <CardContent className="p-3 md:p-4 flex flex-row items-center gap-3 w-full">
            <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
              <MapPin size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="On Arrival">On Arrival</p>
              <h3 className="text-sm md:text-xl font-black text-blue-600 mt-0.5 whitespace-nowrap">{totalPayOnArrival.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        {/* Card 5: Collected */}
        <Card className="col-span-2 md:col-span-3 lg:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
          <CardContent className="p-3 md:p-4 flex flex-row items-center gap-3 w-full">
            <div className="p-2 md:p-3 bg-violet-50 text-violet-500 rounded-xl shrink-0">
              <CreditCard size={16} className="md:w-5 md:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap" title="Collected">Collected</p>
              <h3 className="text-sm md:text-xl font-black text-violet-600 font-mono mt-0.5 whitespace-nowrap">₦{totalAmountCollected.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters block */}
      <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Search reference, name, payment ref..."
              className="pl-10 h-10 border-slate-200 rounded-xl"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
              <option value="pay_on_arrival">Pay on Arrival</option>
            </select>
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Categories</option>
              <option value="teenager">Teenager</option>
              <option value="teacher">Teacher / Adult</option>
            </select>
          </div>
          <div>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="w-full h-10 border border-slate-200 rounded-xl px-3 bg-white text-sm text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Regions</option>
              <option value="Lagos">Lagos</option>
              <option value="Ogun">Ogun</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Matching Registrations: {filteredData.length}
          </p>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2 h-9 text-xs font-bold border-zinc-200 rounded-xl">
            <Download size={14} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Ref Code</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Full Name</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Region</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Province</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Category</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Amt Due</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Method</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Payment Ref</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Date</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">Check In</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                    Loading data...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                    No registrations found.
                  </td>
                </tr>
              ) : (
                filteredData.map((reg) => {
                  const isCleared = reg.payment_status?.toLowerCase() === 'cleared' || reg.status?.toLowerCase() === 'confirmed';
                  const isPending = reg.payment_status?.toLowerCase() === 'pending' || reg.status?.toLowerCase() === 'pending_payment' || reg.status?.toLowerCase() === 'pending_verification';
                  const isArrival = reg.payment_status?.toLowerCase() === 'pay_on_arrival' || reg.status?.toLowerCase() === 'pay_on_arrival';
                  const isRejected = reg.status?.toLowerCase() === 'rejected' || reg.payment_status?.toLowerCase() === 'rejected';
                  const isCheckInDisabled = isRejected || !isCleared;
                  const checkInTooltip = isRejected 
                    ? "Cannot check in — registration rejected" 
                    : !isCleared 
                      ? "Payment must be cleared before check-in" 
                      : undefined;

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-mono font-bold text-xs text-orange-600">{reg.batch_reference}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900">{reg.full_name}</td>
                      <td className="px-4 py-4 text-slate-600 truncate max-w-[100px]">{reg.region}</td>
                      <td className="px-4 py-4 text-slate-500 truncate max-w-[120px]" title={reg.province}>{reg.province || '-'}</td>
                      <td className="px-4 py-4 text-xs">
                        <span className={`px-2 py-0.5 rounded font-semibold capitalize ${
                          reg.category?.toLowerCase() === 'teenager' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {reg.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold">₦{Number(reg.amount_due || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-xs text-slate-600 capitalize">
                        {reg.payment_method?.replace('_', ' ') || 'Bank Transfer'}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500 font-bold bg-slate-50/50 border-l border-r border-slate-100">
                        {reg.payment_reference || '-'}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize border
                          ${isCleared ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                            isPending ? 'bg-orange-50 border-orange-100 text-orange-700' :
                            isArrival ? 'bg-blue-50 border-blue-100 text-blue-700' :
                            'bg-red-50 border-red-100 text-red-700'}
                        `}>
                          {reg.payment_status || reg.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {reg.checked_in ? (
                          <div className="mx-auto flex items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded text-xs w-fit font-bold">
                            <span>Checked In ✓</span>
                          </div>
                        ) : (
                          <div title={checkInTooltip} className="inline-block">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-bold border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleCheckIn(reg.id, reg.full_name)}
                              disabled={isCheckInDisabled || isSubmitting}
                            >
                              Check In
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex gap-1.5 justify-end items-center">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white font-bold"
                                onClick={() => handleMarkAsCleared(reg.id)}
                                disabled={isSubmitting}
                              >
                                Clear
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white font-bold"
                                onClick={() => handleRejectClick(reg.id)}
                                disabled={isSubmitting}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {isArrival && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                              onClick={() => handleMarkAsPaid(reg.id)}
                              disabled={isSubmitting}
                            >
                              Mark as Paid
                            </Button>
                          )}
                          {!isPending && !isArrival && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="py-12 text-center text-slate-500">
            <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
            Loading registrations...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed rounded-xl bg-white">
            No registrations found matching filters.
          </div>
        ) : (
          filteredData.map((reg) => {
            const isCleared = reg.payment_status?.toLowerCase() === 'cleared' || reg.status?.toLowerCase() === 'confirmed';
            const isPending = reg.payment_status?.toLowerCase() === 'pending' || reg.status?.toLowerCase() === 'pending_payment' || reg.status?.toLowerCase() === 'pending_verification';
            const isArrival = reg.payment_status?.toLowerCase() === 'pay_on_arrival' || reg.status?.toLowerCase() === 'pay_on_arrival';
            const isRejected = reg.status?.toLowerCase() === 'rejected' || reg.payment_status?.toLowerCase() === 'rejected';
            const isCheckInDisabled = isRejected || !isCleared;
            const checkInTooltip = isRejected 
              ? "Cannot check in — registration rejected" 
              : !isCleared 
                ? "Payment must be cleared before check-in" 
                : undefined;

            return (
              <div key={reg.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                    {reg.batch_reference}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border
                    ${isCleared ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      isPending ? 'bg-orange-50 border-orange-200 text-orange-700' :
                      isArrival ? 'bg-blue-50 border-blue-200 text-blue-700' :
                      'bg-red-50 border-red-200 text-red-700'}
                  `}>
                    {reg.payment_status || reg.status?.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <h4 className="font-bold text-slate-900 text-base">{reg.full_name}</h4>
                  <p className="text-xs text-slate-400">{reg.province || 'No Province Specified'}</p>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs border-t border-b border-slate-100 py-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Region</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block">{reg.region}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Province</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block">{reg.province || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Category</span>
                    <span className={`inline-block font-semibold mt-0.5 rounded px-1.5 py-0.5 text-[10px] ${
                      reg.category?.toLowerCase() === 'teenager' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                      {reg.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Amount Due</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">₦{Number(reg.amount_due || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Payment Method</span>
                    <span className="font-semibold text-slate-700 mt-0.5 block capitalize">{reg.payment_method?.replace('_', ' ') || 'Bank Transfer'}</span>
                  </div>
                  {reg.payment_reference && (
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Payment Ref</span>
                      <span className="font-mono text-slate-700 bg-slate-50 border px-2 py-0.5 rounded text-[11px] font-bold w-fit mt-0.5 inline-block">{reg.payment_reference}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Registered At</span>
                    <span className="text-slate-500 mt-0.5 block">{new Date(reg.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Check In</span>
                    {reg.checked_in ? (
                      <span className="text-emerald-600 font-bold mt-0.5 block">Checked In ✓</span>
                    ) : (
                      <span className="text-slate-400 mt-0.5 block">Not Checked In</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-1">
                  <div className="flex gap-2">
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3.5 rounded-xl"
                          onClick={() => handleMarkAsCleared(reg.id)}
                          disabled={isSubmitting}
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white font-bold px-3.5 rounded-xl"
                          onClick={() => handleRejectClick(reg.id)}
                          disabled={isSubmitting}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {isArrival && (
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 rounded-xl"
                        onClick={() => handleMarkAsPaid(reg.id)}
                        disabled={isSubmitting}
                      >
                        Mark as Paid
                      </Button>
                    )}
                  </div>

                  {!reg.checked_in ? (
                    <div title={checkInTooltip} className="inline-block">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs font-bold border-zinc-300 hover:bg-zinc-50 px-3.5 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => handleCheckIn(reg.id, reg.full_name)}
                        disabled={isCheckInDisabled || isSubmitting}
                      >
                        Check In
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                      <span>Checked In ✓</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
