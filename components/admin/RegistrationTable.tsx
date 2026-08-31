import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllSupabaseRows } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Download, Search, Loader2, Users, CheckCircle2, 
  AlertCircle, MapPin, CreditCard, UserCheck, Trash2,
  History, X, Clock, FileText, Paperclip, Eye, Zap,
  ChevronDown, Mail
} from 'lucide-react';
import { LAGOS_REGIONS, OGUN_REGIONS, REGIONS_AND_PROVINCES } from "@/constants";
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
  duplicate_acknowledged?: boolean;
  duplicate_flag_reason?: string;
}

export default function RegistrationTable() {
  const navigate = useNavigate();
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Statistics states
  interface StatsData {
    status: string;
    payment_status: string;
    payment_method: string;
    amount_due: number;
  }
  const [stats, setStats] = useState<StatsData[]>([]);

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

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch stats once on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch registrations only when filters/page changes (clean double useEffect pattern to prevent double fetching)
  useEffect(() => {
    if (page === 1) {
      fetchRegistrations();
    } else {
      setPage(1);
    }
  }, [debouncedSearchTerm, statusFilter, categoryFilter, selectedRegions]);

  useEffect(() => {
    fetchRegistrations();
  }, [page]);

  useEffect(() => {
    // Subscribe to real-time changes
    const channel = supabase
      .channel('table-registration-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
        fetchRegistrations();
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, debouncedSearchTerm, statusFilter, categoryFilter, selectedRegions]);

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

  function getFilteredQuery(selectFields: string = '*', withCountOption: boolean = false) {
    let query = supabase
      .from('registrations')
      .select(selectFields, withCountOption ? { count: 'exact' } : undefined)
      .order('created_at', { ascending: false });

    // 1. Search term match
    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.trim();
      query = query.or(`full_name.ilike.%${term}%,batch_reference.ilike.%${term}%,payment_reference.ilike.%${term}%`);
    }

    // 2. Status filter match
    if (statusFilter === 'pending') {
      query = query.or('payment_status.eq.pending,status.eq.pending_payment,status.eq.pending_verification');
    } else if (statusFilter === 'cleared') {
      query = query.or('payment_status.eq.cleared,status.eq.confirmed');
    } else if (statusFilter === 'pay_on_arrival') {
      query = query.or('payment_status.eq.pay_on_arrival,status.eq.pay_on_arrival,payment_method.eq.pay_on_arrival');
    } else if (statusFilter === 'duplicates') {
      query = query.eq('duplicate_acknowledged', true);
    }

    // 3. Category filter match
    if (categoryFilter === 'teenager') {
      query = query.eq('category', 'teenager');
    } else if (categoryFilter === 'teacher') {
      query = query.ilike('category', '%teacher%');
    }

    // 4. Region filter match
    if (selectedRegions.length > 0) {
      query = query.in('region', selectedRegions);
    }

    return query;
  }

  async function fetchRegistrations() {
    setLoading(true);
    try {
      const from = (page - 1) * 20;
      const to = from + 19;

      const { data: regs, count, error } = await getFilteredQuery('*', true).range(from, to);

      if (!error && regs) {
        setData(regs as Registration[]);
        setTotalCount(count || 0);
      } else if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Failed to load registrations:', err);
      toast.error('Error Loading Registrations', err.message || 'Database query failed.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStats() {
    try {
      const statsData = await fetchAllSupabaseRows(() =>
        supabase
          .from('registrations')
          .select('status, payment_status, payment_method, amount_due')
      );
      if (statsData) {
        setStats(statsData as StatsData[]);
      }
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    }
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
      fetchStats();
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
      fetchStats();
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
      fetchStats();
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
      fetchStats();
    } catch (err: any) {
      console.error(err);
      toast.error('Error rejecting payment', err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendEmail(id: string, email: string, name: string) {
    if (!email || !email.trim()) {
      toast.error('Cannot Resend Email', 'This registrant does not have a valid email address.');
      return;
    }

    const { confirmed } = await confirm({
      type: 'primary',
      title: 'Resend Confirmation Email',
      body: `Are you sure you want to resend the confirmation email to ${name} (${email})?`,
      confirmText: 'Resend Email'
    });
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'C3TC@admin2026'
        },
        body: JSON.stringify({ id, type: 'delegate', performed_by: volunteer })
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.error || `HTTP error ${res.status}`);
      }

      toast.success('Email Resent Successfully', `Confirmation email sent to ${email}`);

      if (historyRegistrant && historyRegistrant.id === id) {
        const { data: logs } = await supabase
          .from('audit_log')
          .select('*')
          .eq('registration_id', id)
          .order('created_at', { ascending: false });
        if (logs) setHistoryLogs(logs);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error Resending Email', err.message || 'Failed to resend email.');
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

  // Metrics (computed from all registrations fetched via stats query)
  const totalRegistered = stats.length;
  const totalCleared = stats.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    return ps === 'cleared' || st === 'confirmed';
  }).length;
  const totalPending = stats.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    return ps === 'pending' || st === 'pending_payment' || st === 'pending_verification';
  }).length;
  const totalPayOnArrival = stats.filter(r => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    const pm = r.payment_method?.toLowerCase();
    return ps === 'pay_on_arrival' || st === 'pay_on_arrival' || pm === 'pay_on_arrival';
  }).length;
  const totalAmountCollected = stats.reduce((sum, r) => {
    const ps = r.payment_status?.toLowerCase();
    const st = r.status?.toLowerCase();
    const isCleared = ps === 'cleared' || st === 'confirmed';
    return isCleared ? sum + (Number(r.amount_due) || 0) : sum;
  }, 0);

  console.log('Registration Pagination State:', { currentPage: page, totalPages: Math.ceil(totalCount / 20), totalCount });

  async function exportCSV() {
    try {
      const exportData = await fetchAllSupabaseRows(() =>
        getFilteredQuery().order('created_at', { ascending: false })
      );
      if (!exportData || exportData.length === 0) {
        toast.error('No Data', 'No records match your filters to export.');
        return;
      }

      const headers = [
        'Reference Code', 'Full Name', 'Region', 'Province', 'Category', 
        'Amount Due', 'Payment Method', 'Payment Reference', 'Payment Status', 'Checked In', 'Date Registered'
      ];
      const csvContent = [
        headers.join(','),
        ...exportData.map(r => [
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
    } catch (err: any) {
      console.error('Failed to export CSV:', err);
      toast.error('Export Failed', err.message || 'Database query failed.');
    }
  }

  async function exportPDF() {
    try {
      const rawExportData = await fetchAllSupabaseRows<Registration>(() =>
        getFilteredQuery().order('created_at', { ascending: false })
      );
      
      const records = rawExportData || [];

      // Helper for Category ordering: Teenager (1) MUST come before Teacher (2) before Others (3)
      const getCategoryRank = (cat: string) => {
        const c = (cat || '').toLowerCase().trim();
        if (c.includes('teenager') || c.includes('teen')) return 1;
        if (c.includes('teacher')) return 2;
        return 3;
      };

      // Helper to identify non-regional bucket entries (e.g. 'Other (Outside Lagos/Ogun)')
      const isOtherRegion = (name: string) => {
        const n = (name || '').toLowerCase().trim();
        return n.includes('other') || n.includes('outside lagos') || n.includes('unspecified');
      };

      // Build authoritative Province -> Region lookup from REGIONS_AND_PROVINCES in constants.tsx
      const provinceToRegionMap: Map<string, string> = new Map();
      for (const [regKey, provList] of Object.entries(REGIONS_AND_PROVINCES)) {
        for (const prov of provList) {
          provinceToRegionMap.set(prov.trim().toLowerCase(), regKey);
        }
      }

      // Helper function to resolve the true authoritative Region for a record based on constants.tsx
      const getAuthoritativeRegion = (r: Registration) => {
        if (r.province) {
          const matchedReg = provinceToRegionMap.get(r.province.trim().toLowerCase());
          if (matchedReg) return matchedReg;
        }
        return r.region || '';
      };

      // Determine target regions to include in the executive report
      let targetRegionNames: string[] = [];
      if (selectedRegions.length > 0) {
        targetRegionNames = selectedRegions.filter(r => !isOtherRegion(r));
      } else {
        const predefinedRegions = Object.keys(REGIONS_AND_PROVINCES);
        const actualRegions = records.map(r => getAuthoritativeRegion(r)).filter(Boolean);
        targetRegionNames = Array.from(new Set([...predefinedRegions, ...allRegions, ...actualRegions]))
          .filter(r => !isOtherRegion(r));
      }

      // Sort region names using numerical-aware comparator
      targetRegionNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      // Map records by authoritative region (excluding non-regional 'Other' bucket)
      const recordsByRegion: Map<string, Registration[]> = new Map();
      for (const regName of targetRegionNames) {
        recordsByRegion.set(regName, []);
      }
      for (const record of records) {
        const rName = getAuthoritativeRegion(record);
        if (isOtherRegion(rName)) continue;
        if (!recordsByRegion.has(rName)) {
          recordsByRegion.set(rName, []);
        }
        recordsByRegion.get(rName)!.push(record);
      }

      const exportDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
      const PROVINCE_TARGET = 40; // Benchmark target per province

      // Generate HTML per Region
      const regionSectionsHtml = Array.from(recordsByRegion.entries()).map(([regionName, regRecords], regionIndex) => {
        // Sort delegates in this region: PROVINCE -> CATEGORY (Teenager first) -> FULL NAME
        const sortedRegRecords = [...regRecords].sort((a, b) => {
          // 1. Province (Numerical-aware)
          const provA = a.province || 'Unspecified Province';
          const provB = b.province || 'Unspecified Province';
          const provComp = provA.localeCompare(provB, undefined, { numeric: true, sensitivity: 'base' });
          if (provComp !== 0) return provComp;

          // 2. Category (Teenager first, then Teacher)
          const catRankA = getCategoryRank(a.category);
          const catRankB = getCategoryRank(b.category);
          if (catRankA !== catRankB) return catRankA - catRankB;

          // 3. Full Name (A to Z)
          const nameA = (a.full_name || '').trim();
          const nameB = (b.full_name || '').trim();
          return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
        });

        const totalRegionalDelegates = sortedRegRecords.length;

        let teenagerCount = 0;
        let teacherCount = 0;
        let otherCategoryCount = 0;
        let clearedCount = 0;
        let pendingCount = 0;

        for (const r of sortedRegRecords) {
          const catRank = getCategoryRank(r.category);
          if (catRank === 1) teenagerCount++;
          else if (catRank === 2) teacherCount++;
          else otherCategoryCount++;

          const isCleared = r.payment_status?.toLowerCase() === 'cleared' || r.status?.toLowerCase() === 'confirmed';
          if (isCleared) clearedCount++;
          else pendingCount++;
        }

        // Determine all provinces strictly belonging to this region (predefined + actual)
        const predefinedProvinces = REGIONS_AND_PROVINCES[regionName] || [];
        const actualProvinces = sortedRegRecords.map(r => r.province).filter(Boolean);
        const allProvincesForRegion = Array.from(new Set([...predefinedProvinces, ...actualProvinces]))
          .filter(prov => {
            const matchedReg = provinceToRegionMap.get(prov.trim().toLowerCase());
            return !matchedReg || matchedReg === regionName;
          });
        allProvincesForRegion.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // Map stats per province
        const provinceStatsMap: Map<string, { total: number; teenagers: number; teachers: number; cleared: number; pending: number }> = new Map();
        for (const prov of allProvincesForRegion) {
          provinceStatsMap.set(prov, { total: 0, teenagers: 0, teachers: 0, cleared: 0, pending: 0 });
        }

        for (const r of sortedRegRecords) {
          const provName = r.province || 'Unspecified Province';
          if (!provinceStatsMap.has(provName)) {
            provinceStatsMap.set(provName, { total: 0, teenagers: 0, teachers: 0, cleared: 0, pending: 0 });
          }
          const pData = provinceStatsMap.get(provName)!;
          pData.total++;
          const catRank = getCategoryRank(r.category);
          if (catRank === 1) pData.teenagers++;
          else if (catRank === 2) pData.teachers++;
          const isCleared = r.payment_status?.toLowerCase() === 'cleared' || r.status?.toLowerCase() === 'confirmed';
          if (isCleared) pData.cleared++;
          else pData.pending++;
        }

        const distinctProvincesCount = allProvincesForRegion.length;
        const regionalTarget = distinctProvincesCount * PROVINCE_TARGET;
        const regionalTargetPct = regionalTarget > 0 ? Math.round((totalRegionalDelegates / regionalTarget) * 100) : 0;
        const regionalGap = Math.max(0, regionalTarget - totalRegionalDelegates);

        // Provincial Breakdown Rows HTML
        const provinceRowsHtml = Array.from(provinceStatsMap.entries()).map(([provName, pData]) => {
          const provPct = Math.round((pData.total / PROVINCE_TARGET) * 100);
          const provGap = Math.max(0, PROVINCE_TARGET - pData.total);
          const gapText = provGap > 0 ? `${provGap} short` : 'Target Met';

          return `
            <tr style="${pData.total === 0 ? 'background-color: #fafafa;' : ''}">
              <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 700; color: ${pData.total === 0 ? '#94a3b8' : '#0f172a'};">${provName}</td>
              <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 800; color: ${pData.total === 0 ? '#94a3b8' : '#0f172a'};">${pData.total}</td>
              <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #475569;">${pData.teenagers} / ${pData.teachers}</td>
              <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b;">${PROVINCE_TARGET}</td>
              <td style="padding: 7px 10px; border-bottom: 1px solid #f1f5f9; text-align: center;">
                <span style="font-weight: 700; ${provGap > 0 ? 'color: #d97706;' : 'color: #059669;'}">${provPct}% (${gapText})</span>
              </td>
            </tr>
          `;
        }).join('');

        // Delegate Rows HTML
        let delegateRowsHtml = '';
        if (sortedRegRecords.length > 0) {
          delegateRowsHtml = sortedRegRecords.map((r, idx) => {
            const isCleared = r.payment_status?.toLowerCase() === 'cleared' || r.status?.toLowerCase() === 'confirmed';
            const statusClass = isCleared ? 'status-cleared' : 'status-pending';
            const statusLabel = isCleared ? 'Cleared' : 'Pending';

            return `
              <tr>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px; color: #64748b; font-weight: 600; text-align: center;">${idx + 1}</td>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px; font-weight: 700; color: #0f172a;">${r.full_name || ''}</td>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px;">
                  <span class="category-badge ${r.category?.toLowerCase() === 'teenager' ? 'badge-teen' : 'badge-teacher'}">${r.category || ''}</span>
                </td>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px; color: #334155; font-weight: 500;">${r.province || '-'}</td>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px;">
                  <span class="status-badge ${statusClass}">${statusLabel}</span>
                </td>
                <td style="border-bottom: 1px solid #f1f5f9; padding: 7px 8px; color: #64748b; white-space: nowrap;">${new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            `;
          }).join('');
        } else {
          delegateRowsHtml = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 18px; color: #94a3b8; font-style: italic; font-weight: 600; background-color: #fafafa; border-bottom: 1px solid #f1f5f9;">
                No delegates registered yet for ${regionName}.
              </td>
            </tr>
          `;
        }

        return `
          <div class="region-section ${regionIndex > 0 ? 'page-break' : ''}">
            <!-- Region Header -->
            <div class="region-header">
              <div>
                <span class="org-subtitle">C3TC T.I.M.E '26 — Regional Executive Report</span>
                <h1 class="region-name">${regionName}</h1>
              </div>
              <div class="header-meta">
                <div class="meta-label">Export Date</div>
                <div class="meta-value">${exportDate}</div>
              </div>
            </div>

            <!-- Regional Summary Cards Grid -->
            <div class="summary-cards-grid">
              <div class="summary-card card-primary">
                <div class="card-label">Total Delegates</div>
                <div class="card-value">${totalRegionalDelegates}</div>
              </div>
              <div class="summary-card">
                <div class="card-label">Category Breakdown</div>
                <div class="card-value-sm">
                  <span style="color: #ea580c; font-weight: 800;">${teenagerCount}</span> Teenagers
                  <span style="color: #94a3b8; margin: 0 3px;">•</span>
                  <span style="color: #2563eb; font-weight: 800;">${teacherCount}</span> Teachers
                </div>
              </div>
              <div class="summary-card">
                <div class="card-label">Status Breakdown</div>
                <div class="card-value-sm">
                  <span style="color: #059669; font-weight: 800;">${clearedCount}</span> Cleared
                  <span style="color: #94a3b8; margin: 0 3px;">•</span>
                  <span style="color: #d97706; font-weight: 800;">${pendingCount}</span> Pending
                </div>
              </div>
              <div class="summary-card card-target">
                <div class="card-label">Region Target vs Performance</div>
                <div class="card-value-sm" style="font-size: 13px;">
                  <strong>${totalRegionalDelegates}</strong> / <strong>${regionalTarget}</strong> (${regionalTargetPct}%)
                </div>
                <div class="card-subtext">
                  ${regionalGap > 0 ? `<span style="color: #dc2626; font-weight: 700;">${regionalGap} delegates to target</span>` : '<span style="color: #059669; font-weight: 700;">Target Achieved!</span>'}
                </div>
              </div>
            </div>

            <!-- Provincial Performance Distribution Table -->
            <div style="margin-bottom: 16px;">
              <div class="section-subtitle">Provincial Performance Distribution (${distinctProvincesCount} Provinces | Target: 40 per Province)</div>
              <table class="prov-table">
                <thead>
                  <tr>
                    <th style="text-align: left;">Province Name</th>
                    <th style="text-align: center;">Registered</th>
                    <th style="text-align: center;">Teenagers / Teachers</th>
                    <th style="text-align: center;">Target</th>
                    <th style="text-align: center;">Performance vs Target</th>
                  </tr>
                </thead>
                <tbody>
                  ${provinceRowsHtml}
                </tbody>
              </table>
            </div>

            <!-- Regional Delegate List Table -->
            <div>
              <div class="section-subtitle">REGIONAL DELEGATE LIST (${totalRegionalDelegates})</div>
              <table class="delegate-table">
                <thead>
                  <tr>
                    <th style="width: 32px; text-align: center;">#</th>
                    <th>Full Name</th>
                    <th>Category</th>
                    <th>Province</th>
                    <th>Payment Status</th>
                    <th>Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  ${delegateRowsHtml}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>C3TC Regional Registration Report</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
              
              * {
                box-sizing: border-box;
              }

              body {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
                color: #0f172a;
                padding: 24px;
                background-color: #ffffff;
                margin: 0;
                line-height: 1.35;
              }

              .page-break {
                page-break-before: always;
                break-before: page;
                margin-top: 24px;
              }

              .region-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                border-bottom: 3px solid #f97316;
                padding-bottom: 10px;
                margin-bottom: 16px;
              }

              .org-subtitle {
                font-size: 9px;
                font-weight: 800;
                color: #ea580c;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                display: block;
                margin-bottom: 2px;
              }

              .region-name {
                font-size: 22px;
                font-weight: 800;
                color: #0f172a;
                margin: 0;
                letter-spacing: -0.5px;
              }

              .header-meta {
                text-align: right;
              }

              .meta-label {
                font-size: 8.5px;
                font-weight: 700;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }

              .meta-value {
                font-size: 11px;
                font-weight: 700;
                color: #334155;
              }

              .summary-cards-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 16px;
              }

              .summary-card {
                background-color: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 8px 12px;
              }

              .card-primary {
                background-color: #fff7ed;
                border-color: #ffedd5;
              }

              .card-target {
                background-color: #f0fdf4;
                border-color: #dcfce7;
              }

              .card-label {
                font-size: 8.5px;
                font-weight: 800;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
              }

              .card-value {
                font-size: 18px;
                font-weight: 800;
                color: #0f172a;
              }

              .card-value-sm {
                font-size: 12px;
                font-weight: 700;
                color: #1e293b;
                margin-top: 2px;
              }

              .card-subtext {
                font-size: 9.5px;
                font-weight: 600;
                color: #64748b;
                margin-top: 1px;
              }

              .section-subtitle {
                font-size: 10px;
                font-weight: 800;
                color: #334155;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
              }

              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 9.5px;
                text-align: left;
              }

              .prov-table {
                margin-bottom: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                overflow: hidden;
              }

              .prov-table th {
                background-color: #f1f5f9;
                color: #334155;
                font-weight: 700;
                padding: 6px 10px;
                font-size: 8.5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid #cbd5e1;
              }

              .delegate-table th {
                background-color: #f8fafc;
                color: #475569;
                font-weight: 700;
                border-bottom: 2px solid #cbd5e1;
                padding: 7px 8px;
                text-transform: uppercase;
                font-size: 8.5px;
                letter-spacing: 0.5px;
              }

              .category-badge {
                font-size: 8.5px;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-block;
                text-transform: capitalize;
              }

              .badge-teen {
                background-color: #fff7ed;
                color: #c2410c;
                border: 1px solid #ffedd5;
              }

              .badge-teacher {
                background-color: #eff6ff;
                color: #1d4ed8;
                border: 1px solid #dbeafe;
              }

              .status-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 8px;
                font-weight: 800;
                text-transform: uppercase;
              }

              .status-cleared { background-color: #d1fae5; color: #065f46; }
              .status-pending { background-color: #fef3c7; color: #92400e; }

              @media print {
                body { padding: 0.6cm; }
                @page { size: A4 portrait; margin: 0.6cm; }
                tr { page-break-inside: avoid; }
                .page-break { page-break-before: always; break-before: page; }
              }
            </style>
          </head>
          <body>
            ${regionSectionsHtml}
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
    } catch (err: any) {
      console.error('Failed to export PDF:', err);
      toast.error('Export Failed', err.message || 'Database query failed.');
    }
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
                <option value="duplicates">Flagged Duplicates</option>
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
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    No registrations found matching filters.
                  </td>
                </tr>
              ) : (
                data.map((reg) => {
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
                      <td className="px-4 py-4 text-slate-900 font-bold truncate max-w-[120px]" title={reg.full_name}>
                        <div className="flex flex-col gap-0.5">
                          <span>{reg.full_name}</span>
                          {reg.duplicate_acknowledged && (
                            <span className="inline-flex items-center gap-1 w-fit bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase leading-none">
                              ⚠️ Dup
                            </span>
                          )}
                        </div>
                      </td>
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-orange-200 text-orange-600 hover:bg-orange-50 font-bold flex items-center gap-1 cursor-pointer"
                            onClick={() => handleResendEmail(reg.id, reg.email, reg.full_name)}
                            disabled={isSubmitting}
                            title="Resend Confirmation Email"
                          >
                            <Mail size={13} />
                            Resend Email
                          </Button>
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
        ) : data.length === 0 ? (
          <div className="py-12 text-center text-slate-500 border border-dashed rounded-xl bg-white">
            No registrations found matching filters.
          </div>
        ) : (
          data.map((reg) => {
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
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-base">{reg.full_name}</h4>
                    {reg.duplicate_acknowledged && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase leading-none">
                        ⚠️ Dup
                      </span>
                    )}
                  </div>
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

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs font-semibold text-slate-500">
          <span className="hidden sm:inline">
            Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, totalCount)} of {totalCount} records
          </span>
          <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="h-11 sm:h-8 rounded-lg border-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center min-w-[80px]"
            >
              Previous
            </Button>
            <span className="px-2 text-slate-700 font-bold whitespace-nowrap text-center flex-1 sm:flex-initial">
              Page {page} of {Math.ceil(totalCount / 20)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.min(Math.ceil(totalCount / 20), prev + 1))}
              disabled={page === Math.ceil(totalCount / 20)}
              className="h-11 sm:h-8 rounded-lg border-slate-200 text-slate-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center min-w-[80px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}

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

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleResendEmail(historyRegistrant.id, historyRegistrant.email, historyRegistrant.full_name)}
              disabled={isSubmitting}
              className="w-full mb-4 border-orange-200 text-orange-700 bg-orange-50/80 hover:bg-orange-100 font-bold flex items-center justify-center gap-2 h-10 rounded-xl cursor-pointer shrink-0"
            >
              <Mail size={15} />
              Resend Confirmation Email
            </Button>

            {historyRegistrant.duplicate_acknowledged && (
              <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-xs flex gap-2.5 animate-in fade-in slide-in-from-top-2">
                <span className="text-base select-none leading-none">⚠️</span>
                <div>
                  <p className="font-bold text-amber-950">Flagged Duplicate Acknowledged</p>
                  <p className="mt-1 font-semibold leading-relaxed text-amber-900">
                    {historyRegistrant.duplicate_flag_reason || 'No details provided.'}
                  </p>
                </div>
              </div>
            )}

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
                  } else if (log.action === 'email_resent') {
                      statusColor = "bg-orange-500 text-white";
                      actionText = "Confirmation Email Resent";
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
