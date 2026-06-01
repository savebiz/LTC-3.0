import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    Users, CreditCard, CheckCircle2, TrendingUp, Award, Loader2, QrCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardOverview() {
    const navigate = useNavigate();
    const [regs, setRegs] = useState<any[]>([]);
    const [vols, setVols] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
        if (ps === 'cleared' || st === 'confirmed') return 'Cleared';
        if (ps === 'pay_on_arrival' || st === 'pay_on_arrival') return 'Pay on Arrival';
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
                const { data: rData } = await supabase
                    .from('registrations')
                    .select('*')
                    .order('created_at', { ascending: false });
                const { data: vData } = await supabase
                    .from('volunteers')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (rData) setRegs(rData);
                if (vData) setVols(vData);
            } catch (err) {
                console.error('Error fetching dashboard overview data:', err);
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

    // Daily registration numbers for graph (last 7 days ending today, inclusive)
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

        // Group registration counts by local date keys
        const counts: Record<string, number> = {};
        regs.forEach(r => {
            if (!r.created_at) return;
            const date = new Date(r.created_at);
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        // Generate last 7 days ending today (inclusive)
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const label = formatDayMonth(d);
            dataPoints.push({
                name: label,
                regs: counts[key] || 0
            });
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
            numColor: "text-emerald-600"
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

            {/* STATS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {STATS.map((stat, i) => (
                    <Card key={i} className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card">
                        <div className={`p-2 md:p-3 rounded-xl bg-slate-50 shrink-0 ${stat.color}`}>
                            <stat.icon size={18} className="md:w-5 md:h-5" />
                        </div>
                        <div className="mt-2 w-full">
                            <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                            <h3 className={`text-lg md:text-2xl font-black mt-1 ${stat.numColor}`}>{stat.value}</h3>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">{stat.change}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[400px]">
                <Card className="shadow-sm border-slate-200">
                  <CardHeader>
                      <CardTitle className="text-lg">Registration Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData}>
                              <defs>
                                  <linearGradient id="colorRegs" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                              <Tooltip />
                              <Area type="monotone" dataKey="regs" stroke="#f97316" fillOpacity={1} fill="url(#colorRegs)" strokeWidth={3} />
                          </AreaChart>
                      </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Registrants</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-y-auto max-h-[340px]">
                        <div className="space-y-4">
                            {regs.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">No registrants found.</p>
                            ) : (
                                regs.slice(0, 10).map((r, index) => (
                                    <div key={r.id || index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0 border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {r.full_name?.trim().split(/\s+/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'SA'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{r.full_name}</p>
                                                <p className="text-xs text-slate-500">{r.region} • {formatCategory(r.category)}</p>
                                            </div>
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
