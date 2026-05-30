import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    Users, CreditCard, CheckCircle2, TrendingUp, Award, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardOverview() {
    const [regs, setRegs] = useState<any[]>([]);
    const [vols, setVols] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const { data: rData } = await supabase.from('registrations').select('*');
                const { data: vData } = await supabase.from('volunteers').select('*');
                if (rData) setRegs(rData);
                if (vData) setVols(vData);
            } catch (err) {
                console.error('Error fetching dashboard overview data:', err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
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
        
        // Let's look at the last 7 days of registrations
        regs.forEach(r => {
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
            <h2 className="text-3xl font-bold font-heading text-slate-800">Dashboard Overview</h2>

            {/* STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map((stat, i) => (
                    <Card key={i} className="shadow-sm border-slate-200">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">{stat.change}</p>
                            </div>
                            <div className={`p-3 rounded-full bg-slate-50 ${stat.color}`}>
                                <stat.icon size={24} />
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
                    <CardContent className="overflow-y-auto max-h-[300px]">
                        <div className="space-y-4">
                            {regs.length === 0 ? (
                                <p className="text-sm text-slate-500 py-6 text-center">No registrants found.</p>
                            ) : (
                                regs.slice(0, 5).map((r, index) => (
                                    <div key={r.id || index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0 border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                {r.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'SA'}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{r.full_name}</p>
                                                <p className="text-xs text-slate-500">{r.region} • {r.category}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                            r.payment_status?.toLowerCase() === 'cleared' || r.status?.toLowerCase() === 'confirmed'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-orange-100 text-orange-700'
                                        }`}>
                                            {r.payment_status || r.status}
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
