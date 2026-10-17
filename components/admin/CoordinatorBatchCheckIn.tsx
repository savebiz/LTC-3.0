import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, fetchAllSupabaseRows } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    Users, Search, CheckCircle2, UserCheck, AlertTriangle, 
    XCircle, Camera, RotateCw, Lightbulb, Loader2, Sparkles,
    ChevronDown, ChevronUp, Filter, CheckSquare, Square, Plus, Minus, ArrowRight,
    Bus, Layers, Check
} from 'lucide-react';
import { REGIONS_AND_PROVINCES } from '@/constants';

interface Registrant {
    id: string;
    full_name: string;
    batch_reference: string;
    category: string;
    region: string;
    province: string;
    status: string;
    payment_status?: string;
    checked_in: boolean;
    checked_in_at?: string;
    qr_code_hash?: string;
    phone?: string;
}

interface CoordinatorBatchCheckInProps {
    onBatchSuccess?: (result: {
        count: number;
        coordinatorName: string;
        province: string;
        timestamp: string;
    }) => void;
    volunteerName?: string;
}

export default function CoordinatorBatchCheckIn({ onBatchSuccess, volunteerName = 'Gate Usher' }: CoordinatorBatchCheckInProps) {
    const { confirm, toast } = useDialog();

    // Mode Selection: 'lookup' | 'scan' | 'province'
    const [lookupMode, setLookupMode] = useState<'search' | 'scan' | 'province'>('search');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Province Selection state
    const [selectedRegion, setSelectedRegion] = useState<string>('Region 19');
    const [selectedProvince, setSelectedProvince] = useState<string>('');

    // Scanner state
    const [isScannerActive, setIsScannerActive] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    // Active Loaded Group State
    const [loadedGroup, setLoadedGroup] = useState<{
        coordinatorName: string;
        coordinatorPhone?: string;
        province: string;
        region: string;
        batchReference?: string;
        delegates: Registrant[];
    } | null>(null);

    // Headcount, Staggered Batch, and Selection state
    const [selectedDelegateIds, setSelectedDelegateIds] = useState<Set<string>>(new Set());
    const [headcountInput, setHeadcountInput] = useState<number>(0);
    const [batchTag, setBatchTag] = useState<string>('Bus 1');
    const [customTag, setCustomTag] = useState<string>('');
    const [showDelegateList, setShowDelegateList] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');

    // Success confirmation screen state
    const [lastBatchResult, setLastBatchResult] = useState<{
        count: number;
        coordinatorName: string;
        province: string;
        headcount: number;
        batchTag: string;
        remainingAfter: number;
    } | null>(null);

    // List of available provinces for selected region
    const availableProvinces = useMemo(() => {
        return REGIONS_AND_PROVINCES[selectedRegion] || [];
    }, [selectedRegion]);

    useEffect(() => {
        if (availableProvinces.length > 0 && !selectedProvince) {
            setSelectedProvince(availableProvinces[0]);
        }
    }, [availableProvinces]);

    // Cleanup scanner on unmount
    useEffect(() => {
        return () => {
            if (html5QrCodeRef.current) {
                html5QrCodeRef.current.stop().catch(() => {});
                html5QrCodeRef.current.clear().catch(() => {});
            }
        };
    }, []);

    // Start Scanner
    const startScanner = async () => {
        setIsScannerActive(true);
        try {
            const html5QrCode = new Html5Qrcode('batch-coordinator-qr-viewfinder');
            html5QrCodeRef.current = html5QrCode;
            await html5QrCode.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => {}
            );
        } catch (err) {
            console.error('Failed to start batch scanner:', err);
            toast.error('Camera Error', 'Could not access device camera.');
            setIsScannerActive(false);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
                await html5QrCodeRef.current.clear();
            } catch {}
            html5QrCodeRef.current = null;
        }
        setIsScannerActive(false);
    };

    const handleScanSuccess = async (text: string) => {
        await stopScanner();
        let hash = text.trim();
        if (hash.includes('/')) {
            const parts = hash.split('/');
            hash = parts[parts.length - 1];
        }

        // Try parsing JSON payload if applicable
        try {
            const parsed = JSON.parse(hash);
            if (parsed.hash || parsed.ref) hash = parsed.hash || parsed.ref;
        } catch {}

        loadGroupByQuery(hash, 'hash');
    };

    // Load group by search query or QR code
    const loadGroupByQuery = async (queryStr: string, mode: 'search' | 'hash') => {
        if (!queryStr || queryStr.trim().length < 2) return;
        setIsSearching(true);
        setLastBatchResult(null);

        try {
            let targetCoordinator: Registrant | null = null;
            let batchRef = '';
            let provinceName = '';
            let regionName = '';

            // 1. Locate coordinator or initial record
            if (mode === 'hash') {
                const { data } = await supabase
                    .from('registrations')
                    .select('*')
                    .eq('qr_code_hash', queryStr)
                    .limit(1);

                if (data && data.length > 0) {
                    targetCoordinator = data[0];
                    batchRef = targetCoordinator.batch_reference || '';
                    provinceName = targetCoordinator.province || '';
                    regionName = targetCoordinator.region || '';
                }
            } else {
                const clean = queryStr.trim().toLowerCase();
                const { data } = await supabase
                    .from('registrations')
                    .select('*')
                    .or(`full_name.ilike.%${clean}%,phone.ilike.%${clean}%,batch_reference.ilike.%${clean}%`)
                    .order('category', { ascending: false }) // Prioritize teachers/adults first
                    .limit(1);

                if (data && data.length > 0) {
                    targetCoordinator = data[0];
                    batchRef = targetCoordinator.batch_reference || '';
                    provinceName = targetCoordinator.province || '';
                    regionName = targetCoordinator.region || '';
                }
            }

            if (!targetCoordinator) {
                toast.error('Not Found', 'No coordinator or batch registration matches that query.');
                setIsSearching(false);
                return;
            }

            // 2. Load delegates in this batch / province
            let delegatesQuery = supabase.from('registrations').select('*');
            if (batchRef && batchRef !== 'DEFAULT' && batchRef !== '-') {
                delegatesQuery = delegatesQuery.eq('batch_reference', batchRef);
            } else if (provinceName) {
                delegatesQuery = delegatesQuery.eq('province', provinceName);
            } else {
                delegatesQuery = delegatesQuery.eq('id', targetCoordinator.id);
            }

            const { data: allGroupDelegates, error: fetchErr } = await delegatesQuery.order('full_name', { ascending: true });

            if (fetchErr) throw fetchErr;

            const group = allGroupDelegates || [targetCoordinator];
            setupGroupRoster(
                targetCoordinator.full_name,
                targetCoordinator.phone,
                provinceName || targetCoordinator.province || 'General',
                regionName || targetCoordinator.region || 'General',
                batchRef,
                group
            );

        } catch (err: any) {
            console.error('Error loading group:', err);
            toast.error('Search Error', err.message || 'Failed to retrieve contingent records.');
        } finally {
            setIsSearching(false);
        }
    };

    // Load group by Province & Region selection
    const loadGroupByProvince = async () => {
        if (!selectedProvince) return;
        setIsSearching(true);
        setLastBatchResult(null);

        try {
            const delegates = await fetchAllSupabaseRows<Registrant>(() =>
                supabase
                    .from('registrations')
                    .select('*')
                    .eq('province', selectedProvince)
                    .order('category', { ascending: false })
                    .order('full_name', { ascending: true })
            );

            if (!delegates || delegates.length === 0) {
                toast.error('No Records', `No delegates found for ${selectedProvince}.`);
                setIsSearching(false);
                return;
            }

            // Find coordinator (teacher/adult) if present
            const coordinator = delegates.find(d => d.category?.toLowerCase().includes('teacher') || d.category?.toLowerCase().includes('adult'));
            const coordinatorName = coordinator ? coordinator.full_name : `${selectedProvince} Contingent`;
            const coordinatorPhone = coordinator ? coordinator.phone : undefined;

            setupGroupRoster(
                coordinatorName,
                coordinatorPhone,
                selectedProvince,
                selectedRegion,
                undefined,
                delegates
            );

        } catch (err: any) {
            console.error('Error loading province delegates:', err);
            toast.error('Load Error', 'Failed to retrieve province delegates.');
        } finally {
            setIsSearching(false);
        }
    };

    // Setup Group Roster and Initial Headcount
    const setupGroupRoster = (
        coordinatorName: string,
        coordinatorPhone: string | undefined,
        province: string,
        region: string,
        batchReference: string | undefined,
        delegates: Registrant[]
    ) => {
        setLoadedGroup({
            coordinatorName,
            coordinatorPhone,
            province,
            region,
            batchReference,
            delegates
        });

        // Pre-select all eligible delegates (cleared & not yet checked in)
        const eligible = delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        const initialSelected = new Set(eligible.map(d => d.id));
        setSelectedDelegateIds(initialSelected);
        setHeadcountInput(initialSelected.size);
    };

    // Headcount Stepper Adjusters
    const adjustHeadcount = (delta: number) => {
        if (!loadedGroup) return;
        const eligible = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        const newCount = Math.max(0, Math.min(eligible.length, headcountInput + delta));
        setHeadcountInput(newCount);

        // Auto-select the first N eligible delegates matching headcount
        const autoSelected = new Set(eligible.slice(0, newCount).map(d => d.id));
        setSelectedDelegateIds(autoSelected);
    };

    const handleManualHeadcountChange = (val: number) => {
        if (!loadedGroup) return;
        const eligible = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        const validCount = Math.max(0, Math.min(eligible.length, val));
        setHeadcountInput(validCount);
        const autoSelected = new Set(eligible.slice(0, validCount).map(d => d.id));
        setSelectedDelegateIds(autoSelected);
    };

    const addPresetHeadcount = (amount: number) => {
        if (!loadedGroup) return;
        const eligible = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        const newCount = Math.max(0, Math.min(eligible.length, headcountInput + amount));
        setHeadcountInput(newCount);
        const autoSelected = new Set(eligible.slice(0, newCount).map(d => d.id));
        setSelectedDelegateIds(autoSelected);
    };

    const setExactHeadcount = (count: number) => {
        if (!loadedGroup) return;
        const eligible = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        const valid = Math.max(0, Math.min(eligible.length, count));
        setHeadcountInput(valid);
        const autoSelected = new Set(eligible.slice(0, valid).map(d => d.id));
        setSelectedDelegateIds(autoSelected);
    };

    const resetHeadcount = () => {
        setHeadcountInput(0);
        setSelectedDelegateIds(new Set());
    };

    // Toggle individual checkbox
    const toggleDelegate = (id: string) => {
        const next = new Set(selectedDelegateIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedDelegateIds(next);
        setHeadcountInput(next.size);
    };

    // Select / Deselect All
    const toggleSelectAll = () => {
        if (!loadedGroup) return;
        const eligible = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        });

        if (selectedDelegateIds.size === eligible.length) {
            setSelectedDelegateIds(new Set());
            setHeadcountInput(0);
        } else {
            const all = new Set(eligible.map(d => d.id));
            setSelectedDelegateIds(all);
            setHeadcountInput(all.size);
        }
    };

    // Submit Batch Check-in
    const handleBatchSubmit = async () => {
        if (!loadedGroup || selectedDelegateIds.size === 0) return;

        const count = selectedDelegateIds.size;
        const targetTag = batchTag === 'Custom' ? (customTag.trim() || 'Custom Batch') : batchTag;
        const pendingBefore = loadedGroup.delegates.filter(d => {
            const isCleared = d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed';
            const isRejected = d.status?.toLowerCase() === 'rejected' || d.payment_status?.toLowerCase() === 'rejected';
            return isCleared && !isRejected && !d.checked_in;
        }).length;
        const remainingOutside = Math.max(0, pendingBefore - count);

        const confirmed = await confirm({
            type: 'success',
            title: `Confirm Headcount: ${count} Delegates (${targetTag})`,
            body: `Are you sure you want to admit ${count} delegates from ${loadedGroup.province} in this batch [${targetTag}]? ${remainingOutside} delegates will remain outside for subsequent arrivals.`,
            confirmText: `Check In ${count} Delegates Now`
        });

        if (!confirmed) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/batch-checkin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    registration_ids: Array.from(selectedDelegateIds),
                    coordinator_name: loadedGroup.coordinatorName,
                    province: loadedGroup.province,
                    region: loadedGroup.region,
                    batch_reference: loadedGroup.batchReference,
                    headcount_verified: headcountInput,
                    batch_label: targetTag,
                    performed_by: volunteerName
                })
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                // Update local delegates status
                const checkedIds = new Set(data.updated_ids || Array.from(selectedDelegateIds));
                setLoadedGroup(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        delegates: prev.delegates.map(d => 
                            checkedIds.has(d.id) 
                                ? { ...d, checked_in: true, checked_in_at: new Date().toISOString() } 
                                : d
                        )
                    };
                });

                setSelectedDelegateIds(new Set());
                setHeadcountInput(0);

                // Auto-advance next bus label
                if (batchTag === 'Bus 1') setBatchTag('Bus 2');
                else if (batchTag === 'Bus 2') setBatchTag('Bus 3');
                else if (batchTag === 'Batch 1') setBatchTag('Batch 2');

                setLastBatchResult({
                    count: data.checked_in_count,
                    coordinatorName: loadedGroup.coordinatorName,
                    province: loadedGroup.province,
                    headcount: count,
                    batchTag: targetTag,
                    remainingAfter: remainingOutside
                });

                toast.success('Batch Check-In Complete!', `Successfully checked in ${data.checked_in_count} delegates for ${targetTag}.`);

                if (onBatchSuccess) {
                    onBatchSuccess({
                        count: data.checked_in_count,
                        coordinatorName: loadedGroup.coordinatorName,
                        province: loadedGroup.province,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                }

            } else {
                toast.error('Batch Check-In Failed', data.message || data.error || 'Server rejected batch check-in.');
            }
        } catch (err: any) {
            console.error('Batch submit fail:', err);
            toast.error('Network Error', 'Failed to communicate with check-in server.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Compute roster stats
    const rosterStats = useMemo(() => {
        if (!loadedGroup) return { total: 0, cleared: 0, checkedIn: 0, pending: 0 };
        const total = loadedGroup.delegates.length;
        const checkedIn = loadedGroup.delegates.filter(d => d.checked_in).length;
        const cleared = loadedGroup.delegates.filter(d => d.payment_status?.toLowerCase() === 'cleared' || d.status?.toLowerCase() === 'confirmed').length;
        const pending = Math.max(0, cleared - checkedIn);
        return { total, cleared, checkedIn, pending };
    }, [loadedGroup]);

    // Compute visual arrival progress percentages
    const arrivalPercentages = useMemo(() => {
        if (!loadedGroup || rosterStats.cleared === 0) {
            return { admittedPct: 0, currentBatchPct: 0, remainingAfter: 0, remainingPct: 0 };
        }
        const totalCleared = rosterStats.cleared;
        const admittedPct = Math.round((rosterStats.checkedIn / totalCleared) * 100);
        const currentBatchPct = Math.round((headcountInput / totalCleared) * 100);
        const remainingAfter = Math.max(0, rosterStats.pending - headcountInput);
        const remainingPct = Math.max(0, 100 - admittedPct - currentBatchPct);
        return { admittedPct, currentBatchPct, remainingAfter, remainingPct };
    }, [loadedGroup, rosterStats, headcountInput]);

    // Filter delegates by search term
    const visibleDelegates = useMemo(() => {
        if (!loadedGroup) return [];
        if (!filterQuery.trim()) return loadedGroup.delegates;
        const q = filterQuery.toLowerCase();
        return loadedGroup.delegates.filter(d => 
            d.full_name?.toLowerCase().includes(q) ||
            d.batch_reference?.toLowerCase().includes(q) ||
            d.phone?.includes(q)
        );
    }, [loadedGroup, filterQuery]);

    return (
        <div className="space-y-6">
            {/* SELECTION / LOOKUP CARD */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800 tracking-tight">
                                Coordinator & Contingent Headcount Check-In
                            </h3>
                            <p className="text-xs text-slate-500">
                                Verify physical group headcount and check in up to 100+ delegates in one tap.
                            </p>
                        </div>
                    </div>

                    {/* Mode Buttons */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                        <button
                            onClick={() => { setLookupMode('search'); stopScanner(); }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                lookupMode === 'search' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Search className="w-3.5 h-3.5 inline mr-1" />
                            Search
                        </button>
                        <button
                            onClick={() => { setLookupMode('scan'); startScanner(); }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                lookupMode === 'scan' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Camera className="w-3.5 h-3.5 inline mr-1" />
                            Scan QR
                        </button>
                        <button
                            onClick={() => { setLookupMode('province'); stopScanner(); }}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                lookupMode === 'province' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Filter className="w-3.5 h-3.5 inline mr-1" />
                            By Province
                        </button>
                    </div>
                </div>

                {/* MODE 1: SEARCH COORDINATOR */}
                {lookupMode === 'search' && (
                    <form onSubmit={(e) => { e.preventDefault(); loadGroupByQuery(searchQuery, 'search'); }} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <Input
                                placeholder="Enter Coordinator Name, Phone, or Batch REF..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl text-slate-800 focus:bg-white text-xs sm:text-sm"
                            />
                        </div>
                        <Button
                            type="submit"
                            disabled={isSearching || searchQuery.trim().length < 2}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-11 px-5 rounded-xl text-xs sm:text-sm shadow-sm shrink-0"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find Group'}
                        </Button>
                    </form>
                )}

                {/* MODE 2: SCAN COORDINATOR QR */}
                {lookupMode === 'scan' && (
                    <div className="space-y-3">
                        <div className="relative bg-slate-950 overflow-hidden flex items-center justify-center rounded-2xl border border-slate-800 max-h-[260px] aspect-video mx-auto">
                            <div id="batch-coordinator-qr-viewfinder" className="w-full h-full" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <div className="w-40 h-40 border-4 border-dashed border-orange-500 rounded-2xl relative shadow-[0_0_15px_rgba(249,115,22,0.3)]" />
                            </div>
                        </div>
                        <p className="text-center text-xs text-slate-400">
                            Point camera at the Coordinator's QR Code.
                        </p>
                    </div>
                )}

                {/* MODE 3: SELECT BY PROVINCE */}
                {lookupMode === 'province' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                            <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                Region
                            </label>
                            <select
                                value={selectedRegion}
                                onChange={e => {
                                    setSelectedRegion(e.target.value);
                                    setSelectedProvince('');
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-orange-500"
                            >
                                {Object.keys(REGIONS_AND_PROVINCES).map(reg => (
                                    <option key={reg} value={reg}>{reg}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                                Province
                            </label>
                            <select
                                value={selectedProvince}
                                onChange={e => setSelectedProvince(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-none focus:border-orange-500"
                            >
                                {availableProvinces.map(prov => (
                                    <option key={prov} value={prov}>{prov}</option>
                                ))}
                            </select>
                        </div>

                        <Button
                            onClick={loadGroupByProvince}
                            disabled={isSearching || !selectedProvince}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-10.5 rounded-xl text-xs sm:text-sm shadow-sm"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                            Load Province Roster
                        </Button>
                    </div>
                )}
            </div>

            {/* SUCCESS BANNER NOTIFICATION */}
            {lastBatchResult && (
                <div className="bg-emerald-500 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-base flex items-center gap-2">
                                <span>✓ {lastBatchResult.count} Delegates Admitted!</span>
                                <span className="bg-white/20 text-xs px-2.5 py-0.5 rounded-full font-bold">
                                    {lastBatchResult.batchTag}
                                </span>
                            </h4>
                            <p className="text-xs text-emerald-100 mt-0.5">
                                {lastBatchResult.province} • Coordinator: <strong>{lastBatchResult.coordinatorName}</strong>
                                {lastBatchResult.remainingAfter > 0 ? (
                                    <span className="block sm:inline sm:ml-2 font-bold text-amber-200">
                                        • {lastBatchResult.remainingAfter} delegates remaining for subsequent buses
                                    </span>
                                ) : (
                                    <span className="block sm:inline sm:ml-2 font-bold text-white">
                                        • All delegates in contingent fully admitted!
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setLastBatchResult(null)}
                        className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-xs h-9 px-4 rounded-xl shrink-0 self-end sm:self-auto cursor-pointer"
                    >
                        Dismiss
                    </Button>
                </div>
            )}

            {/* LOADED ROSTER & HEADCOUNT CONTROLLER */}
            {loadedGroup && (
                <div className="space-y-5 animate-in fade-in duration-300">
                    {/* GROUP SUMMARY CARD */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                            <div>
                                <span className="text-[10px] font-mono font-bold text-orange-600 uppercase tracking-widest block">
                                    VERIFIED CONTINGENT
                                </span>
                                <h3 className="text-lg font-black text-slate-800 mt-0.5">
                                    {loadedGroup.coordinatorName}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                    {loadedGroup.province} • {loadedGroup.region} {loadedGroup.batchReference ? `• Batch: ${loadedGroup.batchReference}` : ''}
                                </p>
                            </div>

                            {/* 4 Quick Stat Badges */}
                            <div className="grid grid-cols-4 gap-2 text-center shrink-0">
                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Total</span>
                                    <span className="text-sm font-black text-slate-800 block">{rosterStats.total}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Cleared</span>
                                    <span className="text-sm font-black text-blue-600 block">{rosterStats.cleared}</span>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-emerald-600 block uppercase">Admitted</span>
                                    <span className="text-sm font-black text-emerald-700 block">{rosterStats.checkedIn}</span>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                                    <span className="text-[9px] font-bold text-amber-600 block uppercase">Outside</span>
                                    <span className="text-sm font-black text-amber-700 block">{rosterStats.pending}</span>
                                </div>
                            </div>
                        </div>

                        {/* VISUAL STACKED PROGRESS BAR */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                    Admitted: {rosterStats.checkedIn} ({arrivalPercentages.admittedPct}%)
                                </span>
                                {headcountInput > 0 && (
                                    <span className="flex items-center gap-1.5 text-orange-600">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block animate-pulse" />
                                        This Batch: +{headcountInput} ({arrivalPercentages.currentBatchPct}%)
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5 text-slate-400">
                                    Remaining Outside: {arrivalPercentages.remainingAfter} ({arrivalPercentages.remainingPct}%)
                                </span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                <div 
                                    style={{ width: `${arrivalPercentages.admittedPct}%` }} 
                                    className="bg-emerald-500 h-full transition-all duration-300" 
                                    title={`Admitted: ${rosterStats.checkedIn}`}
                                />
                                <div 
                                    style={{ width: `${arrivalPercentages.currentBatchPct}%` }} 
                                    className="bg-orange-500 h-full transition-all duration-300" 
                                    title={`This Batch: ${headcountInput}`}
                                />
                                <div 
                                    style={{ width: `${arrivalPercentages.remainingPct}%` }} 
                                    className="bg-slate-200 h-full transition-all duration-300" 
                                    title={`Remaining Outside: ${arrivalPercentages.remainingAfter}`}
                                />
                            </div>
                        </div>

                        {/* STAGGERED BATCH & HEADCOUNT CONTROLLER */}
                        <div className="bg-orange-50/70 border-2 border-orange-200 rounded-2xl p-4 sm:p-5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <Bus className="w-5 h-5 text-orange-600" />
                                        <h4 className="text-sm font-bold text-slate-900">
                                            Admit by Headcount (Staggered Bus / Batch Arrival)
                                        </h4>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Enter the number of teens arriving on this bus or in this contingent. No need to look up individual names.
                                    </p>
                                </div>

                                {/* Bus / Batch Tag Selector */}
                                <div className="flex items-center flex-wrap gap-1.5">
                                    {['Bus 1', 'Bus 2', 'Bus 3', 'Batch 1', 'Custom'].map(tag => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => setBatchTag(tag)}
                                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                                batchTag === tag 
                                                    ? 'bg-orange-500 text-white border-orange-600 shadow-sm' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom Label Input if 'Custom' is selected */}
                            {batchTag === 'Custom' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-600">Batch Label:</span>
                                    <Input
                                        placeholder="e.g. Coaster Bus A, Ikeja Parish..."
                                        value={customTag}
                                        onChange={e => setCustomTag(e.target.value)}
                                        className="h-9 text-xs bg-white border-slate-200 rounded-xl max-w-xs"
                                    />
                                </div>
                            )}

                            {/* STEPPER & NUMERIC INPUT + QUICK PRESETS */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
                                {/* Stepper Row */}
                                <div className="flex items-center gap-3 self-center lg:self-auto">
                                    <button
                                        type="button"
                                        onClick={() => adjustHeadcount(-1)}
                                        disabled={headcountInput <= 0}
                                        className="w-11 h-11 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                                    >
                                        <Minus size={20} />
                                    </button>

                                    <div className="relative text-center">
                                        <input
                                            type="number"
                                            min={0}
                                            max={rosterStats.pending}
                                            value={headcountInput}
                                            onChange={(e) => handleManualHeadcountChange(parseInt(e.target.value, 10) || 0)}
                                            className="w-24 h-12 text-center font-black text-2xl text-slate-800 bg-white border-2 border-orange-400 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                        <span className="text-[9px] font-mono text-slate-400 block text-center mt-0.5 font-bold">
                                            OF {rosterStats.pending} OUTSIDE
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => adjustHeadcount(1)}
                                        disabled={headcountInput >= rosterStats.pending}
                                        className="w-11 h-11 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>

                                {/* Quick Add Preset Chips */}
                                <div className="flex items-center flex-wrap gap-1.5 justify-center lg:justify-end">
                                    {[5, 10, 20, 30, 50].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => addPresetHeadcount(n)}
                                            disabled={headcountInput + n > rosterStats.pending}
                                            className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 text-slate-700 transition-all shadow-2xs disabled:opacity-30 cursor-pointer"
                                        >
                                            +{n}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={selectAllRemaining}
                                        disabled={rosterStats.pending === 0}
                                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-sm disabled:opacity-40 cursor-pointer"
                                    >
                                        All Remaining ({rosterStats.pending})
                                    </button>
                                    {headcountInput > 0 && (
                                        <button
                                            type="button"
                                            onClick={resetHeadcount}
                                            className="text-xs font-bold px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3-COLUMN CALCULATION IMPACT CARDS */}
                            <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-orange-200/60">
                                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">1. Already Inside</span>
                                    <span className="text-base font-black text-emerald-700 block mt-0.5">{rosterStats.checkedIn}</span>
                                    <span className="text-[9px] text-slate-500 font-mono">({arrivalPercentages.admittedPct}%)</span>
                                </div>
                                <div className="bg-white p-2.5 rounded-xl border-2 border-orange-300 shadow-2xs">
                                    <span className="text-[10px] font-bold text-orange-600 block uppercase">2. Admitting This Batch</span>
                                    <span className="text-base font-black text-orange-600 block mt-0.5">+{headcountInput}</span>
                                    <span className="text-[9px] text-orange-500 font-mono font-bold">[{batchTag === 'Custom' ? (customTag || 'Custom') : batchTag}]</span>
                                </div>
                                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-400 block uppercase">3. Next Bus Remaining</span>
                                    <span className="text-base font-black text-amber-700 block mt-0.5">{arrivalPercentages.remainingAfter}</span>
                                    <span className="text-[9px] text-slate-500 font-mono">({arrivalPercentages.remainingPct}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* COLLAPSIBLE DELEGATE NAMES REVIEW (OPTIONAL) */}
                        <div className="border border-slate-200 rounded-2xl overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setShowDelegateList(!showDelegateList)}
                                className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-2">
                                    {showDelegateList ? (
                                        <ChevronUp className="w-4 h-4 text-slate-500" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-500" />
                                    )}
                                    <span className="text-xs font-bold text-slate-700">
                                        {showDelegateList ? 'Hide' : 'Review'} Individual Delegate Names ({loadedGroup.delegates.length} delegates)
                                    </span>
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-mono font-bold">
                                        Optional
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400 font-medium">
                                    {showDelegateList ? 'Click to collapse' : 'Click to inspect or uncheck specific names'}
                                </span>
                            </button>

                            {showDelegateList && (
                                <div className="p-4 space-y-3 bg-white border-t border-slate-200">
                                    {/* ROSTER TABLE TOOLBAR */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={toggleSelectAll}
                                                disabled={rosterStats.pending === 0}
                                                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                                            >
                                                {selectedDelegateIds.size === rosterStats.pending && rosterStats.pending > 0 ? (
                                                    <CheckSquare className="w-4 h-4 text-orange-500" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-400" />
                                                )}
                                                <span>Select All Pending ({rosterStats.pending})</span>
                                            </button>

                                            <span className="text-xs font-mono text-slate-400">•</span>

                                            <span className="text-xs font-bold text-orange-600">
                                                {selectedDelegateIds.size} Selected for Check-In
                                            </span>
                                        </div>

                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <Input
                                                placeholder="Filter by name..."
                                                value={filterQuery}
                                                onChange={e => setFilterQuery(e.target.value)}
                                                className="pl-8 h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    {/* DELEGATE ROSTER LIST */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                                        {visibleDelegates.map((delegate) => {
                                            const isCheckedIn = delegate.checked_in;
                                            const isCleared = delegate.payment_status?.toLowerCase() === 'cleared' || delegate.status?.toLowerCase() === 'confirmed';
                                            const isRejected = delegate.status?.toLowerCase() === 'rejected' || delegate.payment_status?.toLowerCase() === 'rejected';
                                            const isEligible = isCleared && !isRejected && !isCheckedIn;
                                            const isSelected = selectedDelegateIds.has(delegate.id);

                                            return (
                                                <div
                                                    key={delegate.id}
                                                    onClick={() => {
                                                        if (isEligible) toggleDelegate(delegate.id);
                                                    }}
                                                    className={`p-3 text-xs flex items-center justify-between gap-3 transition-colors ${
                                                        isCheckedIn 
                                                            ? 'bg-emerald-50/40 text-slate-400' 
                                                            : isSelected 
                                                                ? 'bg-orange-50/70 border-l-4 border-orange-500 font-semibold' 
                                                                : 'hover:bg-slate-50 cursor-pointer'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        {isEligible ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleDelegate(delegate.id)}
                                                                className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                                            />
                                                        ) : isCheckedIn ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        ) : (
                                                            <XCircle className="w-4 h-4 text-slate-300 shrink-0" />
                                                        )}

                                                        <div className="min-w-0">
                                                            <p className={`font-bold truncate ${isCheckedIn ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                                                {delegate.full_name}
                                                            </p>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-medium">
                                                                <span className="font-mono">{delegate.batch_reference || 'REF'}</span>
                                                                <span>•</span>
                                                                <span>{delegate.category}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex items-center gap-2">
                                                        {isCheckedIn ? (
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                                In Hall ✓
                                                            </span>
                                                        ) : isCleared ? (
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                isSelected ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                            }`}>
                                                                {isSelected ? 'Ready' : 'Cleared'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                                                Payment Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* BOTTOM ACTION BUTTON */}
                        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-xs text-slate-500 font-medium">
                                Admitting <strong>{selectedDelegateIds.size} delegates</strong> for <strong>{loadedGroup.province}</strong> ({batchTag === 'Custom' ? (customTag || 'Custom') : batchTag}).
                            </span>

                            <Button
                                onClick={handleBatchSubmit}
                                disabled={isSubmitting || selectedDelegateIds.size === 0}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-black text-sm h-12 px-8 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-40"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span>Check In {selectedDelegateIds.size} Delegates ({batchTag === 'Custom' ? (customTag || 'Custom') : batchTag}) Now</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
