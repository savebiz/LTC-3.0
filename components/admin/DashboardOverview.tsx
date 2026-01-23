
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    Users, CreditCard, CheckCircle2, TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Dummy Data for Preview
const DATA = [
    { name: 'Jan 10', regs: 4 },
    { name: 'Jan 11', regs: 12 },
    { name: 'Jan 12', regs: 18 },
    { name: 'Jan 13', regs: 8 },
    { name: 'Jan 14', regs: 25 },
    { name: 'Jan 15', regs: 42 },
    { name: 'Jan 16', regs: 65 },
];

export default function DashboardOverview() {
    const STATS = [
        { label: "Total Registrations", value: "1,248", change: "+12% vs last week", icon: Users, color: "text-blue-500" },
        { label: "Total Revenue", value: "₦2.4M", change: "+8% vs target", icon: CreditCard, color: "text-green-500" },
        { label: "Check-in Rate", value: "0%", change: "Event Not Started", icon: CheckCircle2, color: "text-orange-500" },
        { label: "Impressions", value: "45K", change: "+24% this month", icon: TrendingUp, color: "text-purple-500" },
    ];

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
                                <p className="text-xs text-green-600 mt-1 font-medium">{stat.change}</p>
                            </div>
                            <div className={`p-3 rounded-full bg-slate-50 ${stat.color}`}>
                                <stat.icon size={24} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Registration Trend</CardTitle>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={DATA}>
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
                        <CardTitle className="text-lg">Recent Registrations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b last:border-0 border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            SA
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">Samuel Adebayo</p>
                                            <p className="text-xs text-slate-500">Region 19 • Delegate</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Paid</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
