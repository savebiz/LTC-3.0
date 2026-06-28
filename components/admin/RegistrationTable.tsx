import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Download, Search, Loader2, Users, CheckCircle2, 
  AlertCircle, MapPin, CreditCard, UserCheck, Trash2,
  History, X, Clock, FileText, Paperclip, Eye, Zap,
  ChevronDown
} from 'lucide-react';
import { LAGOS_REGIONS, OGUN_REGIONS } from "@/constants";
import { useDialog } from '../ui/DialogProvider';

const allRegions = [...LAGOS_REGIONS, ...OGUN_REGIONS, "Other (Outside Lagos/Ogun)"];

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
  receipt_url?: string;
}

export default function RegistrationTable() {
  const navigate = useNavigate();
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt view state
  const [previewRegistration, setPreviewRegistration] = useState<Registration | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const isPdf = previewRegistration?.receipt_url ? previewRegistration.receipt_url.toLowerCase().split('?')[0].endsWith('.pdf') : false;


  // Volunteer session identity
  const volunteer = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_volunteer') || 'admin' : 'admin';

  // Audit history states
  const [historyRegistrant, setHistoryRegistrant] = useState<Registration | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const { confirm, toast } = useDialog();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(event.target as Node)) {
        setIsRegionDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchRegistrations();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('table-registration-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
        fetchRegistrations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch registrant history trail when sliding panel opens
  useEffect(() => {
    async function fetchHistory() {
      if (!historyRegistrant) return;
      setHistoryLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from('audit_log')
          .select('*')
          .eq('registration_id', historyRegistrant.id)
          .order('created_at', { ascending: false });
        if (!error && logs) {
          setHistoryLogs(logs);
        } else {
          setHistoryLogs([]);
        }
      } catch (err) {
        console.error('Failed to fetch history logs:', err);
        setHistoryLogs([]);
      } finally {
        setHistoryLoading(false);
      }
    }

    fetchHistory();
  }, [historyRegistrant]);

  const handleShowHistory = (registrant: Registration) => {
    setHistoryRegistrant(registrant);
  };

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
      body: JSON.stringify({ id, updates, performed_by: volunteer }),
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
        cleared_by: volunteer,
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: volunteer,
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
        cleared_by: volunteer,
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        payment_status: 'cleared',
        status: 'confirmed',
        cleared_by: volunteer,
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
        cleared_by: volunteer,
        cleared_at: new Date().toISOString()
      });

      setData(prev => prev.map(r => r.id === id ? {
        ...r,
        status: 'rejected',
        payment_status: 'rejected',
        rejection_reason: reason?.trim() || '',
        cleared_by: volunteer,
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
    const pm = r.payment_method?.toLowerCase();
    return ps === 'pay_on_arrival' || st === 'pay_on_arrival' || pm === 'pay_on_arrival';
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
      matchesStatus = payStatus === 'pay_on_arrival' || status === 'pay_on_arrival' || r.payment_method?.toLowerCase() === 'pay_on_arrival';
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
    let matchesRegion = true;
    if (selectedRegions.length > 0) {
      matchesRegion = selectedRegions.includes(r.region);
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

  function exportPDF() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const regionsText = selectedRegions.length > 0 ? selectedRegions.join(', ') : 'All Regions';
    const exportDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const totalAmount = filteredData.reduce((sum, r) => sum + (Number(r.amount_due) || 0), 0);

    const rows = filteredData.map(r => {
      const isCleared = r.payment_status?.toLowerCase() === 'cleared' || r.status?.toLowerCase() === 'confirmed';
      const isPending = r.payment_status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'pending_payment' || r.status?.toLowerCase() === 'pending_verification';
      const isArrival = r.payment_status?.toLowerCase() === 'pay_on_arrival' || r.status?.toLowerCase() === 'pay_on_arrival' || r.payment_method?.toLowerCase() === 'pay_on_arrival';
      const isRejected = r.status?.toLowerCase() === 'rejected' || r.payment_status?.toLowerCase() === 'rejected';
      
      let statusClass = 'status-pending';
      let statusLabel = r.payment_status || r.status || 'Pending';
      if (isCleared) {
        statusClass = 'status-cleared';
        statusLabel = 'Cleared';
      } else if (isArrival) {
        statusClass = 'status-arrival';
        statusLabel = 'Pay on Arrival';
      } else if (isRejected) {
        statusClass = 'status-rejected';
        statusLabel = 'Rejected';
      } else if (isPending) {
        statusClass = 'status-pending';
        statusLabel = 'Pending';
      }

      return `
        <tr>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;"><span class="ref-code">${r.batch_reference || ''}</span></td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-weight: bold; color: #0f172a;">${r.full_name || ''}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;"><span class="category-badge">${r.category || ''}</span></td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">${r.region || ''}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">${r.province || '-'}</td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px;">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
          </td>
          <td style="border-bottom: 1px solid #e2e8f0; padding: 10px 8px; color: #64748b;">${new Date(r.created_at).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>C3TC Registration List</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            
            body {
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              padding: 40px;
              background-color: #ffffff;
              margin: 0;
            }
            
            .header-container {
              border-bottom: 2px solid #f1f5f9;
              padding-bottom: 16px;
              margin-bottom: 24px;
            }
            
            h1 {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 6px 0;
              letter-spacing: -0.5px;
            }
            
            .meta-grid {
              display: grid;
              grid-template-columns: 3fr 1fr;
              gap: 15px;
              font-size: 12px;
              color: #64748b;
            }
            
            .meta-label {
              font-weight: 700;
              color: #94a3b8;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
            }
            
            .meta-value {
              font-weight: 600;
              color: #334155;
              margin-top: 2px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 11px;
              text-align: left;
            }
            
            th {
              background-color: #f8fafc;
              color: #475569;
              font-weight: 700;
              border-bottom: 2px solid #e2e8f0;
              padding: 10px 8px;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.5px;
            }
            
            .ref-code {
              font-family: monospace;
              font-weight: 700;
              color: #ea580c;
              font-size: 12px;
            }
            
            .category-badge {
              font-weight: 600;
              text-transform: capitalize;
            }
            
            .status-badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 6px;
              font-size: 9px;
              font-weight: 700;
              text-transform: uppercase;
              border: 1px solid transparent;
            }
            
            .status-cleared { background-color: #ecfdf5; border-color: #d1fae5; color: #065f46; }
            .status-pending { background-color: #fff7ed; border-color: #ffedd5; color: #9a3412; }
            .status-arrival { background-color: #eff6ff; border-color: #dbeafe; color: #1e40af; }
            .status-rejected { background-color: #fef2f2; border-color: #fee2e2; color: #991b1b; }
            
            .footer-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 2px solid #f1f5f9;
              padding-top: 20px;
              margin-top: 20px;
            }
            
            .footer-card {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              padding: 12px 24px;
              min-width: 150px;
            }
            
            .footer-label {
              font-size: 10px;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .footer-value {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 4px;
            }
            
            @media print {
              body { padding: 0; }
              @page { size: A4 landscape; margin: 1.2cm; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <h1>C3TC T.I.M.E '26 — Registration List</h1>
            <div class="meta-grid">
              <div>
                <div class="meta-label">Selected Region(s)</div>
                <div class="meta-value">${regionsText}</div>
              </div>
              <div style="text-align: right;">
                <div class="meta-label">Export Date</div>
                <div class="meta-value">${exportDate}</div>
              </div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ref Code</th>
                <th>Full Name</th>
                <th>Category</th>
                <th>Region</th>
                <th>Province</th>
                <th>Payment Status</th>
                <th>Registration Date</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="footer-container">
            <div class="footer-card">
              <div class="footer-label">Total Delegates</div>
              <div class="footer-value">${filteredData.length}</div>
            </div>
            <div class="footer-card" style="text-align: right;">
              <div class="footer-label">Total Amount Due</div>
              <div class="footer-value" style="font-family: monospace;">₦${totalAmount.toLocaleString()}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const handleClearFromModal = async () => {
    if (!previewRegistration) return;
    const regId = previewRegistration.id;
    setPreviewRegistration(null);
    await handleMarkAsCleared(regId);
  };

  const handleRejectFromModal = async () => {
    if (!previewRegistration) return;
    const regId = previewRegistration.id;
    setPreviewRegistration(null);
    await handleRejectClick(regId);
  };

  return (
    <div className="space-y-6">
      
      {/* Event Day Express Registration Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md animate-in slide-in-from-top duration-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl shrink-0">
            <Zap size={20} className="animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-sm sm:text-base">Event Day? Use Express Registration</h4>
            <p className="text-xs text-orange-50/90 mt-0.5">Quickly register and check in walk-in delegates at Channel C in under 60 seconds.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/express-register')}
          className="w-full sm:w-auto bg-white text-orange-600 hover:bg-orange-50 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition-colors border-0 cursor-pointer shrink-0"
        >
          Express Register →
        </button>
      </div>

      {/* Dashboard Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Card 1: Registered */}
        <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
          <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
            <Users size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="mt-2 w-full">
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Registered</p>
            <h3 className="text-lg md:text-2xl font-black text-blue-600 mt-1">{totalRegistered.toLocaleString()}</h3>
          </div>
        </Card>

        {/* Card 2: Cleared */}
        <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
          <div className="p-2 md:p-3 bg-emerald-50 text-emerald-500 rounded-xl shrink-0">
            <CheckCircle2 size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="mt-2 w-full">
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Cleared</p>
            <h3 className="text-lg md:text-2xl font-black text-emerald-600 mt-1">{totalCleared.toLocaleString()}</h3>
          </div>
        </Card>

        {/* Card 3: Pending */}
        <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
          <div className="p-2 md:p-3 bg-orange-50 text-orange-500 rounded-xl shrink-0">
            <AlertCircle size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="mt-2 w-full">
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Pending</p>
            <h3 className="text-lg md:text-2xl font-black text-orange-600 mt-1">{totalPending.toLocaleString()}</h3>
          </div>
        </Card>

        {/* Card 4: On Arrival */}
        <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
          <div className="p-2 md:p-3 bg-blue-50 text-blue-500 rounded-xl shrink-0">
            <CreditCard size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="mt-2 w-full">
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">On Arrival</p>
            <h3 className="text-lg md:text-2xl font-black text-blue-600 mt-1">{totalPayOnArrival.toLocaleString()}</h3>
          </div>
        </Card>

        {/* Card 5: Collected */}
        <Card className="col-span-2 sm:col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
          <div className="p-2 md:p-3 bg-violet-50 text-violet-500 rounded-xl shrink-0">
            <CreditCard size={16} className="md:w-5 md:h-5" />
          </div>
          <div className="mt-2 w-full">
            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Collected</p>
            <h3 className="font-black text-violet-600 font-mono mt-1 whitespace-nowrap block" style={{ fontSize: 'clamp(0.85rem, 2vw, 1.5rem)', whiteSpace: 'nowrap' }}>
              ₦{totalAmountCollected.toLocaleString()}
            </h3>
          </div>
        </Card>
      </div>

      {/* Search & Filters block */}
      <div className="bg-white border rounded-2xl p-4 shadow-sm space-y-4 overflow-visible">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          
          {/* Main search and filters grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:flex lg:flex-1 gap-3 items-center w-full">
            
            {/* Search */}
            <div className="relative col-span-1 sm:col-span-2 md:col-span-2 lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input
                placeholder="Search reference, name, payment ref..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-11 border-slate-200 rounded-xl bg-slate-50/50 w-full"
              />
            </div>

            {/* Status */}
            <div className="col-span-1 lg:flex-1 lg:min-w-[140px]">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full h-11 border rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none"
              >
                <option value="all">All Payments</option>
                <option value="pending">Pending Verification</option>
                <option value="cleared">Cleared Payments</option>
                <option value="pay_on_arrival">Pay on Arrival</option>
              </select>
            </div>

            {/* Category */}
            <div className="col-span-1 lg:flex-1 lg:min-w-[140px]">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full h-11 border rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none"
              >
                <option value="all">All Categories</option>
                <option value="teenager">Teenagers</option>
                <option value="teacher">Teachers / Adults</option>
              </select>
            </div>

            {/* Multi-select Region Dropdown */}
            <div className="col-span-1 lg:flex-1 lg:min-w-[180px] relative" ref={regionDropdownRef}>
              <button
                type="button"
                onClick={() => setIsRegionDropdownOpen(!isRegionDropdownOpen)}
                className="w-full h-11 border rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">
                  {selectedRegions.length === 0 
                    ? "All Regions" 
                    : selectedRegions.length === 1 
                      ? selectedRegions[0] 
                      : `Regions (${selectedRegions.length})`}
                </span>
                <ChevronDown size={16} className="text-slate-500 shrink-0 ml-1" />
              </button>

              {isRegionDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 space-y-2 animate-in fade-in duration-100">
                  <div className="flex gap-2 justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedRegions([])}
                      className="text-blue-600 hover:underline font-bold border-0 bg-transparent cursor-pointer"
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRegions([...allRegions])}
                      className="text-blue-600 hover:underline font-bold border-0 bg-transparent cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  <Input
                    placeholder="Search region..."
                    value={regionSearch}
                    onChange={e => setRegionSearch(e.target.value)}
                    className="h-8 text-xs px-2 border-slate-200 rounded-lg"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {allRegions
                      .filter(r => r.toLowerCase().includes(regionSearch.toLowerCase()))
                      .map(r => {
                        const isChecked = selectedRegions.includes(r);
                        return (
                          <label key={r} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedRegions(prev => prev.filter(item => item !== r));
                                } else {
                                  setSelectedRegions(prev => [...prev, r]);
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                            />
                            <span className="truncate">{r}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Export buttons wrapper */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={exportCSV}
                className="h-11 w-11 shrink-0 p-0 border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer"
                title="Export CSV"
              >
                <Download size={18} />
              </Button>
              <Button
                variant="outline"
                onClick={exportPDF}
                className="h-11 w-11 shrink-0 p-0 border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl flex items-center justify-center cursor-pointer"
                title="Export PDF"
              >
                <FileText size={18} />
              </Button>
            </div>

          </div>

        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                <th className="py-4 px-4">Ref Code</th>
                <th className="py-4 px-4">Full Name</th>
                <th className="py-4 px-4">Region</th>
                <th className="py-4 px-4">Province</th>
                <th className="py-4 px-4">Category</th>
                <th className="py-4 px-4">Amt Due</th>
                <th className="py-4 px-4">Method</th>
                <th className="py-4 px-4">Payment Ref</th>
                <th className="py-4 px-4">Status</th>
                <th className="py-4 px-4">Date</th>
                <th className="py-4 px-4 text-center">Check In</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" />
                    Loading registrations...
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    No registrations found matching filters.
                  </td>
                </tr>
              ) : (
                filteredData.map((reg) => {
                  const isCleared = reg.payment_status?.toLowerCase() === 'cleared' || reg.status?.toLowerCase() === 'confirmed';
                  const isPending = reg.payment_status?.toLowerCase() === 'pending' || reg.status?.toLowerCase() === 'pending_payment' || reg.status?.toLowerCase() === 'pending_verification';
                  const isArrival = reg.payment_status?.toLowerCase() === 'pay_on_arrival' || reg.status?.toLowerCase() === 'pay_on_arrival' || reg.payment_method?.toLowerCase() === 'pay_on_arrival';
                  const isRejected = reg.status?.toLowerCase() === 'rejected' || reg.payment_status?.toLowerCase() === 'rejected';
                  const isCheckInDisabled = isRejected || !isCleared;
                  const checkInTooltip = isRejected 
                    ? "Cannot check in — registration rejected" 
                    : !isCleared 
                      ? "Payment must be cleared before check-in" 
                      : undefined;

                  return (
                    <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors text-slate-700 text-xs font-semibold">
                      <td className="px-4 py-4 font-mono font-bold text-orange-600">{reg.batch_reference}</td>
                      <td className="px-4 py-4 text-slate-900 font-bold truncate max-w-[120px]" title={reg.full_name}>{reg.full_name}</td>
                      <td className="px-4 py-4 text-slate-600 truncate max-w-[100px]">{reg.region}</td>
                      <td className="px-4 py-4 text-slate-500 truncate max-w-[120px]" title={reg.province}>{reg.province || '-'}</td>
                      <td className="px-4 py-4 text-xs">
                        <span className={`px-2 py-0.5 rounded font-semibold capitalize ${
                          reg.category?.toLowerCase() === 'teenager' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {reg.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold whitespace-nowrap">₦{Number(reg.amount_due || 0).toLocaleString()}</td>
                      <td className="px-4 py-4 text-xs text-slate-600 capitalize">
                        {reg.payment_method?.replace('_', ' ') || 'Bank Transfer'}
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500 font-bold bg-slate-50/50 border-l border-r border-slate-100">
                        {reg.payment_reference || '-'}
                      </td>
                      <td className="px-4 py-4 text-xs">
                        <span className={`status-badge px-2 py-1 rounded-full text-xs font-semibold capitalize border shrink-0
                          ${isArrival ? 'bg-blue-50 border-blue-100 text-blue-700' :
                            isCleared ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                            isPending ? 'bg-orange-50 border-orange-100 text-orange-700' :
                            'bg-red-50 border-red-100 text-red-700'}
                        `}>
                          {isArrival ? 'Pay on Arrival' : (reg.payment_status || reg.status?.replace('_', ' '))}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {reg.checked_in ? (
                          <div className="status-badge mx-auto flex items-center justify-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded text-xs w-fit font-bold shrink-0">
                            <span>Checked In ✓</span>
                          </div>
                        ) : (
                          <div title={checkInTooltip} className="inline-block">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-bold border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 font-bold flex items-center gap-1 cursor-pointer"
                            onClick={() => handleShowHistory(reg)}
                            title="View History"
                          >
                            <History size={13} />
                            History
                          </Button>
                          {reg.receipt_url && reg.receipt_url.length > 0 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 font-bold flex items-center gap-1 cursor-pointer"
                              onClick={() => {
                                setPreviewRegistration(reg);
                                setIsZoomed(false);
                              }}
                              title="View Payment Receipt"
                            >
                              <Paperclip size={13} />
                              View Receipt
                            </Button>
                          ) : (
                            <span className="h-7 px-2.5 rounded-md text-[11px] font-bold text-slate-400 bg-slate-100 flex items-center justify-center cursor-not-allowed shrink-0 select-none whitespace-nowrap">
                              No Receipt
                            </span>
                          )}
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white font-bold cursor-pointer"
                                onClick={() => handleMarkAsCleared(reg.id)}
                                disabled={isSubmitting}
                              >
                                Clear
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-red-500 hover:bg-red-600 text-white font-bold cursor-pointer"
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
                              className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                              onClick={() => handleMarkAsPaid(reg.id)}
                              disabled={isSubmitting}
                            >
                              Mark as Paid
                            </Button>
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
            const isArrival = reg.payment_status?.toLowerCase() === 'pay_on_arrival' || reg.status?.toLowerCase() === 'pay_on_arrival' || reg.payment_method?.toLowerCase() === 'pay_on_arrival';
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
                  <span className={`status-badge px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0
                    ${isArrival ? 'bg-blue-50 border-blue-200 text-blue-700' :
                      isCleared ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      isPending ? 'bg-orange-50 border-orange-200 text-orange-700' :
                      'bg-red-50 border-red-200 text-red-700'}
                  `}>
                    {isArrival ? 'Pay on Arrival' : (reg.payment_status || reg.status?.replace('_', ' '))}
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
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-slate-700 capitalize">{reg.payment_method?.replace('_', ' ') || 'Bank Transfer'}</span>
                      {reg.receipt_url && reg.receipt_url.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewRegistration(reg);
                            setIsZoomed(false);
                          }}
                          className="inline-flex items-center justify-center p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg active:scale-95 transition-all cursor-pointer"
                          title="View Receipt"
                        >
                          <Paperclip size={14} className="text-blue-500" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center justify-center p-1 text-slate-300 cursor-not-allowed select-none" title="No Receipt">
                          <Paperclip size={14} />
                        </span>
                      )}
                    </div>
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

                {(() => {
                  const buttonItems: { id: string; render: (isIconOnly: boolean) => React.ReactNode }[] = [];
                  
                  // 1. History
                  buttonItems.push({
                    id: 'history',
                    render: (isIconOnly: boolean) => (
                      <Button
                        key="history"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-slate-200 text-slate-500 hover:bg-slate-50 font-bold rounded-xl flex items-center justify-center gap-1 cursor-pointer w-full"
                        onClick={() => handleShowHistory(reg)}
                      >
                        <History size={12} className="shrink-0" />
                        {!isIconOnly && <span className="whitespace-nowrap font-bold">History</span>}
                      </Button>
                    )
                  });

                  // 2. Clear (if pending)
                  if (isPending) {
                    buttonItems.push({
                      id: 'clear',
                      render: () => (
                        <Button
                          key="clear"
                          size="sm"
                          className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl cursor-pointer w-full flex items-center justify-center whitespace-nowrap"
                          onClick={() => handleMarkAsCleared(reg.id)}
                          disabled={isSubmitting}
                        >
                          Clear
                        </Button>
                      )
                    });
                  }

                  // 3. Reject (if pending)
                  if (isPending) {
                    buttonItems.push({
                      id: 'reject',
                      render: () => (
                        <Button
                          key="reject"
                          size="sm"
                          className="h-8 text-xs bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl cursor-pointer w-full flex items-center justify-center whitespace-nowrap"
                          onClick={() => handleRejectClick(reg.id)}
                          disabled={isSubmitting}
                        >
                          Reject
                        </Button>
                      )
                    });
                  }

                  // 4. Paid (if arrival)
                  if (isArrival) {
                    buttonItems.push({
                      id: 'paid',
                      render: () => (
                        <Button
                          key="paid"
                          size="sm"
                          className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer w-full flex items-center justify-center whitespace-nowrap"
                          onClick={() => handleMarkAsPaid(reg.id)}
                          disabled={isSubmitting}
                        >
                          Paid
                        </Button>
                      )
                    });
                  }

                  // 5. Check In / Checked In
                  if (!reg.checked_in) {
                    buttonItems.push({
                      id: 'checkin',
                      render: () => (
                        <Button
                          key="checkin"
                          size="sm"
                          variant="outline"
                          title={checkInTooltip}
                          className="h-8 text-xs font-bold border-zinc-300 hover:bg-zinc-50 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer w-full flex items-center justify-center whitespace-nowrap"
                          onClick={() => handleCheckIn(reg.id, reg.full_name)}
                          disabled={isCheckInDisabled || isSubmitting}
                        >
                          Check In
                        </Button>
                      )
                    });
                  } else {
                    buttonItems.push({
                      id: 'checkedin',
                      render: () => (
                        <Button
                          key="checkedin"
                          size="sm"
                          className="h-8 text-xs bg-[#22c55e] hover:bg-[#22c55e] border border-[#22c55e] text-white font-bold rounded-xl w-full flex items-center justify-center gap-1.5 shrink-0 select-none whitespace-nowrap pointer-events-none cursor-default"
                        >
                          Checked In ✓
                        </Button>
                      )
                    });
                  }

                  const count = buttonItems.length;
                  if (count === 2) {
                    return (
                      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-100 w-full">
                        {buttonItems[0].render(false)}
                        {buttonItems[1].render(false)}
                      </div>
                    );
                  }
                  if (count === 3) {
                    return (
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100 w-full">
                        {buttonItems[0].render(true)}
                        {buttonItems[1].render(false)}
                        {buttonItems[2].render(false)}
                      </div>
                    );
                  }
                  if (count === 4) {
                    return (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 w-full">
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          {buttonItems[0].render(false)}
                          {buttonItems[3].render(false)}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          {buttonItems[1].render(false)}
                          {buttonItems[2].render(false)}
                        </div>
                      </div>
                    );
                  }
                  if (count >= 5) {
                    return (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 w-full">
                        <div className="grid grid-cols-3 gap-1.5 w-full">
                          {buttonItems[0].render(true)}
                          {buttonItems[1].render(false)}
                          {buttonItems[2].render(false)}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          {buttonItems[3].render(false)}
                          {buttonItems[4].render(false)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Slide-in History Panel */}
      {historyRegistrant && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" onClick={() => setHistoryRegistrant(null)} />
          
          {/* Panel Content */}
          <div className="relative history-panel w-[100vw] max-w-[100vw] md:w-full md:max-w-lg bg-white h-full shadow-2xl flex flex-col px-4 py-6 md:p-6 overflow-y-auto animate-in slide-in-from-right duration-300 z-10 border-l border-slate-200 overflow-x-hidden">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-lg text-slate-800 break-words whitespace-normal">Registration History</h3>
                <p className="text-xs text-slate-500 font-semibold break-all whitespace-normal">{historyRegistrant.full_name} ({historyRegistrant.batch_reference})</p>
              </div>
              <button 
                onClick={() => setHistoryRegistrant(null)} 
                className="text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer shrink-0 h-11 w-11 flex items-center justify-center"
                title="Close panel"
              >
                <X size={22} />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 gap-2 text-slate-400">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                <span className="text-xs font-semibold">Loading history logs...</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                <Clock className="h-8 w-8 text-slate-300 mb-2" />
                <span className="text-xs font-medium">No actions logged for this registrant.</span>
              </div>
            ) : (
              <div className="flex-1 space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {historyLogs.map((log) => {
                  let statusColor = "bg-slate-550 border-slate-650 text-white";
                  let actionText = log.action;

                  if (log.action === 'payment_cleared') {
                      statusColor = "bg-emerald-500 text-white";
                      actionText = "Payment Cleared";
                  } else if (log.action === 'check_in_success') {
                      statusColor = "bg-emerald-500 text-white";
                      actionText = "Checked In Successfully";
                  } else if (log.action === 'registration_created') {
                      statusColor = "bg-blue-500 text-white";
                      actionText = "Registration Created";
                  } else if (log.action === 'payment_rejected') {
                      statusColor = "bg-red-500 text-white";
                      actionText = "Payment Rejected";
                  } else if (log.action === 'check_in_blocked_rejected') {
                      statusColor = "bg-red-500 text-white";
                      actionText = "Check-in Blocked (Rejected Status)";
                  } else if (log.action === 'check_in_blocked_pending') {
                      statusColor = "bg-amber-500 text-white";
                      actionText = "Check-in Blocked (Pending Status)";
                  } else if (log.action === 'check_in_duplicate') {
                      statusColor = "bg-amber-500 text-white";
                      actionText = "Duplicate Check-in Attempted";
                  } else if (log.action === 'db_update') {
                      statusColor = "bg-slate-400 text-white";
                      actionText = "Database Row Updated";
                  }

                  return (
                    <div key={log.id} className="flex gap-3 relative overflow-hidden">
                      {/* Timeline dot */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-4 border-white font-bold text-[10px] ${statusColor}`}>
                        •
                      </div>

                      {/* Timeline Content */}
                      <div className="flex-1 bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-2xl space-y-2 shadow-sm min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/60 pb-1.5">
                          <span className="font-bold text-xs text-slate-800 break-words whitespace-normal">{actionText}</span>
                          <span className="text-[10px] font-semibold text-slate-400 break-words whitespace-normal">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <p className="text-slate-600 break-words whitespace-normal"><strong>Operator:</strong> <span className="font-bold text-slate-800">{log.performed_by}</span></p>
                          {log.notes && (
                            <p className="text-slate-500 italic mt-1 font-medium bg-slate-100/50 p-1.5 rounded-lg border border-slate-200/30 break-words whitespace-normal">
                              Note: {log.notes}
                            </p>
                          )}
                          {log.device_info && (
                            <p 
                              className="text-[10px] text-slate-400 break-words whitespace-normal" 
                              title={log.device_info}
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              Device: {log.device_info}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewRegistration && previewRegistration.receipt_url && previewRegistration.receipt_url.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" onClick={() => setPreviewRegistration(null)} />
          
          {/* Modal Content */}
          <div className={`relative bg-white w-full max-h-[95vh] rounded-2xl shadow-2xl flex flex-col p-4 md:p-6 overflow-hidden animate-in zoom-in-95 duration-200 z-10 border border-slate-200 ${isPdf ? 'max-w-md md:max-w-[900px]' : 'max-w-4xl'}`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="min-w-0 pr-2">
                <h3 className="font-bold text-lg text-slate-800 break-words">Payment Receipt Preview</h3>
                <p className="text-xs text-slate-500 font-semibold break-all">
                  {previewRegistration.full_name} ({previewRegistration.batch_reference})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewRegistration.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer ${isPdf ? 'hidden md:inline-flex' : ''}`}
                  title="Open in new tab"
                >
                  <Download size={14} />
                  Open in New Tab
                </a>
                <button 
                  onClick={() => setPreviewRegistration(null)} 
                  className="text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer h-10 w-10 flex items-center justify-center border-0 bg-transparent shrink-0"
                  title="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 bg-slate-50 rounded-xl overflow-y-auto flex items-center justify-center p-4 min-h-0 border border-slate-100">
              {isPdf ? (
                <div className="w-full flex flex-col items-center gap-4">
                  {/* Desktop View: Iframe Preview */}
                  <iframe 
                    src={`${previewRegistration.receipt_url}#toolbar=0&navpanes=0&view=FitH`} 
                    className="hidden md:block w-full h-[70vh] rounded-lg" 
                    style={{ border: 'none', width: '100%' }}
                    title="Receipt PDF Preview"
                  />
                  {/* Mobile View: Single Button to open native viewer */}
                  <button
                    type="button"
                    onClick={() => window.open(previewRegistration.receipt_url, '_blank')}
                    className="block md:hidden w-full h-12 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-xl shadow-md transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer border-0"
                  >
                    📄 Open Receipt
                  </button>
                </div>
              ) : (
                <img 
                  src={previewRegistration.receipt_url} 
                  alt="Payment Receipt" 
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={`object-contain rounded-lg shadow-sm transition-all duration-200 cursor-pointer select-none ${
                    isZoomed ? 'w-full max-h-none' : 'max-w-full max-h-[50vh]'
                  }`}
                  title={isZoomed ? "Click to shrink" : "Click to zoom"}
                />
              )}
            </div>

            {/* Context Info (Below the receipt) */}
            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Registrant Name</span>
                <span className="text-slate-900 font-bold break-words">{previewRegistration.full_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Batch Reference</span>
                <span className="text-slate-900 font-mono font-bold break-all">{previewRegistration.batch_reference}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Payment Reference</span>
                <span className="text-slate-900 font-mono font-bold break-all">{previewRegistration.payment_reference || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Amount Due</span>
                <span className="text-slate-900 font-bold">₦{previewRegistration.amount_due.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions at the bottom of the modal (Clear/Reject) */}
            {['pending', 'pending_verification', 'pending_payment'].includes(previewRegistration.payment_status?.toLowerCase() || '') && (
              <div className={`flex gap-3 mt-4 pt-4 border-t border-slate-100 ${isPdf ? 'flex-col md:flex-row' : 'flex-row'}`}>
                <Button
                  onClick={handleClearFromModal}
                  disabled={isSubmitting}
                  className="flex-1 h-11 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md cursor-pointer active:scale-95 transition-all text-xs sm:text-sm"
                >
                  Clear Payment
                </Button>
                <Button
                  onClick={handleRejectFromModal}
                  disabled={isSubmitting}
                  className="flex-1 h-11 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md cursor-pointer active:scale-95 transition-all text-xs sm:text-sm"
                >
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
