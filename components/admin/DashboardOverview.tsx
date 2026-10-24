import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllSupabaseRows } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import {
    Users, CreditCard, CheckCircle2, TrendingUp, Award, Loader2, QrCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
}

interface Volunteer {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string;
  region: string;
  province: string;
  department: string;
  status: string;
}

export default function DashboardOverview() {
    const navigate = useNavigate();
    const [regs, setRegs] = useState<any[]>([]);
    const [vols, setVols] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendPeriod, setTrendPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

    const formatCategory = (cat: string) => {
        if (!cat) return '';
        const lowercaseCat = cat.toLowerCase();
        if (lowercaseCat.includes('teacher')) return 'Teacher / Adult';
        if (lowercaseCat === 'teenager') return 'Teenager';
        return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const getStatusLabel = (r: any) => {
        const ps = r.payment_status?.toLowerCase();
        const st = r.status?.toLowerCase();
        const pm = r.payment_method?.toLowerCase();
        if (ps === 'pay_on_arrival' || st === 'pay_on_arrival' || pm === 'pay_on_arrival') return 'Pay on Arrival';
        if (ps === 'cleared' || st === 'confirmed') return 'Cleared';
        if (ps === 'rejected' || st === 'rejected') return 'Rejected';
        if (ps === 'pending' || st === 'pending_payment' || st === 'pending_verification') return 'Pending';
        return ps || st || 'Pending';
    };

    const getStatusStyle = (r: any) => {
        const label = getStatusLabel(r);
        switch (label) {
            case 'Cleared':
                return 'bg-emerald-50 border border-emerald-100 text-emerald-700';
            case 'Pay on Arrival':
                return 'bg-blue-50 border border-blue-100 text-blue-700';
            case 'Rejected':
                return 'bg-red-50 border border-red-100 text-red-700';
            case 'Pending':
            default:
                return 'bg-amber-50 border border-amber-100 text-amber-700';
        }
    };

    useEffect(() => {
        async function loadData(showSpinner = true) {
            if (showSpinner) setLoading(true);
            try {
                // Fetch registrations independently
                try {
                    const rData = await fetchAllSupabaseRows<Registration>(() =>
                        supabase.from('registrations').select('*').order('created_at', { ascending: false })
                    );
                    if (rData) setRegs(rData);
                } catch (rErr) {
                    console.error('Error fetching registrations in overview:', rErr);
                }

                // Fetch volunteers independently
                try {
                    const vData = await fetchAllSupabaseRows<Volunteer>(() =>
                        supabase.from('volunteers').select('*').order('created_at', { ascending: false })
                    );
                    if (vData) setVols(vData);
                } catch (vErr) {
                    console.error('Error fetching volunteers in overview:', vErr);
                }
            } finally {
                if (showSpinner) setLoading(false);
            }
        }

        loadData(true);

        // Subscriptions
        const channel = supabase
            .channel('dashboard-overview-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                loadData(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, () => {
                loadData(false);
            })
            .subscribe();

        // 30-second polling fallback
        const intervalId = setInterval(() => {
            loadData(false);
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(intervalId);
        };
    }, []);

    // Compute metrics
    const totalRegs = regs.length;
    const totalRevenue = regs.reduce((sum, r) => {
        const ps = r.payment_status?.toLowerCase();
        const st = r.status?.toLowerCase();
        const isCleared = ps === 'cleared' || st === 'confirmed';
        return isCleared ? sum + (Number(r.amount_due) || 0) : sum;
    }, 0);
    const checkedInCount = regs.filter(r => r.checked_in).length;
    const checkInRate = totalRegs > 0 ? Math.round((checkedInCount / totalRegs) * 100) : 0;
    const totalVolunteers = vols.length;

    // Registration numbers for graph grouped by Daily, Weekly, or Monthly
    const getRegistrationTrendData = () => {
        const dataPoints = [];
        const now = new Date();
        
        // Formatter for "DD MMM" e.g., "01 Jun", "26 May"
        const formatDayMonth = (date: Date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = months[date.getMonth()];
            return `${day} ${month}`;
        };

        const formatMonthYear = (date: Date) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${months[date.getMonth()]} ${date.getFullYear()}`;
        };

        if (trendPeriod === 'daily') {
            const counts: Record<string, number> = {};
            regs.forEach(r => {
                if (!r.created_at) return;
                const date = new Date(r.created_at);
                const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                counts[key] = (counts[key] || 0) + 1;
            });

            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                const label = formatDayMonth(d);
                dataPoints.push({
                    date: label,
                    Registrations: counts[key] || 0
                });
            }
        } else if (trendPeriod === 'weekly') {
            const getStartOfWeek = (date: Date) => {
                const d = new Date(date);
                const day = d.getDay();
                d.setDate(d.getDate() - day);
                d.setHours(0, 0, 0, 0);
                return d;
            };

            const counts: Record<string, number> = {};
            regs.forEach(r => {
                if (!r.created_at) return;
                const date = new Date(r.created_at);
                const weekStart = getStartOfWeek(date);
                const key = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
                counts[key] = (counts[key] || 0) + 1;
            });

            const startOfCurrentWeek = getStartOfWeek(now);
            for (let i = 4; i >= 0; i--) {
                const d = new Date(startOfCurrentWeek);
                d.setDate(startOfCurrentWeek.getDate() - i * 7);
                const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                const label = formatDayMonth(d);
                dataPoints.push({
                    date: label,
                    Registrations: counts[key] || 0
                });
            }
        } else if (trendPeriod === 'monthly') {
            const counts: Record<string, number> = {};
            regs.forEach(r => {
                if (!r.created_at) return;
                const date = new Date(r.created_at);
                const key = `${date.getFullYear()}-${date.getMonth()}`;
                counts[key] = (counts[key] || 0) + 1;
            });

            for (let i = 3; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const label = formatMonthYear(d);
                dataPoints.push({
                    date: label,
                    Registrations: counts[key] || 0
                });
            }
        }

        return dataPoints;
    };

    const trendData = getRegistrationTrendData();

    const teenCount = regs.filter(r => r.category?.toLowerCase() === 'teenager').length;
    const teacherCount = regs.filter(r => {
        const cat = r.category?.toLowerCase() || '';
        return cat.includes('teacher') || cat.includes('adult');
    }).length;
    const clearedPaymentsCount = regs.filter(r => {
        const ps = r.payment_status?.toLowerCase();
        const st = r.status?.toLowerCase();
        return ps === 'cleared' || st === 'confirmed';
    }).length;

    const STATS = [
        { 
            label: "Total Registrations", 
            value: totalRegs.toLocaleString(), 
            change: `${teenCount} Teens • ${teacherCount} Teachers`, 
            icon: Users, 
            color: "text-blue-500",
            numColor: "text-blue-600"
        },
        { 
            label: "Revenue Collected", 
            value: `₦${totalRevenue.toLocaleString()}`, 
            change: `${clearedPaymentsCount} Cleared Payments`, 
            icon: CreditCard, 
            color: "text-emerald-500",
            numColor: "text-emerald-600",
            style: { fontSize: 'clamp(0.85rem, 2vw, 1.5rem)', whiteSpace: 'nowrap' }
        },
        { 
            label: "Check-in Rate", 
            value: `${checkInRate}%`, 
            change: `${checkedInCount} Delegates Checked In`, 
            icon: CheckCircle2, 
            color: "text-orange-500",
            numColor: "text-orange-600"
        },
        { 
            label: "Total Volunteers", 
            value: totalVolunteers.toLocaleString(), 
            change: "Volunteers Team", 
            icon: Award, 
            color: "text-purple-500",
            numColor: "text-purple-600"
        },
    ];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-3">
                <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                <p className="text-sm text-slate-500">Loading live analytics dashboard...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-bold font-heading text-slate-800">Dashboard Overview</h2>
                <Button
                    onClick={() => navigate('/admin/checkin')}
                    className="w-full sm:w-auto md:hidden bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-11 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <QrCode size={18} />
                    Start Check-in
                </Button>
            </div>

            {/* POST-CONFERENCE AUDITED RECONCILIATION SUMMARY */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-md border border-slate-700/60 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/50 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                            <Award className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                                    C3TC '26 Official Post-Conference Reconciled Audit
                                </h3>
                                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Audited & Final
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Consolidated report for the Conference Chairman & Continental Leadership (Reporting Date: 24 Oct 2026).
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                            Net Surplus: <strong className="text-emerald-400">+₦1,598,500</strong>
                        </span>
                    </div>
                </div>

                {/* 4 Multi-Channel Reconciled Pillars */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                            Total Registrations
                        </span>
                        <span className="text-lg sm:text-xl font-black text-white block mt-0.5">
                            4,620
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                            4,583 Base (incl. 204 Onsite) + 37 LP87
                        </span>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                            Cleared for Entry
                        </span>
                        <span className="text-lg sm:text-xl font-black text-blue-400 block mt-0.5">
                            4,463
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                            4,426 Base (incl. 204 Onsite) + 37 LP87 (96.6%)
                        </span>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                            Total Attendance
                        </span>
                        <span className="text-lg sm:text-xl font-black text-emerald-400 block mt-0.5">
                            3,378
                        </span>
                        <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                            75.7% Cleared Attendance Rate (3,369 DB + 9 Surge)
                        </span>
                    </div>

                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                            Financial Inflow
                        </span>
                        <span className="text-lg sm:text-xl font-black text-emerald-400 block mt-0.5">
                            ₦5,047,000
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                            Costs: ₦3,448,500 (Surplus: +₦1.60M)
                        </span>
                    </div>
                </div>

                {/* Sub-channel Breakdown Chips */}
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-300">
                    <span className="font-bold text-slate-400">Attendance Breakdown:</span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        📱 Digital QR Check-ins: <strong className="text-white">2,578</strong>
                    </span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        📋 Concourse Manual Surge: <strong className="text-white">746</strong>
                    </span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        🏛️ Lagos Province 87 (Region 2): <strong className="text-white">37</strong>
                    </span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        👑 Continental 3 HQ: <strong className="text-emerald-400">32 (100% In)</strong>
                    </span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        💳 Onsite Captured in Base: <strong className="text-white">204</strong>
                    </span>
                    <span className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg">
                        👥 Secretariat Volunteers: <strong className="text-white">20 (Deactivated)</strong>
                    </span>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {STATS.map((stat, i) => (
                    <Card key={i} className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                        <div className={`p-2 md:p-3 rounded-xl bg-slate-50 shrink-0 ${stat.color}`}>
                            <stat.icon size={18} className="md:w-5 md:h-5" />
                        </div>
                        <div className="mt-2 w-full">
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <h3 
                                className={`text-lg md:text-2xl font-black mt-1 ${stat.numColor} whitespace-nowrap block`}
                                style={(stat as any).style}
                            >
                                {stat.value}
                            </h3>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">{stat.change}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 shadow-sm border-slate-200 bg-white">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 space-y-0">
                      <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <TrendingUp size={18} className="text-orange-500" />
                          Registration Trend
                      </CardTitle>
                      {/* Period Toggle */}
                      <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                          <button
                              type="button"
                              onClick={() => setTrendPeriod('daily')}
                              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all border-0 cursor-pointer whitespace-nowrap ${
                                  trendPeriod === 'daily'
                                      ? 'bg-white text-slate-800 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                              }`}
                          >
                              Daily
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendPeriod('weekly')}
                              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all border-0 cursor-pointer whitespace-nowrap ${
                                  trendPeriod === 'weekly'
                                      ? 'bg-white text-slate-800 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                              }`}
                          >
                              Weekly
                          </button>
                          <button
                              type="button"
                              onClick={() => setTrendPeriod('monthly')}
                              className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg transition-all border-0 cursor-pointer whitespace-nowrap ${
                                  trendPeriod === 'monthly'
                                      ? 'bg-white text-slate-800 shadow-sm'
                                      : 'text-slate-500 hover:text-slate-800 bg-transparent'
                              }`}
                          >
                              Monthly
                          </button>
                      </div>
                  </CardHeader>
                  <CardContent className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                          <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
                              <Line type="monotone" dataKey="Registrations" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                          </LineChart>
                      </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-1 shadow-sm border-slate-200 bg-white">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-800">Recent Registrants</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-y-auto h-[380px]">
                        <div className="space-y-4">
                            {regs.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">No registrants found.</p>
                            ) : (
                                regs.slice(0, 10).map((r, index) => (
                                    <div key={r.id || index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0 border-slate-100">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <p className="text-sm font-bold text-slate-800 whitespace-normal break-words">{r.full_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{r.region}</p>
                                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 whitespace-normal break-words">{formatCategory(r.category)}</p>
                                        </div>
                                        <span className={`status-badge text-[10px] font-bold px-2.5 py-0.5 rounded-full border capitalize shrink-0 ${getStatusStyle(r)}`}>
                                            {getStatusLabel(r)}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
