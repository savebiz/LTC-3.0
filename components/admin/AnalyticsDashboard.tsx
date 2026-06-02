import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
    Users, CreditCard, CheckCircle2, Award, QrCode, TrendingUp, Calendar,
    MapPin, Loader2, ArrowUpDown, Download, RotateCw, BookOpen, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { REGIONS_AND_PROVINCES } from '@/constants';

type SortKey = 'region' | 'total' | 'cleared' | 'pending' | 'checkedIn' | 'revenue';

export default function AnalyticsDashboard() {
    const [regs, setRegs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);

    // Filters
    const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [regionFilter, setRegionFilter] = useState<string>('all');
    const [provinceFilter, setProvinceFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');

    // Chart drill-downs
    const [drillDownRegion, setDrillDownRegion] = useState<string | null>(null);

    // Sorting of table
    const [sortKey, setSortKey] = useState<SortKey>('total');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Fetch data from Supabase
    async function loadData(showSpinner = true) {
        if (showSpinner) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                setRegs(data);
                setLastUpdated(new Date());
                setTimeSinceUpdate(0);
            }
        } catch (err) {
            console.error('Error fetching analytics data:', err);
        } finally {
            if (showSpinner) setLoading(false);
        }
    }

    useEffect(() => {
        loadData(true);

        // Real-time updates subscription
        const channel = supabase
            .channel('analytics-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                loadData(false);
            })
            .subscribe();

        // Minutes/Seconds time-since-update timer
        const timeInterval = setInterval(() => {
            setTimeSinceUpdate(prev => prev + 1);
        }, 1000);

        // 60-second polling fallback
        const pollInterval = setInterval(() => {
            loadData(false);
        }, 60000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(timeInterval);
            clearInterval(pollInterval);
        };
    }, []);

    // Format relative time label
    const formatTimeSinceUpdate = () => {
        if (timeSinceUpdate < 5) return 'Just now';
        if (timeSinceUpdate < 60) return `${timeSinceUpdate}s ago`;
        const mins = Math.floor(timeSinceUpdate / 60);
        const secs = timeSinceUpdate % 60;
        return `${mins}m ${secs}s ago`;
    };

    // Extract all unique regions dynamically for filter dropdown
    const regionOptions = useMemo(() => {
        const uniqueRegions = new Set<string>();
        regs.forEach(r => {
            if (r.region) uniqueRegions.add(r.region);
        });
        return Array.from(uniqueRegions).sort();
    }, [regs]);

    // Cascading provinces list
    const provinceOptions = useMemo(() => {
        if (regionFilter === 'all' || regionFilter === 'Other (Outside Lagos/Ogun)') {
            return [];
        }
        return REGIONS_AND_PROVINCES[regionFilter] || [];
    }, [regionFilter]);

    // Reset province selection if region changes
    useEffect(() => {
        setProvinceFilter('all');
    }, [regionFilter]);

    // Filter registrations client-side
    const filteredRegs = useMemo(() => {
        return regs.filter(r => {
            // 1. Date Range
            if (dateRange !== 'all') {
                if (!r.created_at) return false;
                const createdDate = new Date(r.created_at);
                const now = new Date();

                if (dateRange === 'today') {
                    const todayStart = new Date(now);
                    todayStart.setHours(0, 0, 0, 0);
                    if (createdDate < todayStart) return false;
                } else if (dateRange === '7days') {
                    const threshold = new Date(now);
                    threshold.setDate(threshold.getDate() - 6);
                    threshold.setHours(0, 0, 0, 0);
                    if (createdDate < threshold) return false;
                } else if (dateRange === '30days') {
                    const threshold = new Date(now);
                    threshold.setDate(threshold.getDate() - 29);
                    threshold.setHours(0, 0, 0, 0);
                    if (createdDate < threshold) return false;
                }
            }

            // 2. Region
            if (regionFilter !== 'all' && r.region !== regionFilter) {
                return false;
            }

            // 3. Province
            if (provinceFilter !== 'all' && r.province !== provinceFilter) {
                return false;
            }

            // 4. Category
            if (categoryFilter !== 'all') {
                const cat = r.category?.toLowerCase() || '';
                if (categoryFilter === 'teenager') {
                    if (cat !== 'teenager') return false;
                } else if (categoryFilter === 'teacher') {
                    if (!cat.includes('teacher') && !cat.includes('adult')) return false;
                }
            }

            return true;
        });
    }, [regs, dateRange, regionFilter, provinceFilter, categoryFilter]);

    // Metrics Calculations
    const metrics = useMemo(() => {
        const total = filteredRegs.length;
        const cleared = filteredRegs.filter(r => {
            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            return ps === 'cleared' || st === 'confirmed';
        }).length;
        const pending = filteredRegs.filter(r => r.payment_status?.toLowerCase() === 'pending').length;
        const poa = filteredRegs.filter(r => {
            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            return ps === 'pay_on_arrival' || st === 'pay_on_arrival';
        }).length;
        const checkedIn = filteredRegs.filter(r => r.checked_in).length;
        const revenue = filteredRegs.reduce((sum, r) => {
            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            const isCleared = ps === 'cleared' || st === 'confirmed';
            return isCleared ? sum + (Number(r.amount_due) || 0) : sum;
        }, 0);

        return { total, cleared, pending, poa, checkedIn, revenue };
    }, [filteredRegs]);

    // Chart 1: Registration Trend (Line Chart)
    const trendChartData = useMemo(() => {
        const dataPoints = [];
        const counts: Record<string, number> = {};

        filteredRegs.forEach(r => {
            if (!r.created_at) return;
            const date = new Date(r.created_at);
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
            counts[key] = (counts[key] || 0) + 1;
        });

        let daysToGenerate = 30;
        let startDate = new Date();
        startDate.setDate(startDate.getDate() - 29);

        if (dateRange === 'today') {
            daysToGenerate = 1;
            startDate = new Date();
        } else if (dateRange === '7days') {
            daysToGenerate = 7;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 6);
        } else if (dateRange === '30days') {
            daysToGenerate = 30;
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 29);
        } else if (dateRange === 'all') {
            if (filteredRegs.length > 0) {
                const timestamps = filteredRegs.map(r => r.created_at ? new Date(r.created_at).getTime() : Date.now());
                const minTime = Math.min(...timestamps);
                startDate = new Date(minTime);
                const diffTime = Math.abs(Date.now() - startDate.getTime());
                daysToGenerate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                if (daysToGenerate > 180) daysToGenerate = 180; // limit chart density
            }
        }

        for (let i = 0; i < daysToGenerate; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const day = String(d.getDate()).padStart(2, '0');
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${day} ${months[d.getMonth()]}`;
            dataPoints.push({
                date: label,
                Registrations: counts[key] || 0
            });
        }

        return dataPoints;
    }, [filteredRegs, dateRange]);


    // Chart 3: Category Breakdown (Bar Chart)
    const categoryChartData = useMemo(() => {
        const teens = filteredRegs.filter(r => r.category?.toLowerCase() === 'teenager').length;
        const teachers = filteredRegs.filter(r => {
            const cat = r.category?.toLowerCase() || '';
            return cat.includes('teacher') || cat.includes('adult');
        }).length;

        return [
            { name: 'Teenagers', count: teens, fill: '#f97316' },
            { name: 'Teachers / Adults', count: teachers, fill: '#3b82f6' }
        ];
    }, [filteredRegs]);

    // Chart 4: Regional Distribution (Horizontal Bar Chart)
    const regionalDistributionData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredRegs.forEach(r => {
            const reg = r.region || 'Other / Unknown';
            counts[reg] = (counts[reg] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [filteredRegs]);

    // Drill Down Province Breakdown for Regional Click
    const provinceDrillDownData = useMemo(() => {
        if (!drillDownRegion) return [];
        const counts: Record<string, number> = {};
        filteredRegs.forEach(r => {
            if (r.region === drillDownRegion) {
                const prov = r.province || 'Unknown Province';
                counts[prov] = (counts[prov] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [filteredRegs, drillDownRegion]);

    // Reset drill-down region if it is filtered out or region selection changes
    useEffect(() => {
        if (regionFilter !== 'all') {
            setDrillDownRegion(null);
        }
    }, [regionFilter]);

    // Chart 5: Payment Status Distribution per Region (Stacked Bar Chart)
    const paymentStatusDistributionData = useMemo(() => {
        const dataMap: Record<string, { name: string; Cleared: number; Pending: number; 'Pay on Arrival': number }> = {};

        filteredRegs.forEach(r => {
            const reg = r.region || 'Other / Unknown';
            if (!dataMap[reg]) {
                dataMap[reg] = { name: reg, Cleared: 0, Pending: 0, 'Pay on Arrival': 0 };
            }

            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();

            if (ps === 'cleared' || st === 'confirmed') {
                dataMap[reg].Cleared += 1;
            } else if (ps === 'pay_on_arrival' || st === 'pay_on_arrival') {
                dataMap[reg]['Pay on Arrival'] += 1;
            } else {
                dataMap[reg].Pending += 1;
            }
        });

        return Object.values(dataMap)
            .sort((a, b) => (b.Cleared + b.Pending + b['Pay on Arrival']) - (a.Cleared + a.Pending + a['Pay on Arrival']))
            .slice(0, 10); // Display top 10 regions to keep it readable
    }, [filteredRegs]);

    // Chart 6: Check-in Progress Calculations
    const checkInPercent = useMemo(() => {
        const totalCleared = filteredRegs.filter(r => {
            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            return ps === 'cleared' || st === 'confirmed';
        }).length;

        const checkedInCleared = filteredRegs.filter(r => {
            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            const isCleared = ps === 'cleared' || st === 'confirmed';
            return isCleared && r.checked_in;
        }).length;

        return {
            percent: totalCleared > 0 ? Math.round((checkedInCleared / totalCleared) * 100) : 0,
            checkedIn: checkedInCleared,
            cleared: totalCleared
        };
    }, [filteredRegs]);

    // Progress Bar HSL Color Interpolation (Orange -> Amber -> Green)
    const progressColor = useMemo(() => {
        const pct = checkInPercent.percent;
        const hue = 24 + (142 - 24) * (pct / 100);
        return `hsl(${hue}, 90%, 45%)`;
    }, [checkInPercent]);

    // Bottom Table - Per Region stats
    const regionalTableStats = useMemo(() => {
        const stats: Record<string, { region: string; total: number; cleared: number; pending: number; checkedIn: number; revenue: number }> = {};

        filteredRegs.forEach(r => {
            const reg = r.region || 'Other / Unknown';
            if (!stats[reg]) {
                stats[reg] = { region: reg, total: 0, cleared: 0, pending: 0, checkedIn: 0, revenue: 0 };
            }

            stats[reg].total += 1;

            const ps = r.payment_status?.toLowerCase();
            const st = r.status?.toLowerCase();
            const isCleared = ps === 'cleared' || st === 'confirmed';
            const isPending = ps === 'pending';

            if (isCleared) {
                stats[reg].cleared += 1;
                stats[reg].revenue += Number(r.amount_due) || 0;
            } else if (isPending) {
                stats[reg].pending += 1;
            }

            if (r.checked_in) {
                stats[reg].checkedIn += 1;
            }
        });

        const statsList = Object.values(stats);

        // Sort list
        statsList.sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB as string).toLowerCase();
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        return statsList;
    }, [filteredRegs, sortKey, sortDirection]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('desc');
        }
    };

    // CSV Export
    const handleExportCSV = () => {
        const headers = ['Region', 'Total Registered', 'Cleared Payments', 'Pending Verification', 'Checked In', 'Revenue (NGN)'];
        const csvRows = [headers.join(',')];

        regionalTableStats.forEach(row => {
            const line = [
                `"${row.region}"`,
                row.total,
                row.cleared,
                row.pending,
                row.checkedIn,
                row.revenue
            ];
            csvRows.push(line.join(','));
        });

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `C3TC_Region_Stats_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Render loading skeletons
    if (loading) {
        return (
            <div className="space-y-6">
                {/* Header Skeleton */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="h-10 w-64 bg-slate-200 rounded-xl animate-pulse" />
                    <div className="h-6 w-32 bg-slate-200 rounded-lg animate-pulse" />
                </div>

                {/* Filters Skeleton */}
                <div className="bg-white border p-4 rounded-2xl grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-11 bg-slate-100 rounded-xl animate-pulse" />
                    ))}
                </div>

                {/* Cards Row Skeleton */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl p-4 animate-pulse space-y-3">
                            <div className="w-10 h-10 bg-slate-100 rounded-full" />
                            <div className="h-4 bg-slate-100 rounded w-3/4" />
                            <div className="h-6 bg-slate-100 rounded w-1/2" />
                        </div>
                    ))}
                </div>

                {/* Charts Grid Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white border rounded-2xl p-4 h-[350px] animate-pulse" />
                    <div className="bg-white border rounded-2xl p-4 h-[350px] animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* PAGE HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold font-heading text-slate-800">Analytics</h2>
                    <p className="text-slate-500 text-sm mt-0.5">Registration and attendance insights for C3TC T.I.M.E &apos;26</p>
                </div>
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-start">
                    <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-50 border px-3 py-1.5 rounded-lg">
                        <RotateCw size={12} className="animate-spin-slow" />
                        <span>Updated {formatTimeSinceUpdate()}</span>
                    </div>
                    <Button
                        onClick={() => loadData(true)}
                        size="sm"
                        variant="outline"
                        className="rounded-lg h-9 gap-1.5 font-bold bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                        <RotateCw size={14} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* GLOBAL FILTERS */}
            <Card className="shadow-sm border-slate-200 rounded-2xl bg-white">
                <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Date picker */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar size={10} /> Date Range
                        </label>
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value as any)}
                            className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none hover:bg-slate-50 transition-colors"
                        >
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="30days">Last 30 Days</option>
                        </select>
                    </div>

                    {/* Region */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <MapPin size={10} /> Region
                        </label>
                        <select
                            value={regionFilter}
                            onChange={e => setRegionFilter(e.target.value)}
                            className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none hover:bg-slate-50 transition-colors"
                        >
                            <option value="all">All Regions</option>
                            {regionOptions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Province */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <MapPin size={10} /> Province
                        </label>
                        <select
                            value={provinceFilter}
                            onChange={e => setProvinceFilter(e.target.value)}
                            disabled={provinceOptions.length === 0}
                            className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        >
                            <option value="all">{provinceOptions.length === 0 ? 'Select Region First' : 'All Provinces'}</option>
                            {provinceOptions.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Category */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Users size={10} /> Category
                        </label>
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="w-full h-11 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-700 text-sm font-semibold px-3 outline-none hover:bg-slate-50 transition-colors"
                        >
                            <option value="all">All Categories</option>
                            <option value="teenager">Teenagers</option>
                            <option value="teacher">Teachers / Adults</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* SUMMARY CARDS ROW */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                {/* 1. Total Registered */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Registered</span>
                        <div className="p-1.5 rounded-lg bg-orange-50 text-orange-500">
                            <Users size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-none">{metrics.total.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Total submissions</p>
                    </div>
                </Card>

                {/* 2. Total Cleared */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Cleared</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500">
                            <CheckCircle2 size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl md:text-2xl font-black text-emerald-600 leading-none">{metrics.cleared.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Verified payments</p>
                    </div>
                </Card>

                {/* 3. Total Pending */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Pending</span>
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-500">
                            <ClockIcon size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl md:text-2xl font-black text-amber-600 leading-none">{metrics.pending.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Awaiting review</p>
                    </div>
                </Card>

                {/* 4. Total Pay-on-Arrival */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">On Arrival</span>
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500">
                            <CreditCard size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl md:text-2xl font-black text-blue-600 leading-none">{metrics.poa.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Historical records</p>
                    </div>
                </Card>

                {/* 5. Total Checked In */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Checked In</span>
                        <div className="p-1.5 rounded-lg bg-purple-50 text-purple-500">
                            <QrCode size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-xl md:text-2xl font-black text-purple-600 leading-none">{metrics.checkedIn.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Attendance count</p>
                    </div>
                </Card>

                {/* 6. Total Revenue Collected */}
                <Card className="col-span-1 bg-white border border-slate-200 shadow-sm rounded-2xl stats-card flex flex-col justify-between p-4 min-h-[110px]">
                    <div className="flex justify-between items-start w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Revenue</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-500">
                            <Award size={14} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <h3 className="text-lg md:text-2xl font-black text-emerald-600 leading-none whitespace-normal break-all">₦{metrics.revenue.toLocaleString()}</h3>
                        <p className="text-[9px] text-slate-400 mt-1 font-semibold">Cleared collections</p>
                    </div>
                </Card>
            </div>

            {/* CHARTS GRID */}
            <div className="space-y-6">
                {/* ROW 1: Trend (60%) + Category (40%) on desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* CHART 1: Registration Trend (60% width) */}
                    <Card className="lg:col-span-3 shadow-sm border-slate-200 bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp size={18} className="text-orange-500" />
                                Registration Trend
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            {trendChartData.length === 0 ? (
                                <p className="text-slate-400 text-sm">No data for this selection</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                                    <LineChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }} />
                                        <Line type="monotone" dataKey="Registrations" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* CHART 3: Category Breakdown (40% width) */}
                    <Card className="lg:col-span-2 shadow-sm border-slate-200 bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users size={18} className="text-orange-500" />
                                Category Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            {categoryChartData.every(c => c.count === 0) ? (
                                <p className="text-slate-400 text-sm">No data for this selection</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                                    <BarChart data={categoryChartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                        <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={55} label={{ position: 'top', fill: '#475569', fontSize: 12, fontWeight: 'bold' }}>
                                            {categoryChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ROW 2: Check-in Progress + Regional Distribution (50% each on desktop) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CHART 6: Check-in Progress */}
                    <Card className="shadow-sm border-slate-200 bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-orange-500" />
                                Check-in Progress
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex flex-col items-center justify-center p-6 space-y-6">
                            <div className="text-center">
                                <span className="text-5xl font-black leading-none block" style={{ color: progressColor }}>
                                    {checkInPercent.percent}%
                                </span>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 block">Attendance Checked In</span>
                            </div>

                            {/* Progress Bar Container */}
                            <div className="w-full bg-slate-100 rounded-full h-6 border border-slate-200 p-0.5 overflow-hidden flex items-center">
                                <div
                                    className="h-full rounded-full transition-all duration-500 ease-out shadow-inner"
                                    style={{
                                        width: `${checkInPercent.percent}%`,
                                        backgroundColor: progressColor
                                    }}
                                />
                            </div>

                            <div className="text-slate-600 text-sm font-semibold text-center leading-relaxed">
                                {checkInPercent.checkedIn.toLocaleString()} of {checkInPercent.cleared.toLocaleString()} cleared delegates checked in
                                <p className="text-xs text-slate-400 font-medium mt-1">Only cleared payments are eligible for check-in</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CHART 4: Regional Distribution (Click region for drill-down) */}
                    <Card className="shadow-sm border-slate-200 bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <MapPin size={18} className="text-orange-500" />
                                    Regional Distribution
                                </span>
                                {drillDownRegion && (
                                    <Button
                                        onClick={() => setDrillDownRegion(null)}
                                        size="xs"
                                        variant="link"
                                        className="text-orange-500 hover:text-orange-600 text-xs font-semibold p-0 h-auto cursor-pointer"
                                    >
                                        Clear Drill-down
                                    </Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex items-center justify-center">
                            {regionalDistributionData.length === 0 ? (
                                <p className="text-slate-400 text-sm">No data for this selection</p>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                                    <BarChart data={regionalDistributionData.slice(0, 10)} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                        <Bar dataKey="count" fill="#f97316" radius={[0, 6, 6, 0]} barSize={16}>
                                            {regionalDistributionData.slice(0, 10).map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    className="cursor-pointer transition-opacity"
                                                    fill={entry.name === drillDownRegion ? '#ea580c' : '#f97316'}
                                                    onClick={() => setDrillDownRegion(entry.name)}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ROW 3: Payment Status Distribution per Region (Full width on desktop) */}
                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen size={18} className="text-orange-500" />
                            Payment Status per Region
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] flex items-center justify-center">
                        {paymentStatusDistributionData.length === 0 ? (
                            <p className="text-slate-400 text-sm">No data for this selection</p>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                                <BarChart data={paymentStatusDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                                    <Bar dataKey="Cleared" stackId="statusStack" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Pending" stackId="statusStack" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Pay on Arrival" stackId="statusStack" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* DRILL DOWN SECONDARY CHART (Renders below main grid if region clicked) */}
            {drillDownRegion && (
                <Card className="shadow-sm border-slate-200 bg-white animate-in slide-in-from-bottom duration-300">
                    <CardHeader className="pb-2 border-b">
                        <div className="flex justify-between items-center w-full">
                            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <MapPin size={18} className="text-orange-500" />
                                Province Breakdown: {drillDownRegion}
                            </CardTitle>
                            <Button
                                onClick={() => setDrillDownRegion(null)}
                                size="sm"
                                variant="outline"
                                className="rounded-lg h-8 cursor-pointer"
                            >
                                Close
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="py-6 flex flex-col md:flex-row items-center gap-6">
                        <div className="w-full md:w-3/5 h-[300px]">
                            {provinceDrillDownData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No province data found</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%" className="outline-none" tabIndex={-1}>
                                    <BarChart data={provinceDrillDownData.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} style={{ outline: 'none' }} tabIndex={-1}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                        <Bar dataKey="count" fill="#ea580c" radius={[4, 4, 0, 0]} barSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                        <div className="w-full md:w-2/5 border rounded-xl overflow-x-auto self-stretch max-h-[300px] overflow-y-auto">
                            <table className="w-full text-sm divide-y text-left">
                                <thead className="bg-slate-50 text-slate-500 font-semibold text-xs sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2">Province</th>
                                        <th className="px-4 py-2 text-right">Registrations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-slate-700">
                                    {provinceDrillDownData.map(prov => (
                                        <tr key={prov.name} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-2.5 font-medium">{prov.name}</td>
                                            <td className="px-4 py-2.5 text-right font-bold">{prov.count}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!drillDownRegion && regionalDistributionData.length > 0 && (
                <div className="text-center py-2 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-600">
                    <AlertCircle size={14} />
                    <span>💡 Tip: Click any region bar in the &quot;Regional Distribution&quot; chart to view its province-level breakdown.</span>
                </div>
            )}

            {/* DATA SUMMARY TABLE */}
            <Card className="shadow-sm border-slate-200 bg-white">
                <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-800">Regional Performance Summary</CardTitle>
                        <p className="text-slate-400 text-xs mt-0.5">Detailed statistics broken down by geographic region</p>
                    </div>
                    <Button
                        onClick={handleExportCSV}
                        size="sm"
                        className="rounded-lg h-9 gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-md active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                        <Download size={14} />
                        Export CSV
                    </Button>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    {regionalTableStats.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm">No data matching the filters.</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-slate-50/50 text-slate-500 font-semibold border-b">
                                <tr>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 col-region" onClick={() => handleSort('region')}>
                                        <div className="flex items-center gap-1">
                                            Region <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 text-center col-total-registered" onClick={() => handleSort('total')}>
                                        <div className="flex items-center gap-1 justify-center">
                                            Total Registered <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 text-center col-cleared-payments" onClick={() => handleSort('cleared')}>
                                        <div className="flex items-center gap-1 justify-center">
                                            Cleared Payments <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 text-center" onClick={() => handleSort('pending')}>
                                        <div className="flex items-center gap-1 justify-center">
                                            Pending Verification <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 text-center" onClick={() => handleSort('checkedIn')}>
                                        <div className="flex items-center gap-1 justify-center">
                                            Checked In <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    <th className="px-6 py-3 cursor-pointer select-none hover:bg-slate-100 text-right" onClick={() => handleSort('revenue')}>
                                        <div className="flex items-center gap-1 justify-end">
                                            Revenue <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-slate-700 font-medium">
                                {regionalTableStats.map((row, index) => (
                                    <tr key={row.region || index} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-800 col-region">{row.region}</td>
                                        <td className="px-6 py-4 text-center text-slate-600 font-semibold col-total-registered">{row.total.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center col-cleared-payments">
                                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                {row.cleared.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                {row.pending.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                                {row.checkedIn.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-600 whitespace-nowrap">₦{row.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ClockIcon(props: { size?: number; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={props.size || 24}
            height={props.size || 24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
