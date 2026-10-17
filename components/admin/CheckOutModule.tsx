import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    Camera, Search, Users, CheckCircle2, AlertTriangle, 
    XCircle, HelpCircle, RotateCw, Lightbulb, Smartphone, 
    Wifi, WifiOff, Clock, ArrowRight, Loader2, DoorOpen, LogIn
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

    // Stats
    const [gateCheckedIn, setGateCheckedIn] = useState<number>(0);
    const [activeOutCount, setActiveOutCount] = useState<number>(0);
    const [totalPassesToday, setTotalPassesToday] = useState<number>(0);

    // Scanner states
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isFlashlightOn, setIsFlashlightOn] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    // Mobile layout states
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);

    // Manual Search state
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
    const [countdown, setCountdown] = useState(8);

    // Activity Stream
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

    // Volunteer operator name
    const volunteerName = typeof window !== 'undefined' 
        ? sessionStorage.getItem('c3tc_admin_volunteer') || 'Exit Gate Usher' 
        : 'Exit Gate Usher';

    // Watch screen size
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'reentry') {
                // High bright triad chord (emerald/cyan)
                osc.frequency.setValueAtTime(523.25, ctx.currentTime);
                osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
                osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16);
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

    // Fetch Stats (Gate 1 checked-in count & restroom break counts)
    async function fetchStats() {
        try {
            const todayMidnight = new Date();
            todayMidnight.setHours(0, 0, 0, 0);

            // 1. Gate 1 total checked-in
            const { count: checkedInCount } = await supabase
                .from('registrations')
                .select('*', { count: 'exact', head: true })
                .eq('checked_in', true);

            if (checkedInCount !== null && checkedInCount !== undefined) {
                setGateCheckedIn(checkedInCount);
            }

            // 2. Audit logs for restroom
            const [checkoutsRes, reentriesRes] = await Promise.all([
                supabase
                    .from('audit_log')
                    .select('registration_id, created_at')
                    .eq('action', 'restroom_checkout')
                    .gte('created_at', todayMidnight.toISOString()),
                supabase
                    .from('audit_log')
                    .select('registration_id')
                    .eq('action', 'restroom_reentry')
                    .gte('created_at', todayMidnight.toISOString())
            ]);

            const checkouts = checkoutsRes.data || [];
            const reentries = reentriesRes.data || [];

            setTotalPassesToday(checkouts.length + reentries.length);

            const reenteredIds = new Set(reentries.map(r => r.registration_id));
            const currentlyOut = checkouts.filter(c => !reenteredIds.has(c.registration_id));
            const uniqueOut = new Set(currentlyOut.map(c => c.registration_id));
            setActiveOutCount(uniqueOut.size);
        } catch (err) {
            console.warn('Error fetching checkout stats:', err);
        }
    }

    useEffect(() => {
        fetchStats();
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
                    setTotalPassesToday(prev => prev + 1);

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
                    // RE-ENTRY CONFIRMED (EMERALD)
                    playTone('reentry');
                    setActiveOutCount(prev => Math.max(0, prev - 1));
                    setTotalPassesToday(prev => prev + 1);

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
                    title: 'Access Denied: Not Checked In',
                    message: data.message || 'This delegate has never checked in at the Main Entrance (Gate 1). They must go to Gate 1 first.',
                    record: data.record || null
                });
            } else {
                playTone('error');
                setOverlayState({
                    show: true,
                    type: 'error',
                    title: data.error || 'Scan Verification Failed',
                    message: data.message || 'Could not verify barcode. Please inspect badge or use manual lookup.',
                    record: null
                });
            }
        } catch (err: any) {
            console.error('Checkout submit error:', err);
            playTone('error');
            toast.error('Connection Error', 'Failed to communicate with restroom pass server.');
        }
    };

    // Manual Search
    const handleManualSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery || searchQuery.trim().length < 2) return;

        setIsSearching(true);
        const query = searchQuery.trim().toLowerCase();

        try {
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .or(`full_name.ilike.%${query}%,batch_reference.ilike.%${query}%,phone.ilike.%${query}%`)
                .order('full_name', { ascending: true })
                .limit(20);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err: any) {
            toast.error('Search Failed', err.message || 'Could not fetch registrants.');
        } finally {
            setIsSearching(false);
        }
    };

    // Dismiss overlay and restore scanner
    const handleDismissOverlay = () => {
        setOverlayState(prev => ({ ...prev, show: false }));
        if (activeTab === 'qr') {
            startScanner();
        }
    };

    // Scan Another Code handler for mobile
    const handleScanAnother = () => {
        setOverlayState(prev => ({ ...prev, show: false }));
        setIsMobileScannerOpen(true);
        startScanner();
    };

    // Exit Scanner handler for mobile
    const handleExitScanner = async () => {
        setOverlayState(prev => ({ ...prev, show: false }));
        setIsMobileScannerOpen(false);
        await stopScanner();
    };

    // Result overlay countdown timer
    useEffect(() => {
        if (!overlayState.show || isMobile) return;

        setCountdown(8);
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleDismissOverlay();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [overlayState.show, isMobile]);

    // Format category helper
    const formatCategory = (cat: string) => {
        if (!cat) return '';
        const lowercaseCat = cat.toLowerCase();
        if (lowercaseCat.includes('teacher')) return 'Teacher / Adult';
        if (lowercaseCat === 'teenager') return 'Teenager';
        return cat.charAt(0).toUpperCase() + cat.slice(1);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto font-sans pb-12 select-none relative">
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scanAnimation {
                    0% { top: 0%; opacity: 0; }
                    5% { opacity: 1; }
                    95% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .scan-line {
                    animation: scanAnimation 2.2s linear infinite;
                }
            `}} />

            {/* Offline Warning Banner */}
            {!isOnline && (
                <div className="bg-red-500 border border-red-600 text-white rounded-2xl p-4 flex items-center gap-3 animate-pulse shadow-lg">
                    <WifiOff size={20} className="shrink-0" />
                    <div className="text-xs sm:text-sm font-bold">
                        Network offline. Please check your connection to sync restroom passes.
                    </div>
                </div>
            )}

            {/* LIVE STATS HEADER BAR (Matches CheckInModule 1:1) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="p-3 text-center md:text-left border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Checked In (Gate 1)</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block">{gateCheckedIn.toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left md:border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">In Restroom</span>
                    <span className="text-xl sm:text-2xl font-black text-amber-500 mt-1 block">{activeOutCount.toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Currently Inside</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">{Math.max(0, gateCheckedIn - activeOutCount).toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Today's Passes</span>
                    <span className="text-xl sm:text-2xl font-black text-blue-600 mt-1 block">{totalPassesToday.toLocaleString()}</span>
                </div>
            </div>

            {/* MODE TAB SWITCHER (Matches CheckInModule 1:1) */}
            <div className="flex bg-slate-100 rounded-xl p-1 shadow-inner max-w-sm mx-auto">
                <button
                    onClick={() => setActiveTab('qr')}
                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'qr' 
                            ? 'bg-white text-slate-800 shadow-md font-extrabold scale-100' 
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Camera size={14} />
                    Scan QR Code
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        activeTab === 'manual' 
                            ? 'bg-white text-slate-800 shadow-md font-extrabold scale-100' 
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Search size={14} />
                    Manual Search
                </button>
            </div>

            {/* PASS ACTION SELECTOR (Clean Light Theme) */}
            <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs font-bold text-slate-400 mr-1">Gate Pass Mode:</span>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl shadow-inner text-xs font-bold">
                    <button
                        onClick={() => setScannerMode('auto')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            scannerMode === 'auto'
                                ? 'bg-white text-slate-800 shadow-sm font-extrabold'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Smart Auto-Detect
                    </button>
                    <button
                        onClick={() => setScannerMode('checkout')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            scannerMode === 'checkout'
                                ? 'bg-amber-500 text-white shadow-sm font-extrabold'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Check-Out (Exit)
                    </button>
                    <button
                        onClick={() => setScannerMode('reentry')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            scannerMode === 'reentry'
                                ? 'bg-blue-600 text-white shadow-sm font-extrabold'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        Re-Entry (Return)
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT DISPLAY */}
            {activeTab === 'qr' && (
                !isScannerActive || hasCameraPermission === false ? (
                    /* CAMERA ACCESS / IDLE CARD (Matches Image 2 exactly) */
                    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden py-12 px-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500">
                            {hasCameraPermission === false ? <XCircle size={32} className="text-red-500" /> : <DoorOpen size={32} className="text-orange-500" />}
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-slate-800 text-lg">
                                {hasCameraPermission === false ? "Camera Access Blocked" : "Restroom Pass Scanner"}
                            </h4>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                {hasCameraPermission === false 
                                    ? "Please enable camera permissions in your browser configuration to scan registrant QR codes." 
                                    : "Scan delegate QR codes at the exit door to grant temporary restroom passes and track re-entries."}
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                setHasCameraPermission(null);
                                setIsMobileScannerOpen(true);
                                startScanner();
                            }}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 px-6 rounded-xl cursor-pointer active:scale-95 transition-all shadow-md mx-auto flex items-center justify-center"
                        >
                            {hasCameraPermission === false ? "Retry Camera Access" : "Open Camera Scanner"}
                        </Button>
                    </Card>
                ) : (
                    /* ACTIVE CAMERA VIEWFINDER (Matches CheckInModule 1:1) */
                    <div className="space-y-4">
                        <div className="relative bg-slate-950 overflow-hidden flex items-center justify-center shadow-xl w-full aspect-video md:aspect-[4/3] max-h-[50vh] rounded-2xl border border-slate-800">
                            {/* Video Element Target Container */}
                            <div id="checkout-qr-viewfinder" className="w-full h-full" />

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

                            {/* Scanner Target Box with Animated Line */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <div className="w-48 h-48 sm:w-60 sm:h-60 border-4 border-dashed border-orange-500 rounded-3xl relative flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                                    <div className="scan-line absolute left-3 right-3 h-0.5 bg-orange-500/80 rounded shadow-[0_0_12px_#f97316]"></div>
                                </div>
                            </div>

                            {/* Loading Spinner */}
                            {isCameraLoading && (
                                <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center gap-3">
                                    <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Accessing Camera...</span>
                                </div>
                            )}

                            {/* Active Mode Tag */}
                            <div className="absolute bottom-4 left-4 z-20">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg ${
                                    scannerMode === 'checkout'
                                        ? 'bg-amber-500 text-white'
                                        : scannerMode === 'reentry'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-800 text-white border border-slate-700'
                                }`}>
                                    {scannerMode === 'checkout' ? 'Check-Out Mode Active' : scannerMode === 'reentry' ? 'Re-Entry Mode Active' : 'Smart Auto-Detect Active'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                            <span>Point camera at the printed paper QR code or delegate phone.</span>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={stopScanner}
                                className="text-slate-500 hover:text-slate-800 h-8"
                            >
                                Stop Camera
                            </Button>
                        </div>
                    </div>
                )
            )}

            {/* TAB 2: MANUAL SEARCH (Matches CheckInModule 1:1) */}
            {activeTab === 'manual' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <form onSubmit={handleManualSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <Input
                                placeholder="Search by name, ref code, phone..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 border-slate-200 rounded-xl bg-slate-50/50"
                            />
                        </div>
                        <Button 
                            type="submit" 
                            disabled={isSearching || searchQuery.trim().length < 2}
                            className="bg-orange-500 hover:bg-orange-600 font-bold h-11 rounded-xl px-5 text-white active:scale-95 transition-all"
                        >
                            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                    </form>

                    {/* Results Display */}
                    <div className="space-y-3 pt-2">
                        {isSearching ? (
                            <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                                <span className="text-xs font-medium">Searching records...</span>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
                                {searchQuery ? 'No matching registrants found.' : 'Enter search query (minimum 2 characters).'}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                                {searchResults.map((reg) => {
                                    const isGateCheckedIn = reg.checked_in;
                                    return (
                                        <div key={reg.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                                            <div className="min-w-0">
                                                <h5 className="font-bold text-slate-800 text-sm truncate">{reg.full_name}</h5>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-400 text-xs mt-0.5 font-medium">
                                                    <span className="font-mono text-slate-500 font-bold">{reg.batch_reference}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{formatCategory(reg.category)}</span>
                                                    <span>•</span>
                                                    <span>{reg.region}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Mini Status Pill */}
                                                <span className={`status-badge px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize shrink-0
                                                    ${isGateCheckedIn 
                                                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                                        : 'bg-red-50 border-red-100 text-red-700'
                                                    }
                                                `}>
                                                    {isGateCheckedIn ? 'Checked In' : 'Not Checked In'}
                                                </span>

                                                {/* Pass Action Buttons */}
                                                {isGateCheckedIn ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => processTransition({ id: reg.id })}
                                                            className="h-8 font-bold text-xs px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white"
                                                        >
                                                            Restroom Pass
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl shrink-0">
                                                        Gate 1 First
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TODAY'S ACTIVITY LOG (Matches CheckInModule and Image 2 1:1) */}
            <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Clock size={16} className="text-slate-500" />
                            Today's Activity
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                            TODAY'S CHECK-INS: {recentActivity.length}
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto divide-y divide-slate-50">
                        {recentActivity.length === 0 ? (
                            <p className="text-center py-6 text-slate-400 text-xs font-medium">
                                No check-ins performed today.
                            </p>
                        ) : (
                            recentActivity.map((log, i) => (
                                <div key={log.id || i} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-slate-800">{log.full_name}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                            {log.type === 'checkout' ? (
                                                <span className="text-amber-600 font-bold">Restroom Exit</span>
                                            ) : (
                                                <span className="text-emerald-600 font-bold">Re-Entry {log.minutes_out !== undefined ? `(${log.minutes_out}m away)` : ''}</span>
                                            )} • {formatCategory(log.category)}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border px-1.5 py-0.5 rounded">
                                        {log.timestamp}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* FULL SCREEN SLIDE UP RESULT OVERLAY (Matches CheckInModule 1:1) */}
            <div className={`fixed inset-0 z-[60] transition-all duration-300 transform flex flex-col justify-end
                ${overlayState.show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
            `}>
                {/* Backdrop Blur */}
                {!isMobile && <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleDismissOverlay} />}

                {/* Overlay Sheet content */}
                <div className={`relative z-[70] w-full mx-auto text-white text-center flex flex-col items-center gap-6 shadow-2xl transition-colors duration-300 overflow-y-auto pb-10
                    ${isMobile 
                        ? 'fixed inset-0 w-screen h-screen rounded-none z-[70] justify-between p-6' 
                        : 'max-w-xl rounded-t-[32px] p-6 min-h-[55vh] max-h-[85vh] justify-start'
                    }
                    ${overlayState.type === 'checkout' ? 'bg-amber-600' :
                      overlayState.type === 'reentry' ? 'bg-emerald-600' :
                      'bg-red-600'}
                `}>
                    {/* Top Slider indicator */}
                    {!isMobile && <div className="w-12 h-1.5 bg-white/20 rounded-full shrink-0"></div>}

                    {/* Result Icon */}
                    <div className="p-4 bg-white/10 border border-white/20 rounded-full scale-110 mt-2 animate-bounce">
                        {overlayState.type === 'checkout' && <DoorOpen size={44} />}
                        {overlayState.type === 'reentry' && <CheckCircle2 size={44} />}
                        {overlayState.type === 'not_checked_in' && <AlertTriangle size={44} />}
                        {overlayState.type === 'error' && <XCircle size={44} />}
                    </div>

                    {/* Titles */}
                    <div className="space-y-1">
                        <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                            {overlayState.title}
                        </h3>
                    </div>

                    {/* Record Details Body */}
                    {overlayState.record ? (
                        <div className="w-full max-w-sm bg-black/10 border border-white/15 rounded-3xl p-5 space-y-4 text-left animate-in fade-in duration-300">
                            <div>
                                <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block">Delegate Name</span>
                                <span className="text-base sm:text-lg font-black block mt-0.5 truncate">{overlayState.record.full_name}</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block">Category</span>
                                    <span className="inline-block bg-white/15 px-2 py-0.5 rounded font-bold uppercase mt-1 text-[10px]">{formatCategory(overlayState.record.category)}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block">Ref Code</span>
                                    <span className="font-mono font-bold mt-1 block tracking-wider">{overlayState.record.batch_reference}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block">Region</span>
                                    <span className="font-semibold block mt-0.5 truncate">{overlayState.record.region}</span>
                                </div>
                                <div>
                                    <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider block">Province</span>
                                    <span className="font-semibold block mt-0.5 truncate">{overlayState.record.province || '-'}</span>
                                </div>
                            </div>

                            {/* Additional info */}
                            {overlayState.minutesOut !== undefined && (
                                <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs">
                                    <span className="text-white/70 font-medium">Time in Restroom:</span>
                                    <span className="font-mono font-bold">{overlayState.minutesOut} minutes</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm font-medium text-white/90 max-w-sm">
                            {overlayState.message}
                        </p>
                    )}

                    {/* Action buttons with countdown timer label */}
                    {isMobile ? (
                        <div className="w-full max-w-xs mt-auto space-y-3 px-4">
                            <Button 
                                type="button"
                                onClick={handleScanAnother}
                                className="w-full h-12 rounded-xl text-sm font-bold tracking-wide shadow-lg bg-orange-500 hover:bg-orange-600 text-white border-none active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                            >
                                Scan Another Code
                            </Button>
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={handleExitScanner}
                                className="w-full h-12 rounded-xl text-sm font-bold tracking-wide border border-white/50 text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer bg-transparent flex items-center justify-center font-bold"
                            >
                                Exit Scanner
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full max-w-xs mt-auto space-y-3">
                            <Button 
                                className="w-full h-12 rounded-xl text-sm font-bold tracking-wide shadow-lg border border-white/10 active:scale-95 transition-all bg-white text-slate-800 hover:bg-slate-100"
                                onClick={handleDismissOverlay}
                            >
                                Next Scan
                            </Button>
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest block">
                                Auto-dismissing in {countdown}s
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
