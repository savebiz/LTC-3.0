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

    // Daily registration numbers for graph
    const getRegistrationTrendData = () => {
        const countsByDay: Record<string, number> = {};
        
        // Sort copy of regs chronologically ascending before grouping
        const sortedRegs = [...regs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        // Let's look at the last 7 days of registrations
        sortedRegs.forEach(r => {
            if (!r.created_at) return;
            const dateStr = new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
            countsByDay[dateStr] = (countsByDay[dateStr] || 0) + 1;
        });

        // Convert to array and take the latest 7 days (or fill in with some defaults if empty)
        const entries = Object.entries(countsByDay).map(([name, regs]) => ({ name, regs }));
        if (entries.length === 0) {
            return [
                { name: 'Day 1', regs: 0 },
                { name: 'Day 2', regs: 0 },
                { name: 'Day 3', regs: 0 },
            ];
        }
        // Return sorted or latest entries
        return entries.slice(-7);
    };

    const trendData = getRegistrationTrendData();

    const STATS = [
        { label: "Total Registrations", value: totalRegs.toLocaleString(), change: `${regs.filter(r => r.category === 'teenager').length} Teens • ${regs.filter(r => r.category === 'teacher' || r.category === 'teacher_adult' || r.category === 'teacher / adult').length} Teachers`, icon: Users, color: "text-blue-500" },
        { label: "Total Revenue Collected", value: `₦${totalRevenue.toLocaleString()}`, change: `${regs.filter(r => r.payment_status === 'cleared').length} Cleared Payments`, icon: CreditCard, color: "text-green-500" },
        { label: "Check-in Rate", value: `${checkInRate}%`, change: `${checkedInCount} Delegates Checked In`, icon: CheckCircle2, color: "text-orange-500" },
        { label: "Total Volunteers", value: totalVolunteers.toLocaleString(), change: "Volunteers Team", icon: Award, color: "text-purple-500" },
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
                    <Card key={i} className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl overflow-visible min-h-[90px] flex items-center">
                        <CardContent className="p-3 md:p-4 flex flex-row items-center justify-between gap-3 w-full">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{stat.label}</p>
                                <h3 className="text-sm md:text-xl font-black text-slate-900 mt-0.5 whitespace-nowrap">{stat.value}</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-medium whitespace-nowrap">{stat.change}</p>
                            </div>
                            <div className={`p-2 md:p-3 rounded-xl bg-slate-50 shrink-0 ${stat.color}`}>
                                <stat.icon size={18} className="md:w-5 md:h-5" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
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
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${getStatusStyle(r)}`}>
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
