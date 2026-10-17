import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase, fetchAllSupabaseRows } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Printer, Search, Filter, Scissors, FileText, CheckCircle2, 
    Layers, RefreshCw, ChevronRight, Eye, Download, Info
} from 'lucide-react';
import { useDialog } from '../ui/DialogProvider';

interface Registrant {
    id: string;
    full_name: string;
    batch_reference: string;
    category: string;
    region: string;
    province: string;
    status: string;
    payment_status?: string;
    qr_code_hash?: string;
    phone?: string;
}

export default function BatchPrintCards() {
    const { toast } = useDialog();
    const [loading, setLoading] = useState(true);
    const [delegates, setDelegates] = useState<Registrant[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedProvince, setSelectedProvince] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewMode, setPreviewMode] = useState(false);

    // Fetch cleared delegates using fetchAllSupabaseRows
    async function loadClearedDelegates() {
        setLoading(true);
        try {
            const data = await fetchAllSupabaseRows<Registrant>(() => 
                supabase
                    .from('registrations')
                    .select('id, full_name, batch_reference, category, region, province, status, payment_status, qr_code_hash, phone')
                    .or('payment_status.eq.cleared,status.eq.confirmed')
                    .order('region', { ascending: true })
                    .order('province', { ascending: true })
                    .order('full_name', { ascending: true })
            );

            setDelegates(data || []);
        } catch (err: any) {
            console.error('Error fetching delegates for batch print:', err);
            toast.error('Load Failed', 'Could not retrieve delegates list.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadClearedDelegates();
    }, []);

    // Distinct Regions list
    const availableRegions = useMemo(() => {
        const set = new Set<string>();
        delegates.forEach(d => {
            if (d.region) set.add(d.region);
        });
        return Array.from(set).sort();
    }, [delegates]);

    // Distinct Provinces list for chosen region
    const availableProvinces = useMemo(() => {
        const set = new Set<string>();
        delegates.forEach(d => {
            if (selectedRegion === 'all' || d.region === selectedRegion) {
                if (d.province) set.add(d.province);
            }
        });
        return Array.from(set).sort();
    }, [delegates, selectedRegion]);

    // Filtered delegates
    const filteredDelegates = useMemo(() => {
        return delegates.filter(d => {
            if (selectedRegion !== 'all' && d.region !== selectedRegion) return false;
            if (selectedProvince !== 'all' && d.province !== selectedProvince) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = d.full_name?.toLowerCase().includes(q);
                const matchRef = d.batch_reference?.toLowerCase().includes(q);
                const matchPhone = d.phone?.toLowerCase().includes(q);
                if (!matchName && !matchRef && !matchPhone) return false;
            }
            return true;
        });
    }, [delegates, selectedRegion, selectedProvince, searchQuery]);

    // Group delegates hierarchically: Map<Region, Map<Province, Registrant[]>>
    const groupedData = useMemo(() => {
        const map = new Map<string, Map<string, Registrant[]>>();

        filteredDelegates.forEach(delegate => {
            const reg = delegate.region || 'Unassigned Region';
            const prov = delegate.province || 'General Province';

            if (!map.has(reg)) {
                map.set(reg, new Map());
            }
            const provMap = map.get(reg)!;
            if (!provMap.has(prov)) {
                provMap.set(prov, []);
            }
            provMap.get(prov)!.push(delegate);
        });

        return map;
    }, [filteredDelegates]);

    // Flatten into A4 Sheets (10 delegates per sheet) with page breaks per Province
    const a4Sheets = useMemo(() => {
        interface A4Sheet {
            sheetId: string;
            region: string;
            province: string;
            pageNumber: number;
            totalPages: number;
            cards: Registrant[];
        }

        const sheets: A4Sheet[] = [];

        groupedData.forEach((provMap, region) => {
            provMap.forEach((provDelegates, province) => {
                const totalSheetsForProv = Math.ceil(provDelegates.length / 10);
                for (let i = 0; i < provDelegates.length; i += 10) {
                    const chunk = provDelegates.slice(i, i + 10);
                    sheets.push({
                        sheetId: `${region}-${province}-p${Math.floor(i / 10) + 1}`,
                        region,
                        province,
                        pageNumber: Math.floor(i / 10) + 1,
                        totalPages: totalSheetsForProv,
                        cards: chunk
                    });
                }
            });
        });

        return sheets;
    }, [groupedData]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            {/* SCREEN-ONLY TOOLBAR & CONTROLS (Clean Light Theme) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden print:hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-xl bg-orange-100 text-orange-600 border border-orange-200">
                                <Scissors className="w-5 h-5" />
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight font-heading">
                                A4 Batch QR Card Printer (10 Cards / Sheet)
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Printable delegate pass backup arranged per Region & Province with dashed scissor cut guides.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            onClick={handlePrint}
                            disabled={loading || a4Sheets.length === 0}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-11 px-5 rounded-xl flex items-center gap-2 shadow-sm active:scale-[0.98] transition-all"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print All ({a4Sheets.length} A4 Pages)</span>
                        </Button>

                        <button
                            onClick={loadClearedDelegates}
                            disabled={loading}
                            className="h-11 w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
                            title="Refresh data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* FILTER CONTROLS */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Region Filter */}
                    <div>
                        <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                            Filter by Region
                        </label>
                        <select
                            value={selectedRegion}
                            onChange={(e) => {
                                setSelectedRegion(e.target.value);
                                setSelectedProvince('all');
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
                        >
                            <option value="all">All Regions ({availableRegions.length})</option>
                            {availableRegions.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    {/* Province Filter */}
                    <div>
                        <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                            Filter by Province
                        </label>
                        <select
                            value={selectedProvince}
                            onChange={(e) => setSelectedProvince(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500 focus:bg-white font-medium"
                        >
                            <option value="all">All Provinces ({availableProvinces.length})</option>
                            {availableProvinces.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                            Search Name / REF
                        </label>
                        <Input
                            placeholder="Type to filter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-50 border-slate-200 text-xs text-slate-800 h-9.5 rounded-xl focus:bg-white"
                        />
                    </div>

                    {/* Stats Pill */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between self-end h-9.5">
                        <span className="text-xs text-slate-500 font-medium">Ready to Print:</span>
                        <span className="text-xs font-mono font-bold text-orange-600">
                            {filteredDelegates.length} Cards • {a4Sheets.length} Sheets
                        </span>
                    </div>
                </div>

                {/* PRINT INSTRUCTIONS NOTICE */}
                <div className="mt-4 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-[11px] leading-relaxed text-slate-600">
                        <strong className="text-slate-800">Printer Settings:</strong> Paper size: <span className="text-orange-600 font-mono font-bold">A4 Portrait</span>. Margins: <span className="text-orange-600 font-mono font-bold">None / Minimum</span>. Scale: <span className="text-orange-600 font-mono font-bold">100% (Do not fit to page)</span>. Each A4 sheet fits exactly 10 cards (2 columns × 5 rows) with dotted scissor lines.
                    </div>
                </div>
            </div>

            {/* A4 PRINT CONTAINER (Visible on Screen Preview and in Print) */}
            <div className="batch-cards-print-container space-y-8 print:space-y-0">
                {loading ? (
                    <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-500 space-y-3 shadow-sm print:hidden">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-orange-500" />
                        <p className="text-sm font-medium">Loading and grouping cleared delegates...</p>
                    </div>
                ) : a4Sheets.length === 0 ? (
                    <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl text-slate-500 text-sm font-medium shadow-sm print:hidden">
                        No cleared delegates match the selected filters.
                    </div>
                ) : (
                    a4Sheets.map((sheet) => (
                        <div
                            key={sheet.sheetId}
                            className="a4-sheet-page bg-white text-black mx-auto p-4 sm:p-5 rounded-2xl shadow-2xl print:shadow-none print:rounded-none print:m-0 print:p-[6mm] max-w-[210mm] border border-slate-300 print:border-none"
                            style={{
                                width: '210mm',
                                minHeight: '297mm',
                                pageBreakAfter: 'always',
                                breakAfter: 'page'
                            }}
                        >
                            {/* SHEET BATCH HEADER */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black/80 text-[10px] font-mono font-bold tracking-tight uppercase">
                                <div className="flex items-center gap-2">
                                    <span className="bg-black text-white px-2 py-0.5 rounded font-black font-sans">
                                        C3TC '26
                                    </span>
                                    <span>{sheet.region}</span>
                                    <span>•</span>
                                    <span className="text-orange-600 font-black">{sheet.province}</span>
                                </div>
                                <div className="text-slate-600">
                                    Page {sheet.pageNumber} of {sheet.totalPages} ({sheet.cards.length} Cards)
                                </div>
                            </div>

                            {/* 2 COLUMNS × 5 ROWS = 10 CARDS GRID */}
                            <div className="grid grid-cols-2 gap-1.5 print:gap-1">
                                {sheet.cards.map((delegate) => {
                                    const qrValue = delegate.qr_code_hash || delegate.id;

                                    return (
                                        <div
                                            key={delegate.id}
                                            className="delegate-batch-card relative border-2 border-dashed border-slate-400 p-2 rounded-lg flex items-center gap-2.5 overflow-hidden"
                                            style={{
                                                height: '53.5mm',
                                                boxSizing: 'border-box'
                                            }}
                                        >
                                            {/* Scissor icon in corner */}
                                            <span className="absolute top-0.5 right-1 text-[8px] text-slate-400 font-mono select-none">
                                                ✂
                                            </span>

                                            {/* HIGH-RES VECTOR QR CODE */}
                                            <div className="shrink-0 p-1 bg-white border border-slate-300 rounded-md">
                                                <QRCodeSVG
                                                    value={qrValue}
                                                    size={105}
                                                    level="H"
                                                    includeMargin={false}
                                                />
                                            </div>

                                            {/* DELEGATE DETAILS BLOCK */}
                                            <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5 text-left">
                                                <div>
                                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                                        <span className="text-[8px] font-black uppercase tracking-wider text-slate-800 font-heading">
                                                            C3TC '26 • T.I.M.E.
                                                        </span>
                                                        <span className="text-[7px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 shrink-0 uppercase">
                                                            {delegate.category?.includes('Teacher') ? 'TEACHER' : 'TEEN'}
                                                        </span>
                                                    </div>

                                                    <h4 className="text-[11px] font-black text-black leading-tight line-clamp-2 uppercase">
                                                        {delegate.full_name}
                                                    </h4>
                                                </div>

                                                <div className="space-y-0.5 text-[8.5px] text-slate-700 leading-tight">
                                                    <div className="truncate font-semibold">
                                                        {delegate.province}
                                                    </div>
                                                    <div className="truncate text-slate-500 font-mono text-[7.5px]">
                                                        {delegate.region}
                                                    </div>
                                                </div>

                                                <div className="pt-0.5 border-t border-slate-300 flex items-center justify-between text-[7px] font-mono text-slate-500 font-bold">
                                                    <span>REF: {delegate.batch_reference || delegate.id.slice(0, 8)}</span>
                                                    <span className="text-emerald-700">CLEARED</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* FOOTER NOTICE */}
                            <div className="mt-2 pt-1 border-t border-slate-300 flex items-center justify-between text-[7.5px] font-mono text-slate-500">
                                <span>Lagos Teens Conference 3.0 • Glory Arena, Redemption City</span>
                                <span>Cut along dashed lines ✂</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* EMBEDDED PRINT STYLESHEET */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 4mm;
                    }
                    body {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .a4-sheet-page {
                        page-break-after: always !important;
                        break-after: page !important;
                        width: 100% !important;
                        height: 100% !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 4mm !important;
                    }
                    /* Hide unnecessary elements */
                    header, aside, nav, button, .print\\:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
