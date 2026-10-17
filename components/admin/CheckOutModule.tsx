import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    Camera, Search, Users, CheckCircle2, AlertTriangle, 
    XCircle, RotateCw, Lightbulb, Smartphone, 
    Wifi, WifiOff, Clock, ArrowRight, Loader2, DoorOpen, LogIn,
    RefreshCw, Volume2, ShieldAlert, Sparkles, UserCheck
} from 'lucide-react';

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

interface RestroomActivityItem {
    id: string;
    full_name: string;
    category: string;
    region: string;
    province: string;
    type: 'checkout' | 'reentry';
    timestamp: string;
    minutes_out?: number;
}

export default function CheckOutModule({ isSidebarOpen = false }: { isSidebarOpen?: boolean }) {
    const { toast } = useDialog();
    const [scannerMode, setScannerMode] = useState<'auto' | 'checkout' | 'reentry'>('auto');
    const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);

    // Scanner states
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isFlashlightOn, setIsFlashlightOn] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Registrant[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Overlay feedback state
    const [overlayState, setOverlayState] = useState<{
        show: boolean;
        type: 'checkout' | 'reentry' | 'not_checked_in' | 'not_found' | 'error';
        title: string;
        message: string;
        record: Registrant | null;
        minutesOut?: number;
        timestamp?: string;
    }>({
        show: false,
        type: 'checkout',
        title: '',
        message: '',
        record: null
    });

    // Activity Stream & Active Out Count
    const [recentActivity, setRecentActivity] = useState<RestroomActivityItem[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = sessionStorage.getItem('c3tc_checkout_activity');
                return saved ? JSON.parse(saved) : [];
            } catch {
                return [];
            }
        }
        return [];
    });

    const [activeOutCount, setActiveOutCount] = useState<number>(0);

    // Volunteer operator name
    const volunteerName = typeof window !== 'undefined' 
        ? sessionStorage.getItem('c3tc_admin_volunteer') || 'Exit Gate Usher' 
        : 'Exit Gate Usher';

    // Play tone audio helper
    const playTone = (type: 'checkout' | 'reentry' | 'error') => {
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'checkout') {
                // Warm double beep (amber)
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'reentry') {
                // High bright triad chord (cyan)
                osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
            } else {
                // Low buzz (rejection)
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            }
        } catch {}
    };

    // Calculate initial active out count from audit logs
    useEffect(() => {
        async function fetchActiveOutCount() {
            try {
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                const { data: checkouts } = await supabase
                    .from('audit_log')
                    .select('registration_id, created_at')
                    .eq('action', 'restroom_checkout')
                    .gte('created_at', todayMidnight.toISOString());

                const { data: reentries } = await supabase
                    .from('audit_log')
                    .select('registration_id')
                    .eq('action', 'restroom_reentry')
                    .gte('created_at', todayMidnight.toISOString());

                if (checkouts) {
                    const reenteredIds = new Set((reentries || []).map(r => r.registration_id));
                    const currentlyOut = checkouts.filter(c => !reenteredIds.has(c.registration_id));
                    // Remove duplicates
                    const uniqueOut = new Set(currentlyOut.map(c => c.registration_id));
                    setActiveOutCount(uniqueOut.size);
                }
            } catch (err) {
                console.warn('Error fetching active restroom count:', err);
            }
        }

        fetchActiveOutCount();
    }, []);

    // Camera scanner start
    const startScanner = async () => {
        if (isScannerActive || isCameraLoading) return;
        setIsCameraLoading(true);

        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch {}
        }

        try {
            const html5QrCode = new Html5Qrcode('checkout-qr-viewfinder');
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode },
                {
                    fps: 10,
                    qrbox: (w, h) => {
                        const size = Math.min(w, h) * 0.7;
                        return { width: size, height: size };
                    }
                },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => {}
            );

            setHasCameraPermission(true);
            setIsScannerActive(true);
        } catch (err) {
            console.error('Camera start error in CheckOutModule:', err);
            setHasCameraPermission(false);
        } finally {
            setIsCameraLoading(false);
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

    // Toggle camera lens
    const toggleCamera = () => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    useEffect(() => {
        if (activeTab === 'qr' && !overlayState.show) {
            startScanner();
        } else {
            stopScanner();
        }
        return () => {
            stopScanner();
        };
    }, [activeTab, facingMode]);

    // Torch
    const toggleFlashlight = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                const next = !isFlashlightOn;
                const stream = (html5QrCodeRef.current as any).localMediaStream;
                if (stream) {
                    const track = stream.getVideoTracks()[0];
                    if (track?.getCapabilities()?.torch) {
                        await track.applyConstraints({ advanced: [{ torch: next }] });
                        setIsFlashlightOn(next);
                    }
                }
            } catch {}
        }
    };

    // Main Scan Success Handler
    const handleScanSuccess = async (decodedText: string) => {
        await stopScanner();

        let hash = decodedText.trim();
        // Support full URLs if someone scans the URL instead of hash
        if (hash.includes('/')) {
            const parts = hash.split('/');
            hash = parts[parts.length - 1];
        }

        processTransition({ hash });
    };

    // Process Transition (Check-Out or Re-Entry)
    const processTransition = async (identifier: { hash?: string; id?: string }) => {
        try {
            const res = await fetch('/api/admin/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    qr_code_hash: identifier.hash,
                    registration_id: identifier.id,
                    mode: scannerMode,
                    performed_by: volunteerName
                })
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok && data.success) {
                if (data.type === 'checkout') {
                    // RESTROOM PASS ISSUED (AMBER)
                    playTone('checkout');
                    setActiveOutCount(prev => prev + 1);

                    const newActivity: RestroomActivityItem = {
                        id: data.record.id,
                        full_name: data.record.full_name,
                        category: data.record.category,
                        region: data.record.region,
                        province: data.record.province,
                        type: 'checkout',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };

                    setRecentActivity(prev => {
                        const updated = [newActivity, ...prev].slice(0, 30);
                        sessionStorage.setItem('c3tc_checkout_activity', JSON.stringify(updated));
                        return updated;
                    });

                    setOverlayState({
                        show: true,
                        type: 'checkout',
                        title: 'Restroom Pass Issued',
                        message: `Temporary exit pass active for ${data.record.full_name}. Please return within 20-30 minutes.`,
                        record: data.record,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                } else {
                    // RE-ENTRY CONFIRMED (CYAN)
                    playTone('reentry');
                    setActiveOutCount(prev => Math.max(0, prev - 1));

                    const newActivity: RestroomActivityItem = {
                        id: data.record.id,
                        full_name: data.record.full_name,
                        category: data.record.category,
                        region: data.record.region,
                        province: data.record.province,
                        type: 'reentry',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        minutes_out: data.minutes_out
                    };

                    setRecentActivity(prev => {
                        const updated = [newActivity, ...prev].slice(0, 30);
                        sessionStorage.setItem('c3tc_checkout_activity', JSON.stringify(updated));
                        return updated;
                    });

                    setOverlayState({
                        show: true,
                        type: 'reentry',
                        title: 'Re-Entry Authorized!',
                        message: `Welcome back, ${data.record.full_name}! Re-entry confirmed.`,
                        record: data.record,
                        minutesOut: data.minutes_out,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    });
                }
            } else if (res.status === 400 && data.error === 'Not Checked In') {
                // REJECTION: Never checked in at Gate 1
                playTone('error');
                setOverlayState({
                    show: true,
                    type: 'not_checked_in',
                    title: 'Not Checked In at Gate 1',
                    message: data.message || 'This delegate has not completed primary entry at Gate 1.',
                    record: data.record
                });
            } else {
                playTone('error');
                setOverlayState({
                    show: true,
                    type: 'error',
                    title: data.error || 'Verification Error',
                    message: data.message || 'Could not verify credential. Direct delegate to the Help Desk.',
                    record: data.record || null
                });
            }
        } catch (err: any) {
            playTone('error');
            setOverlayState({
                show: true,
                type: 'error',
                title: 'Network Error',
                message: 'Failed to communicate with check-out API. Please retry.',
                record: null
            });
        }
    };

    const handleDismissOverlay = () => {
        setOverlayState(prev => ({ ...prev, show: false }));
        if (activeTab === 'qr') {
            setTimeout(() => {
                startScanner();
            }, 150);
        }
    };

    // Manual search handler
    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,batch_reference.ilike.%${q}%`)
                .limit(10);

            if (!error && data) {
                setSearchResults(data as Registrant[]);
            } else {
                setSearchResults([]);
            }
        } catch {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* TOP HEADER */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <DoorOpen className="w-5 h-5" />
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight font-heading">
                                Restroom Check-Out & Re-Entry Scanner
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400">
                            Dedicated gate control for restroom exits and re-entries. Keeps Gate 1 entry stream 100% untouched.
                        </p>
                    </div>

                    {/* LIVE OCCUPANCY STATUS PILL */}
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                            <div>
                                <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                                    Currently on Restroom Break
                                </span>
                                <span className="text-base font-black text-amber-400">
                                    {activeOutCount} {activeOutCount === 1 ? 'Delegate' : 'Delegates'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SCANNER MODE CONTROL BAR */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400">Scanner Mode:</span>
                        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                            <button
                                onClick={() => setScannerMode('auto')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    scannerMode === 'auto'
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Smart Auto-Detect
                            </button>
                            <button
                                onClick={() => setScannerMode('checkout')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    scannerMode === 'checkout'
                                        ? 'bg-amber-500 text-black font-black shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Check-Out (Exit)
                            </button>
                            <button
                                onClick={() => setScannerMode('reentry')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${
                                    scannerMode === 'reentry'
                                        ? 'bg-cyan-500 text-black font-black shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Re-Entry (Return)
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span>Station: Exit Gate</span>
                        <span>•</span>
                        <span>Usher: {volunteerName}</span>
                    </div>
                </div>
            </div>

            {/* TAB SELECTOR: CAMERA VS MANUAL LOOKUP */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                    onClick={() => setActiveTab('qr')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'qr'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Camera className="w-4 h-4" />
                    <span>Live Camera Scanner</span>
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'manual'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                >
                    <Search className="w-4 h-4" />
                    <span>Manual Lookup (Name / Phone)</span>
                </button>
            </div>

            {/* TAB 1: CAMERA SCANNER */}
            {activeTab === 'qr' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* CAMERA VIEWFINDER */}
                    <div className="lg:col-span-2 space-y-3">
                        <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-slate-800 shadow-2xl min-h-[380px] flex items-center justify-center">
                            {/* html5-qrcode viewfinder container */}
                            <div id="checkout-qr-viewfinder" className="w-full h-full max-h-[500px]" />

                            {/* Camera Controls Overlay */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                                <button
                                    onClick={toggleFlashlight}
                                    className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-amber-400 backdrop-blur-md shadow-lg"
                                    title="Toggle Flashlight"
                                >
                                    <Lightbulb className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={toggleCamera}
                                    className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white backdrop-blur-md shadow-lg"
                                    title="Switch Camera (Front/Rear)"
                                >
                                    <RotateCw className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Mode Indicator Tag */}
                            <div className="absolute bottom-4 left-4 z-20">
                                <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-lg ${
                                    scannerMode === 'checkout'
                                        ? 'bg-amber-500 text-black'
                                        : scannerMode === 'reentry'
                                            ? 'bg-cyan-400 text-black'
                                            : 'bg-gradient-to-r from-amber-400 to-cyan-400 text-black'
                                }`}>
                                    {scannerMode === 'checkout' ? 'Check-Out Mode Active' : scannerMode === 'reentry' ? 'Re-Entry Mode Active' : 'Smart Auto-Detect Active'}
                                </span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 text-center">
                            Point camera at the printed paper QR code or delegate's phone. Works instantly.
                        </p>
                    </div>

                    {/* RECENT ACTIVITY STREAM */}
                    <div className="lg:col-span-1 space-y-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-orange-400" />
                                    <span>Recent Gate Activity</span>
                                </h3>
                                <span className="text-[10px] font-mono text-slate-500">
                                    {recentActivity.length} events
                                </span>
                            </div>

                            {recentActivity.length === 0 ? (
                                <div className="text-center py-10 text-slate-500 text-xs">
                                    No exit or re-entry scans yet.
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                                    {recentActivity.map((item, idx) => (
                                        <div
                                            key={`${item.id}-${idx}`}
                                            className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
                                                item.type === 'checkout'
                                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                                                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-200'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 font-bold truncate">
                                                    <span>{item.full_name}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                                                    {item.category} • {item.province}
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    item.type === 'checkout'
                                                        ? 'bg-amber-500 text-black'
                                                        : 'bg-cyan-400 text-black'
                                                }`}>
                                                    {item.type === 'checkout' ? 'OUT' : 'RE-ENTER'}
                                                </span>
                                                <span className="text-[10px] font-mono text-slate-400 block mt-1">
                                                    {item.timestamp}
                                                    {item.minutes_out ? ` (${item.minutes_out}m)` : ''}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: MANUAL LOOKUP */}
            {activeTab === 'manual' && (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <Input
                            placeholder="Enter delegate full name, phone number, or REF code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white text-xs h-11"
                        />
                        <Button
                            type="submit"
                            disabled={isSearching || !searchQuery.trim()}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-11 px-5 rounded-xl shadow-lg shadow-orange-500/20"
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            <span className="ml-1.5">Search</span>
                        </Button>
                    </form>

                    {searchResults.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-mono uppercase text-slate-400 font-bold">
                                Search Results ({searchResults.length})
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {searchResults.map((reg) => (
                                    <div
                                        key={reg.id}
                                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h5 className="text-sm font-bold text-white">{reg.full_name}</h5>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    {reg.category} • {reg.region} ({reg.province})
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                                                    REF: {reg.batch_reference} {reg.phone ? `• ${reg.phone}` : ''}
                                                </p>
                                            </div>

                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                reg.checked_in
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            }`}>
                                                {reg.checked_in ? 'Checked In' : 'Not Checked In'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-900">
                                            <Button
                                                onClick={() => processTransition({ id: reg.id })}
                                                size="sm"
                                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-9 rounded-xl"
                                            >
                                                <DoorOpen className="w-3.5 h-3.5 mr-1" />
                                                <span>Issue Restroom Pass</span>
                                            </Button>

                                            <Button
                                                onClick={() => {
                                                    setScannerMode('reentry');
                                                    processTransition({ id: reg.id });
                                                }}
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 font-bold text-xs h-9 rounded-xl"
                                            >
                                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                                <span>Authorize Re-Entry</span>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* FULL-SCREEN FEEDBACK MODAL OVERLAY */}
            {overlayState.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                    <div className={`relative w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border-2 text-center space-y-4 animate-in zoom-in-95 ${
                        overlayState.type === 'checkout'
                            ? 'bg-gradient-to-b from-amber-950/80 via-slate-900 to-slate-900 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.25)]'
                            : overlayState.type === 'reentry'
                                ? 'bg-gradient-to-b from-cyan-950/80 via-slate-900 to-slate-900 border-cyan-400 shadow-[0_0_50px_rgba(34,211,238,0.25)]'
                                : 'bg-gradient-to-b from-red-950/80 via-slate-900 to-slate-900 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.25)]'
                    }`}>
                        {/* Status Icon */}
                        <div className="flex justify-center">
                            {overlayState.type === 'checkout' ? (
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-xl animate-bounce">
                                    <DoorOpen className="w-8 h-8" />
                                </div>
                            ) : overlayState.type === 'reentry' ? (
                                <div className="w-16 h-16 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 shadow-xl animate-bounce">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-400 flex items-center justify-center text-red-400 shadow-xl">
                                    <ShieldAlert className="w-8 h-8" />
                                </div>
                            )}
                        </div>

                        {/* Title & Message */}
                        <div>
                            <span className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded-full font-bold ${
                                overlayState.type === 'checkout'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : overlayState.type === 'reentry'
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}>
                                {overlayState.type === 'checkout' ? 'Restroom Pass Active' : overlayState.type === 'reentry' ? 'Re-Entry Confirmed' : 'Security Warning'}
                            </span>

                            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2">
                                {overlayState.title}
                            </h3>

                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                {overlayState.message}
                            </p>
                        </div>

                        {/* Delegate Details Card */}
                        {overlayState.record && (
                            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white text-sm">
                                        {overlayState.record.full_name}
                                    </span>
                                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                                        {overlayState.record.category}
                                    </span>
                                </div>
                                <div className="text-slate-400 text-[11px]">
                                    {overlayState.record.region} • {overlayState.record.province}
                                </div>
                                {overlayState.minutesOut !== undefined && (
                                    <div className="text-cyan-400 font-mono text-[11px] font-bold pt-1 border-t border-slate-900">
                                        Time out: {overlayState.minutesOut} minute{overlayState.minutesOut === 1 ? '' : 's'}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Dismiss Action */}
                        <Button
                            onClick={handleDismissOverlay}
                            className={`w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg ${
                                overlayState.type === 'checkout'
                                    ? 'bg-amber-500 hover:bg-amber-600 text-black'
                                    : overlayState.type === 'reentry'
                                        ? 'bg-cyan-400 hover:bg-cyan-500 text-black'
                                        : 'bg-red-500 hover:bg-red-600 text-white'
                            }`}
                        >
                            Next Scan
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
