import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    Camera, Search, Users, CheckCircle2, AlertTriangle, 
    XCircle, HelpCircle, RotateCw, Lightbulb, Smartphone, 
    Wifi, WifiOff, Clock, ArrowRight, Loader2, Sparkles, LogOut
} from 'lucide-react';

interface Registrant {
    id: string;
    full_name: string;
    batch_reference: string;
    category: string;
    region: string;
    province: string;
    amount_due: number;
    payment_method: string;
    payment_reference?: string;
    payment_status?: string;
    status: string;
    checked_in: boolean;
    checked_in_at?: string;
    qr_code_hash?: string;
}

interface ActivityLogItem {
    id: string;
    full_name: string;
    category: string;
    checked_in_at: string;
    isOffline?: boolean;
}

export default function CheckInModule({ isSidebarOpen = false }: { isSidebarOpen?: boolean }) {
    const { confirm, toast } = useDialog();
    const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr');
    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
    
    // Live Stats
    const [stats, setStats] = useState({
        total: 0,
        checkedIn: 0,
        remaining: 0,
        rate: 0
    });

    // Scanner States
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isScannerActive, setIsScannerActive] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isFlashlightOn, setIsFlashlightOn] = useState(false);
    const [isCameraLoading, setIsCameraLoading] = useState(false);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    // Overlay States
    const [overlayState, setOverlayState] = useState<{
        show: boolean;
        type: 'success' | 'already_checked_in' | 'payment_pending' | 'rejected' | 'not_found';
        title: string;
        message?: string;
        record?: Registrant | null;
        isOffline?: boolean;
    }>({
        show: false,
        type: 'success',
        title: '',
        record: null,
        isOffline: false
    });
    const [countdown, setCountdown] = useState(8);

    // Manual Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Registrant[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Activity Log & Sync States
    const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                return JSON.parse(sessionStorage.getItem('c3tc_checkin_activity') || '[]');
            } catch {
                return [];
            }
        }
        return [];
    });
    const [pendingSyncCount, setPendingSyncCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Mobile specific layout states
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(true);

    // Watch screen size for mobile check
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Prevent background scrolling on mobile when full-screen camera or overlay is active
    useEffect(() => {
        const shouldLock = isMobile && activeTab === 'qr' && (
            (isMobileScannerOpen && isScannerActive) || overlayState.show
        );
        if (shouldLock) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobile, activeTab, isMobileScannerOpen, isScannerActive, overlayState.show]);

    // Wake Lock
    const wakeLockRef = useRef<any>(null);

    // Fetch Stats
    async function fetchStats() {
        try {
            const { data: regs, error } = await supabase.from('registrations').select('checked_in');
            if (!error && regs) {
                const total = regs.length;
                const checkedIn = regs.filter(r => r.checked_in).length;
                const remaining = total - checkedIn;
                const rate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
                setStats({ total, checkedIn, remaining, rate });

                // Synchronize offline count if any
                const queue = JSON.parse(localStorage.getItem('c3tc_pending_sync') || '[]');
                setPendingSyncCount(queue.length);
            }
        } catch (err) {
            console.error('Error fetching check-in stats:', err);
        }
    }

    // Cache Registrations locally for offline usage
    async function cacheRegistrations() {
        if (!navigator.onLine) return;
        try {
            const { data, error } = await supabase.from('registrations').select('*');
            if (!error && data) {
                localStorage.setItem('c3tc_registrations_cache', JSON.stringify(data));
                localStorage.setItem('c3tc_cache_timestamp', Date.now().toString());
            }
        } catch (err) {
            console.error('Error caching registrations locally:', err);
        }
    }

    // Wake Lock functions
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                const lock = await (navigator as any).wakeLock.request('screen');
                wakeLockRef.current = lock;
                console.log('Screen Wake Lock active.');
            }
        } catch (err: any) {
            console.warn(`Screen Wake Lock failed: ${err.message}`);
        }
    }

    async function releaseWakeLock() {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                console.log('Screen Wake Lock released.');
            } catch (err: any) {
                console.error(`Wake Lock release error: ${err.message}`);
            }
        }
    }

    // Fetch Today's Successful Check-ins from Audit Log
    async function fetchTodaysActivity() {
        try {
            const midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            const midnightISO = midnight.toISOString();

            const { data, error } = await supabase
                .from('audit_log')
                .select(`
                    id,
                    created_at,
                    registrant_name,
                    action,
                    registration_id,
                    registrations (
                        category
                    )
                `)
                .eq('action', 'check_in_success')
                .gte('created_at', midnightISO)
                .order('created_at', { ascending: false });

            if (!error && data) {
                const mapped: ActivityLogItem[] = data.map((log: any) => {
                    const reg = log.registrations;
                    return {
                        id: log.registration_id || log.id,
                        full_name: log.registrant_name || 'Unknown',
                        category: reg?.category || 'Delegate',
                        checked_in_at: log.created_at
                    };
                });
                setActivityLog(mapped);
                sessionStorage.setItem('c3tc_checkin_activity', JSON.stringify(mapped));
            }
        } catch (err) {
            console.error('Error fetching today\'s activity:', err);
        }
    }

    // Watch isSidebarOpen from prop to close camera on menu drawer open
    useEffect(() => {
        if (isSidebarOpen) {
            setIsMobileScannerOpen(false);
            if (html5QrCodeRef.current) {
                try {
                    const stream = (html5QrCodeRef.current as any).localMediaStream;
                    if (stream) {
                        stream.getTracks().forEach((track: any) => track.stop());
                    }
                } catch (err) {
                    console.error('Error stopping stream tracks directly:', err);
                }
            }
            stopScanner();
        }
    }, [isSidebarOpen]);

    // Initial Setup
    useEffect(() => {
        fetchStats();
        fetchTodaysActivity();

        // Subscriptions
        const channel = supabase
            .channel('checkin-stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
                fetchStats();
                fetchTodaysActivity();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
                fetchStats();
                fetchTodaysActivity();
            })
            .subscribe();

        // Wake Lock on mount
        requestWakeLock();

        // Listen for online status
        const handleOnline = () => {
            setIsOnline(true);
            syncPendingCheckins();
            cacheRegistrations();
            fetchTodaysActivity();
        };
        const handleOffline = () => {
            setIsOnline(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (navigator.onLine) {
            cacheRegistrations();
        }

        // Sync pending sync queue count
        const syncInterval = setInterval(() => {
            const queue = JSON.parse(localStorage.getItem('c3tc_pending_sync') || '[]');
            setPendingSyncCount(queue.length);
        }, 3000);

        return () => {
            supabase.removeChannel(channel);
            releaseWakeLock();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(syncInterval);
            stopScanner();
        };
    }, []);

    // Stop camera scanner helper
    const stopScanner = async (): Promise<void> => {
        if (html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.isScanning) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (err) {
                console.error('Error stopping scanner:', err);
            } finally {
                // Ensure DOM elements are cleared and reference released
                const el = document.getElementById('qr-viewfinder');
                if (el) {
                    el.innerHTML = '';
                }
                html5QrCodeRef.current = null;
                setIsScannerActive(false);
                setIsFlashlightOn(false);
            }
        }
    };

    // Start camera scanner
    const startScanner = async () => {
        setIsCameraLoading(true);
        await stopScanner();

        const element = document.getElementById('qr-viewfinder');
        if (!element) {
            setIsCameraLoading(false);
            return;
        }

        try {
            const html5QrCode = new Html5Qrcode('qr-viewfinder');
            html5QrCodeRef.current = html5QrCode;

            await html5QrCode.start(
                { facingMode: facingMode },
                {
                    fps: 10,
                    qrbox: (width, height) => {
                        const size = Math.min(width, height) * 0.7;
                        return { width: size, height: size };
                    }
                },
                (decodedText) => {
                    handleScanSuccess(decodedText);
                },
                () => {
                    // Ignore failures to keep scanner quiet
                }
            );

            setHasCameraPermission(true);
            setIsScannerActive(true);
        } catch (err: any) {
            console.error('Camera start error:', err);
            setHasCameraPermission(false);
        } finally {
            setIsCameraLoading(false);
        }
    };

    // Toggle camera (Front vs Rear)
    const toggleCamera = () => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    };

    // Watch facingMode and reload scanner if active
    useEffect(() => {
        if (activeTab === 'qr' && isScannerActive && !overlayState.show) {
            startScanner();
        }
    }, [facingMode]);

    // Handle Active Tab toggling
    useEffect(() => {
        if (activeTab === 'qr') {
            setIsMobileScannerOpen(true);
            // Wait for the DOM element #qr-viewfinder to render before initializing
            const timer = setTimeout(() => {
                startScanner();
            }, 100);
            return () => clearTimeout(timer);
        } else {
            stopScanner();
        }
    }, [activeTab]);

    // Flashlight Toggle
    const toggleFlashlight = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            try {
                const nextState = !isFlashlightOn;
                const stream = (html5QrCodeRef.current as any).localMediaStream;
                if (stream) {
                    const track = stream.getVideoTracks()[0];
                    const capabilities = track.getCapabilities();
                    if (capabilities.torch) {
                        await track.applyConstraints({
                            advanced: [{ torch: nextState }]
                        });
                        setIsFlashlightOn(nextState);
                    } else {
                        toast.error('Flashlight not supported', 'The flashlight is not available on this camera source.');
                    }
                }
            } catch (err) {
                console.error('Error toggling flashlight:', err);
            }
        }
    };

    // Sync activity log to sessionStorage
    const addActivityLog = (item: ActivityLogItem) => {
        setActivityLog(prev => {
            const nextLog = [item, ...prev].slice(0, 50); // limit to latest 50
            sessionStorage.setItem('c3tc_checkin_activity', JSON.stringify(nextLog));
            return nextLog;
        });
    };

    // Sync Offline Queue to serverless endpoint
    async function syncPendingCheckins() {
        const queue = JSON.parse(localStorage.getItem('c3tc_pending_sync') || '[]');
        if (queue.length === 0 || isSyncing) return;

        setIsSyncing(true);
        let successCount = 0;
        const remainingQueue: any[] = [];

        for (const item of queue) {
            try {
                const res = await fetch('/api/admin/checkin', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        qr_code_hash: item.qr_code_hash,
                        registration_id: item.id
                    })
                });

                if (res.ok || res.status === 409) {
                    successCount++;
                } else {
                    remainingQueue.push(item);
                }
            } catch (err) {
                console.error('Offline sync syncItem failed:', err);
                remainingQueue.push(item);
            }
        }

        localStorage.setItem('c3tc_pending_sync', JSON.stringify(remainingQueue));
        setPendingSyncCount(remainingQueue.length);
        setIsSyncing(false);

        if (successCount > 0) {
            toast.success(
                'Check-in Sync Completed',
                `${successCount} check-in${successCount > 1 ? 's' : ''} successfully synchronized to database.`
            );
            fetchStats();
        }
    }

    // Main Check-in Processing Handler
    async function processCheckIn(identifier: { hash?: string; id?: string }) {
        // Pause scanning immediately
        await stopScanner();

        // 1. OFFLINE Processing
        if (!navigator.onLine) {
            let cache: Registrant[] = [];
            try {
                cache = JSON.parse(localStorage.getItem('c3tc_registrations_cache') || '[]');
            } catch {
                cache = [];
            }

            const record = cache.find(r => 
                identifier.hash ? r.qr_code_hash === identifier.hash : r.id === identifier.id
            );

            if (!record) {
                setOverlayState({
                    show: true,
                    type: 'not_found',
                    title: 'QR Code Not Recognised',
                    message: 'No registration found for this QR code. Please direct the delegate to the help desk.',
                    record: null,
                    isOffline: true
                });
                return;
            }

            const st = record.status?.toLowerCase();
            const ps = record.payment_status?.toLowerCase();

            if (st === 'rejected' || ps === 'rejected') {
                setOverlayState({
                    show: true,
                    type: 'rejected',
                    title: 'Registration Rejected',
                    message: "This delegate's registration was not approved. Please refer them to the help desk.",
                    record,
                    isOffline: true
                });
                return;
            }

            const isCleared = ps === 'cleared' || st === 'confirmed';
            if (!isCleared) {
                setOverlayState({
                    show: true,
                    type: 'payment_pending',
                    title: 'Payment Not Cleared',
                    message: "This delegate's payment has not been verified. Please direct them to the payment desk.",
                    record,
                    isOffline: true
                });
                return;
            }

            // Check if checked in locally
            const queue = JSON.parse(localStorage.getItem('c3tc_pending_sync') || '[]');
            const isQueued = queue.some((q: any) => q.id === record.id);
            if (record.checked_in || isQueued) {
                setOverlayState({
                    show: true,
                    type: 'already_checked_in',
                    title: 'Already Checked In',
                    message: 'This delegate has already been checked in. Please verify their identity.',
                    record,
                    isOffline: true
                });
                return;
            }

            // SUCCESS Offline flow
            // 1. Add check-in to localStorage Sync Queue
            const syncQueue = JSON.parse(localStorage.getItem('c3tc_pending_sync') || '[]');
            syncQueue.push({ id: record.id, qr_code_hash: record.qr_code_hash, offline_timestamp: new Date().toISOString() });
            localStorage.setItem('c3tc_pending_sync', JSON.stringify(syncQueue));
            setPendingSyncCount(syncQueue.length);

            // 2. Mark locally as checked in in the local registrations cache
            const updatedCache = cache.map(r => r.id === record.id ? { ...r, checked_in: true, checked_in_at: new Date().toISOString() } : r);
            localStorage.setItem('c3tc_registrations_cache', JSON.stringify(updatedCache));

            // 3. Render success screen
            const checkInTime = new Date().toISOString();
            setOverlayState({
                show: true,
                type: 'success',
                title: 'Check-in Successful!',
                record: { ...record, checked_in: true, checked_in_at: checkInTime },
                isOffline: true
            });

            // 4. Update Stats Locally
            setStats(prev => ({
                ...prev,
                checkedIn: prev.checkedIn + 1,
                remaining: Math.max(0, prev.remaining - 1),
                rate: prev.total > 0 ? Math.round(((prev.checkedIn + 1) / prev.total) * 100) : 0
            }));

            // 5. Add to activity log
            addActivityLog({
                id: record.id,
                full_name: record.full_name,
                category: record.category,
                checked_in_at: checkInTime,
                isOffline: true
            });

            return;
        }

        // 2. ONLINE Processing
        try {
            const response = await fetch('/api/admin/checkin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    qr_code_hash: identifier.hash,
                    registration_id: identifier.id
                })
            });

            const resData = await response.json().catch(() => ({}));

            if (response.ok) {
                setOverlayState({
                    show: true,
                    type: 'success',
                    title: 'Check-in Successful!',
                    record: resData.record,
                    isOffline: false
                });

                // Update Stats
                fetchStats();
                fetchTodaysActivity();

                // Add to Activity
                addActivityLog({
                    id: resData.record.id,
                    full_name: resData.record.full_name,
                    category: resData.record.category,
                    checked_in_at: resData.record.checked_in_at || new Date().toISOString()
                });
            } else {
                let errType: typeof overlayState.type = 'not_found';
                if (response.status === 409) errType = 'already_checked_in';
                else if (response.status === 402) errType = 'payment_pending';
                else if (response.status === 403) errType = 'rejected';
                else if (response.status === 404) errType = 'not_found';

                setOverlayState({
                    show: true,
                    type: errType,
                    title: resData.error || 'Check-in Failed',
                    message: resData.message,
                    record: resData.record || null,
                    isOffline: false
                });
            }
        } catch (err: any) {
            console.error('Checkin submit error:', err);
            toast.error('Network Error', 'Failed to communicate with check-in API. Saved check-in will run offline.');
            // Re-trigger offline lookup flow manually as fallback
            setIsOnline(false);
            processCheckIn(identifier);
        }
    }

    // Successful QR Code decode trigger
    const handleScanSuccess = (text: string) => {
        try {
            const payload = JSON.parse(text);
            if (payload && (payload.hash || payload.ref)) {
                processCheckIn({ hash: payload.hash || payload.ref });
            } else {
                throw new Error('Invalid QR payload format');
            }
        } catch {
            // Not a valid JSON payload or doesn't match C3TC spec. Fallback to querying text as hash
            processCheckIn({ hash: text });
        }
    };

    // Manual Input search trigger
    const handleManualSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!queryClean(searchQuery)) return;

        setSearchLoading(true);

        const cleanQuery = searchQuery.trim().toLowerCase();

        // 1. OFFLINE Search
        if (!navigator.onLine) {
            let cache: Registrant[] = [];
            try {
                cache = JSON.parse(localStorage.getItem('c3tc_registrations_cache') || '[]');
            } catch {
                cache = [];
            }

            const results = cache.filter(r => 
                r.full_name?.toLowerCase().includes(cleanQuery) ||
                r.batch_reference?.toLowerCase().includes(cleanQuery) ||
                r.phone?.includes(cleanQuery)
            );
            setSearchResults(results);
            setSearchLoading(false);
            return;
        }

        // 2. ONLINE Search
        try {
            // Fetch registrations containing search terms
            const { data, error } = await supabase
                .from('registrations')
                .select('*')
                .or(`full_name.ilike.%${cleanQuery}%,batch_reference.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%`)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setSearchResults(data as Registrant[]);
            } else {
                toast.error('Search error', error?.message || 'Failed to fetch search results.');
            }
        } catch (err: any) {
            console.error('Search fail:', err);
        } finally {
            setSearchLoading(false);
        }
    };

    const queryClean = (str: string) => {
        return str && str.trim().length >= 2;
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

    // Result overlay countdown timer (only runs on desktop/tablet)
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

    // Formatting category display labels
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
                @media (max-width: 767px) {
                    .mobile-fullscreen-viewfinder {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100vw !important;
                        height: 100vh !important;
                        z-index: 50 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        border-radius: 0 !important;
                        max-width: 100vw !important;
                        max-height: 100vh !important;
                    }
                    .mobile-fullscreen-viewfinder #qr-viewfinder {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .mobile-fullscreen-viewfinder video {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                        transform: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
            `}} />

            {/* Offline Status Warning Banner */}
            {!isOnline && (
                <div className="bg-red-500 border border-red-600 text-white rounded-2xl p-4 flex items-center gap-3 animate-pulse shadow-lg">
                    <WifiOff size={20} className="shrink-0" />
                    <div className="text-xs sm:text-sm font-bold">
                        You are offline. Check-ins will sync when connection is restored. ({pendingSyncCount} pending)
                    </div>
                </div>
            )}

            {/* Syncing State Indicator */}
            {isOnline && pendingSyncCount > 0 && (
                <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                        <Wifi size={20} className="shrink-0" />
                        <span className="text-xs sm:text-sm font-bold">{pendingSyncCount} check-in{pendingSyncCount > 1 ? 's' : ''} pending sync</span>
                    </div>
                    <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={syncPendingCheckins} 
                        disabled={isSyncing}
                        className="h-8 font-bold text-xs shrink-0 rounded-xl"
                    >
                        {isSyncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                        Sync Now
                    </Button>
                </div>
            )}

            {/* Live Stats Header Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="p-3 text-center md:text-left border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Registered</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-800 mt-1 block">{stats.total.toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left md:border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Checked In</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 block">{stats.checkedIn.toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left border-r border-slate-100 last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Remaining</span>
                    <span className="text-xl sm:text-2xl font-black text-orange-600 mt-1 block">{stats.remaining.toLocaleString()}</span>
                </div>
                <div className="p-3 text-center md:text-left last:border-0">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">Rate %</span>
                    <span className="text-xl sm:text-2xl font-black text-blue-600 mt-1 block">{stats.rate}%</span>
                </div>
            </div>

            {/* Mode Tab Switcher */}
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

            {/* MAIN CONTENT DISPLAY */}
            {activeTab === 'qr' && (
                (isMobile && !isMobileScannerOpen) || (hasCameraPermission === false) ? (
                    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden py-12 px-6 text-center space-y-4">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto text-orange-600">
                            {hasCameraPermission === false ? <XCircle size={32} className="text-red-500" /> : <Camera size={32} />}
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-slate-800 text-lg">
                                {hasCameraPermission === false ? "Camera Access Blocked" : "QR Code Scanner"}
                            </h4>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                {hasCameraPermission === false 
                                    ? "Please enable camera permissions in your browser configuration to scan registrant QR codes." 
                                    : "Use your device's camera to scan registrant QR codes for instant check-in."}
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
                    <div className={isMobile && isMobileScannerOpen ? "mobile-fullscreen-viewfinder bg-slate-950" : "space-y-4"}>
                        {/* Viewfinder Panel */}
                        <div className={`relative bg-slate-950 overflow-hidden flex items-center justify-center shadow-xl ${
                            isMobile && isMobileScannerOpen
                                ? "mobile-fullscreen-viewfinder border-none rounded-none"
                                : "w-full aspect-video md:aspect-[4/3] max-h-[50vh] rounded-2xl border border-slate-800"
                        }`}>
                            
                            {/* Video Element Target Container */}
                            <div id="qr-viewfinder" className="w-full h-full"></div>

                            {/* Back button on mobile */}
                            {isMobile && isMobileScannerOpen && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setIsMobileScannerOpen(false);
                                        await stopScanner();
                                    }}
                                    className="absolute top-6 left-6 bg-slate-900/85 text-white border border-slate-700/60 h-11 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all z-20 pointer-events-auto cursor-pointer shadow-lg backdrop-blur-sm"
                                >
                                    ← Back
                                </button>
                            )}

                            {/* Scanner Centering Framework Overlays */}
                            {isScannerActive && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                    {isMobile && isMobileScannerOpen ? (
                                        <div className="w-[70vw] h-[70vw] max-w-[320px] max-h-[320px] relative flex items-center justify-center">
                                            {/* White corner markers */}
                                            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
                                            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
                                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
                                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>
                                            
                                            {/* Orange dashed inner box */}
                                            <div className="absolute inset-1.5 border-2 border-dashed border-orange-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                                                {/* Scan animated horizontal line */}
                                                <div className="scan-line absolute left-3 right-3 h-0.5 bg-orange-500/80 rounded shadow-[0_0_12px_#f97316]"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-48 h-48 sm:w-60 sm:h-60 border-4 border-dashed border-orange-500 rounded-3xl relative flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                                            {/* Scan animated horizontal line */}
                                            <div className="scan-line absolute left-3 right-3 h-0.5 bg-orange-500/80 rounded shadow-[0_0_12px_#f97316]"></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Loading Spinner */}
                            {isCameraLoading && (
                                <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center gap-3">
                                    <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Accessing Camera...</span>
                                </div>
                            )}

                            {/* Camera Permissions Blocked Error screen */}
                            {hasCameraPermission === false && (
                                <div className="absolute inset-0 bg-slate-900 p-6 flex flex-col items-center justify-center text-center gap-4 z-20">
                                    <div className="p-3 bg-red-950/50 border border-red-500/20 text-red-500 rounded-full">
                                        <XCircle size={32} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-white text-base">Camera Access Blocked</h4>
                                        <p className="text-xs text-slate-400 max-w-xs">
                                            Please enable camera permissions in your browser configuration to scan registrant QR codes.
                                        </p>
                                    </div>
                                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600 font-bold rounded-xl h-11 px-4 cursor-pointer" onClick={startScanner}>
                                        Retry Camera Access
                                    </Button>
                                </div>
                            )}

                            {/* Controls overlays for mobile scanner */}
                            {isMobile && isMobileScannerOpen && (
                                <>
                                    <div className="absolute bottom-24 left-0 right-0 pointer-events-none flex justify-center z-20">
                                        <span className="text-[10px] font-extrabold tracking-wider text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded-full uppercase text-center backdrop-blur-sm">
                                            POINT CAMERA AT REGISTRANT'S QR CODE
                                        </span>
                                    </div>
                                    {isScannerActive && (
                                        <>
                                            <Button 
                                                size="sm" 
                                                variant="secondary"
                                                onClick={toggleFlashlight}
                                                className="absolute bottom-8 left-8 bg-slate-900/85 hover:bg-slate-900 border border-slate-700/60 text-white rounded-xl h-12 w-12 p-0 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer z-20 backdrop-blur-sm"
                                                title="Toggle Flashlight"
                                            >
                                                <Lightbulb size={20} className={isFlashlightOn ? "text-yellow-400" : "text-white"} />
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="secondary"
                                                onClick={toggleCamera}
                                                className="absolute bottom-8 right-8 bg-slate-900/85 hover:bg-slate-900 border border-slate-700/60 text-white rounded-xl h-12 w-12 p-0 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer z-20 backdrop-blur-sm"
                                                title="Switch Camera"
                                            >
                                                <RotateCw size={20} />
                                            </Button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Controls/Label below camera container for non-mobile or when mobile scanner is collapsed */}
                        {!(isMobile && isMobileScannerOpen) && (
                            <>
                                {isScannerActive && (
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-20 pointer-events-auto px-4">
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            onClick={toggleFlashlight}
                                            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/50 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                                            title="Toggle Flashlight"
                                        >
                                            <Lightbulb size={16} className={isFlashlightOn ? "text-yellow-400" : "text-white"} />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="secondary"
                                            onClick={toggleCamera}
                                            className="bg-slate-900/80 hover:bg-slate-900 border border-slate-700/50 text-white rounded-xl h-10 w-10 p-0 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                                            title="Switch Camera"
                                        >
                                            <RotateCw size={16} />
                                        </Button>
                                    </div>
                                )}
                                <p className="text-center text-xs text-slate-500 font-bold tracking-wide uppercase">
                                    Point camera at registrant's QR code
                                </p>
                            </>
                        )}
                    </div>
                )
            )}

            {activeTab === 'manual' && (
                <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
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
                            disabled={searchLoading || !queryClean(searchQuery)}
                            className="bg-orange-500 hover:bg-orange-600 font-bold h-11 rounded-xl px-5 text-white active:scale-95 transition-all"
                        >
                            {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                    </form>

                    {/* Results Display */}
                    <div className="space-y-3 pt-2">
                        {searchLoading ? (
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
                                    const isAlreadyCheckedIn = reg.checked_in;
                                    const isPaid = reg.payment_status?.toLowerCase() === 'cleared' || reg.status?.toLowerCase() === 'confirmed';
                                    const isRejected = reg.status?.toLowerCase() === 'rejected' || reg.payment_status?.toLowerCase() === 'rejected';
                                    const canCheckIn = isPaid && !isAlreadyCheckedIn && !isRejected;

                                    let buttonTooltip = undefined;
                                    if (isAlreadyCheckedIn) buttonTooltip = 'Already checked in';
                                    else if (isRejected) buttonTooltip = 'Registration rejected';
                                    else if (!isPaid) buttonTooltip = 'Payment not cleared';

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
                                                    ${isAlreadyCheckedIn ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                      isRejected ? 'bg-red-50 border-red-100 text-red-700' :
                                                      isPaid ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                                      'bg-orange-50 border-orange-100 text-orange-700'}
                                                `}>
                                                    {isAlreadyCheckedIn ? 'Checked In' : isRejected ? 'Rejected' : isPaid ? 'Paid' : 'Unpaid'}
                                                </span>

                                                {/* Action Button */}
                                                {isAlreadyCheckedIn ? (
                                                    <span className="status-badge text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shrink-0">In ✓</span>
                                                ) : (
                                                    <div title={buttonTooltip}>
                                                        <Button
                                                            size="sm"
                                                            disabled={!canCheckIn}
                                                            onClick={() => processCheckIn({ id: reg.id })}
                                                            className={`h-8 font-bold text-xs px-3 rounded-xl ${
                                                                canCheckIn 
                                                                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border'
                                                            }`}
                                                        >
                                                            Check In
                                                        </Button>
                                                    </div>
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

            {/* Today's Activity Log */}
            <Card className="shadow-sm border-slate-200 bg-white">
                <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Clock size={16} className="text-slate-500" />
                            Today's Activity
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">
                            TODAY'S CHECK-INS: {activityLog.length}
                        </span>
                    </div>

                    <div className="space-y-3 max-h-[220px] overflow-y-auto divide-y divide-slate-50">
                        {activityLog.length === 0 ? (
                            <p className="text-center py-6 text-slate-400 text-xs font-medium">
                                No check-ins performed today.
                            </p>
                        ) : (
                            activityLog.map((log, i) => (
                                <div key={log.id || i} className="pt-2.5 first:pt-0 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-slate-800">{log.full_name}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                            {formatCategory(log.category)} {log.isOffline ? '• Offline' : ''}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border px-1.5 py-0.5 rounded">
                                        {new Date(log.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* FULL SCREEN SLIDE UP RESULT OVERLAY */}
            <div className={`fixed inset-0 z-[60] transition-all duration-300 transform flex flex-col justify-end
                ${overlayState.show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}
            `}>
                {/* Backdrop Blur */}
                {!isMobile && <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={handleDismissOverlay}></div>}

                {/* Overlay Sheet content */}
                <div className={`relative z-[70] w-full mx-auto text-white text-center flex flex-col items-center gap-6 shadow-2xl transition-colors duration-300 overflow-y-auto pb-10
                    ${isMobile 
                        ? 'fixed inset-0 w-screen h-screen rounded-none z-[70] justify-between p-6' 
                        : 'max-w-xl rounded-t-[32px] p-6 min-h-[60vh] max-h-[85vh] justify-start'
                    }
                    ${overlayState.type === 'success' ? 'bg-emerald-600' :
                      overlayState.type === 'already_checked_in' ? 'bg-amber-600' :
                      overlayState.type === 'payment_pending' ? 'bg-red-600' :
                      overlayState.type === 'rejected' ? 'bg-red-900' :
                      'bg-slate-700'}
                `}>
                    {/* Top Slider indicator */}
                    {!isMobile && <div className="w-12 h-1.5 bg-white/20 rounded-full shrink-0"></div>}

                    {/* Result Icon */}
                    <div className="p-4 bg-white/10 border border-white/20 rounded-full scale-110 mt-2 animate-bounce">
                        {overlayState.type === 'success' && <CheckCircle2 size={44} />}
                        {overlayState.type === 'already_checked_in' && <AlertTriangle size={44} />}
                        {overlayState.type === 'payment_pending' && <XCircle size={44} />}
                        {overlayState.type === 'rejected' && <XCircle size={44} />}
                        {overlayState.type === 'not_found' && <HelpCircle size={44} />}
                    </div>

                    {/* Titles */}
                    <div className="space-y-1">
                        <h3 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
                            {overlayState.title}
                        </h3>
                        {overlayState.isOffline && (
                            <span className="inline-block bg-black/20 text-white font-bold text-[10px] px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">
                                Offline Sync Enqueued
                            </span>
                        )}
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

                            {/* Conditional Detail values based on status */}
                            {overlayState.type === 'already_checked_in' && overlayState.record.checked_in_at && (
                                <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs">
                                    <span className="text-white/60 font-medium">Checked In At:</span>
                                    <span className="font-mono font-bold">
                                        {new Date(overlayState.record.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(overlayState.record.checked_in_at).toLocaleDateString([], { month: 'short', day: 'numeric' })})
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm font-medium text-white/80 max-w-sm">
                            {overlayState.message}
                        </p>
                    )}

                    {/* Descriptive warning/info labels for non-success overlays */}
                    {overlayState.type !== 'success' && overlayState.message && overlayState.record && (
                        <p className="text-xs sm:text-sm font-bold bg-black/15 border border-white/10 rounded-2xl p-4 max-w-sm">
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
                                style={{ minHeight: '48px' }}
                            >
                                Scan Another Code
                            </Button>
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={handleExitScanner}
                                className="w-full h-12 rounded-xl text-sm font-bold tracking-wide border border-white/50 text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer bg-transparent flex items-center justify-center font-bold"
                                style={{ minHeight: '48px' }}
                            >
                                Exit Scanner
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full max-w-xs mt-auto space-y-3">
                            <Button 
                                className={`w-full h-12 rounded-xl text-sm font-bold tracking-wide shadow-lg border border-white/10 active:scale-95 transition-all
                                    ${overlayState.type === 'success' 
                                        ? 'bg-white text-emerald-800 hover:bg-slate-100' 
                                        : 'bg-black/20 text-white hover:bg-black/35'
                                    }
                                `}
                                onClick={handleDismissOverlay}
                            >
                                {overlayState.type === 'success' ? 'Next' : 'Dismiss'}
                            </Button>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">
                                Auto-dismissing in {countdown}s
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
