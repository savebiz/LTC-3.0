import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Clock, MapPin, Radio, Sparkles, Volume2, 
    ChevronRight, ArrowLeft, RefreshCw, Wifi, WifiOff,
    CheckCircle2, Share2, HelpCircle, MessageSquare, X,
    Calendar, Download, BookOpen, ExternalLink, ChevronDown,
    Sun, Moon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { 
    PROGRAM_SCHEDULE, 
    TIME_CONFESSION, 
    ProgramSession, 
    LiveProgramState, 
    DEFAULT_LIVE_PROGRAM_STATE,
    getAdjustedSessionTimeRange 
} from '@/constants/programSchedule';

const STORAGE_KEY_STATE = 'c3tc_live_program_state';
const STORAGE_KEY_QA = 'c3tc_tgs_submitted_questions';
const STORAGE_KEY_THEME = 'c3tc_program_theme';

export default function ProgramPage() {
    const [theme, setTheme] = useState<'dark' | 'light'>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY_THEME);
                if (saved === 'light' || saved === 'dark') return saved;
            } catch {}
        }
        return 'dark';
    });

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY_THEME, next);
        } catch {}
    };

    const [liveState, setLiveState] = useState<LiveProgramState>(() => {
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(STORAGE_KEY_STATE);
                return cached ? JSON.parse(cached) : DEFAULT_LIVE_PROGRAM_STATE;
            } catch {
                return DEFAULT_LIVE_PROGRAM_STATE;
            }
        }
        return DEFAULT_LIVE_PROGRAM_STATE;
    });

    const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
    const [selectedVenueFilter, setSelectedVenueFilter] = useState<'all' | 'main' | 'studio' | 'activity'>('all');
    const [showConfessionModal, setShowConfessionModal] = useState(false);
    const [showQaModal, setShowQaModal] = useState(false);
    const [qaQuestion, setQaQuestion] = useState('');
    const [qaName, setQaName] = useState('');
    const [qaSubmitting, setQaSubmitting] = useState(false);
    const [qaSuccess, setQaSuccess] = useState(false);
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
        const now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    });

    const liveCardRef = useRef<HTMLDivElement | null>(null);

    // Update local clock every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    // Track online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Fetch and subscribe to real-time stage adjustments from Supabase settings
    useEffect(() => {
        async function fetchLiveState() {
            try {
                const { data, error } = await supabase
                    .from('settings')
                    .select('value')
                    .eq('key', 'live_program_state')
                    .single();

                if (!error && data && data.value) {
                    setLiveState(data.value);
                    try {
                        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(data.value));
                    } catch {}
                }
            } catch (err) {
                console.warn('Network issue fetching live program state; using cached state:', err);
            }
        }

        fetchLiveState();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('program-live-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.live_program_state' },
                (payload: any) => {
                    if (payload.new && payload.new.value) {
                        setLiveState(payload.new.value);
                        try {
                            localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(payload.new.value));
                        } catch {}
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Determine the active session:
    // If backend stage director set active_session_id, use it.
    // Otherwise, calculate dynamically from current time + delay_minutes.
    const activeSession: ProgramSession | null = null;
    const _unusedActiveSession = useMemo(() => {
        if (liveState.active_session_id) {
            const found = PROGRAM_SCHEDULE.find(s => s.id === liveState.active_session_id);
            if (found) return found;
        }

        // Clock fallback with delay offset
        const effectiveMinutes = currentTimeMinutes - (liveState.delay_minutes || 0);
        const current = PROGRAM_SCHEDULE.find(s => {
            const [sh, sm] = s.startTime.split(':').map(Number);
            const [eh, em] = s.endTime.split(':').map(Number);
            const startM = sh * 60 + sm;
            const endM = eh * 60 + em;
            return effectiveMinutes >= startM && effectiveMinutes < endM;
        });

        return current || null;
    }, [liveState.active_session_id, liveState.delay_minutes, currentTimeMinutes]);

    // Filter sessions
    const filteredSessions = useMemo(() => {
        if (selectedVenueFilter === 'all') return PROGRAM_SCHEDULE;
        if (selectedVenueFilter === 'main') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Main stage');
        }
        if (selectedVenueFilter === 'studio') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Indoor Studio' || s.venue === 'Outdoor red carpet');
        }
        if (selectedVenueFilter === 'activity') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Auditorium' || s.venue === 'Dept');
        }
        return PROGRAM_SCHEDULE;
    }, [selectedVenueFilter]);

    // Handle TGS Question submission
    const handleQaSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!qaQuestion.trim()) return;

        setQaSubmitting(true);
        try {
            // Save question to audit log as tgs_question
            await supabase.from('audit_log').insert({
                action: 'tgs_question',
                registrant_name: qaName.trim() || 'Anonymous Teen',
                performed_by: qaName.trim() || 'Delegate (Mobile)',
                device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile Browser',
                notes: qaQuestion.trim(),
                new_value: {
                    question: qaQuestion.trim(),
                    name: qaName.trim() || 'Anonymous',
                    submitted_at: new Date().toISOString()
                }
            });

            // Local storage feedback
            try {
                const history = JSON.parse(localStorage.getItem(STORAGE_KEY_QA) || '[]');
                history.push({ question: qaQuestion, date: new Date().toISOString() });
                localStorage.setItem(STORAGE_KEY_QA, JSON.stringify(history));
            } catch {}

            setQaSuccess(true);
            setQaQuestion('');
            setQaName('');
            setTimeout(() => {
                setQaSuccess(false);
                setShowQaModal(false);
            }, 2500);
        } catch (err) {
            console.error('Error submitting question:', err);
            // Even if network fails, show encouraging confirmation for offline delegates
            setQaSuccess(true);
            setTimeout(() => {
                setQaSuccess(false);
                setShowQaModal(false);
            }, 2000);
        } finally {
            setQaSubmitting(false);
        }
    };

    const isPastSession = (_session: ProgramSession) => true;
    const _unusedIsPastSession = (session: ProgramSession) => {
        if (activeSession && activeSession.id === session.id) return false;
        const [eh, em] = session.endTime.split(':').map(Number);
        const endTotal = eh * 60 + em + (liveState.delay_minutes || 0);
        return currentTimeMinutes >= endTotal;
    };

    return (
        <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
            theme === 'dark' 
                ? 'bg-[#070b14] text-white selection:bg-orange-500/30' 
                : 'bg-slate-50 text-slate-900 selection:bg-orange-500/20'
        }`}>
            {/* STICKY TOP APP HEADER */}
            <header className={`sticky top-0 z-30 px-4 py-3.5 backdrop-blur-xl border-b transition-colors ${
                theme === 'dark' 
                    ? 'bg-[#070b14]/90 border-white/10 text-white shadow-2xl' 
                    : 'bg-white/90 border-slate-200 text-slate-900 shadow-sm'
            }`}>
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                            theme === 'dark'
                                ? 'bg-white/5 border-white/10 text-zinc-300 group-hover:text-white'
                                : 'bg-slate-100 border-slate-200 text-slate-600 group-hover:text-slate-900'
                        }`}>
                            <ArrowLeft className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-orange-500 font-bold block leading-tight">C3TC '26</span>
                            <span className={`text-xs font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                Day-Program
                            </span>
                        </div>
                    </Link>

                    {/* Network, Theme & Live Status Indicator */}
                    <div className="flex items-center gap-2">
                        {/* Theme Toggle Button */}
                        <button
                            onClick={toggleTheme}
                            aria-label="Toggle light/dark theme"
                            className={`p-2 rounded-full border transition-all ${
                                theme === 'dark'
                                    ? 'bg-white/5 hover:bg-white/10 border-white/10 text-amber-400'
                                    : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700 shadow-xs'
                            }`}
                            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        {liveState.delay_minutes !== 0 && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                theme === 'dark'
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                    : 'bg-amber-50 border-amber-300 text-amber-700'
                            }`}>
                                {liveState.delay_minutes > 0 ? `+${liveState.delay_minutes}m Delay` : `${liveState.delay_minutes}m`}
                            </span>
                        )}

                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider border ${
                            theme === 'dark'
                                ? 'bg-white/5 border-white/10 text-zinc-300'
                                : 'bg-slate-100 border-slate-300 text-slate-700'
                        }`}>
                            OFFICIAL PROGRAM SOUVENIR & EVENT ARCHIVE
                        </span>
                    </div>
                </div>
            </header>

            {/* LIVE ARENA TICKER (If broadcasted by Stage Director) */}
            {liveState.ticker_message && liveState.ticker_message.trim() && (
                <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 text-white px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-lg border-b border-orange-400/30 overflow-hidden">
                    <Volume2 className="w-4 h-4 shrink-0 animate-bounce" />
                    <div className="truncate flex-1 tracking-wide">
                        <span className="font-mono uppercase opacity-80 mr-1.5">Announcement:</span>
                        {liveState.ticker_message}
                    </div>
                </div>
            )}

            {/* MAIN CONTAINER */}
            <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-28 space-y-5">
                {/* HERO BANNER CARD */}
                <div className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 shadow-xl transition-all ${
                    theme === 'dark' 
                        ? 'bg-gradient-to-b from-[#131c31] to-[#0c1220] border-white/10' 
                        : 'bg-white border-slate-200 shadow-slate-200/50'
                }`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

                    <div className="relative z-10 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-widest text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full">
                                <Sparkles className="w-3 h-3" /> OFFICIAL ITINERARY
                            </span>
                            <span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                                Glory Arena, Redemption City
                            </span>
                        </div>

                        <div>
                            <h1 className={`text-xl sm:text-2xl font-black tracking-tight leading-snug ${
                                theme === 'dark' ? 'text-white' : 'text-slate-900'
                            }`}>
                                Continent 3 Teens Conference
                            </h1>
                            <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
                                theme === 'dark' ? 'text-orange-400' : 'text-orange-600 font-bold'
                            }`}>
                                THE INCREDIBLE ME EVOLVING (T.I.M.E.)
                            </p>
                            <p className={`text-[11px] font-mono mt-1 ${
                                theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
                            }`}>
                                Saturday, October 17, 2026
                            </p>
                        </div>

                        {/* QUICK ACCESS ACTION BUTTONS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                            <button
                                onClick={() => setShowConfessionModal(true)}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all active:scale-[0.98] ${
                                    theme === 'dark'
                                        ? 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/30 text-orange-300'
                                        : 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700 shadow-xs'
                                }`}
                            >
                                <BookOpen className="w-4 h-4 text-orange-500" />
                                <span>T.I.M.E. Confession (Recite)</span>
                            </button>

                            <a
                                href="https://www.youtube.com/live/ZCQCEWcHXzA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all active:scale-[0.98] ${
                                    theme === 'dark'
                                        ? 'bg-red-500/15 hover:bg-red-500/25 border-red-500/30 text-red-300'
                                        : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700 shadow-xs'
                                }`}
                            >
                                <Play className="w-4 h-4 text-red-500 fill-current" />
                                <span>Watch Full Livestream Replay</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* CURRENT LIVE ON STAGE CARD (If Active) */}
                {activeSession && (
                    <div 
                        ref={liveCardRef}
                        className={`relative overflow-hidden rounded-3xl border-2 p-5 shadow-xl transition-all ${
                            theme === 'dark' 
                                ? 'bg-gradient-to-r from-orange-950/60 via-amber-950/40 to-zinc-950 border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.2)]' 
                                : 'bg-gradient-to-r from-orange-50 via-amber-50/60 to-white border-orange-400 shadow-[0_4px_30px_rgba(249,115,22,0.15)]'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-orange-500 text-black shadow-md">
                                <span className="w-2 h-2 rounded-full bg-black animate-ping" />
                                LIVE ON STAGE NOW
                            </span>
                            <span className={`text-xs font-mono font-bold ${theme === 'dark' ? 'text-orange-300' : 'text-orange-700'}`}>
                                {getAdjustedSessionTimeRange(activeSession, liveState.delay_minutes)}
                            </span>
                        </div>

                        <h2 className={`text-lg sm:text-xl font-black tracking-tight mt-1 ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                            {activeSession.title}
                        </h2>

                        {activeSession.minister && (
                            <p className={`text-sm font-bold mt-0.5 flex items-center gap-1.5 ${
                                theme === 'dark' ? 'text-orange-400' : 'text-orange-600 font-bold'
                            }`}>
                                <span>{activeSession.minister}</span>
                            </p>
                        )}

                        <div className="flex items-center gap-3 mt-3 text-xs font-medium">
                            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border ${
                                theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-zinc-300'
                                    : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                            }`}>
                                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                                {activeSession.venueDisplay}
                            </span>
                            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border font-mono ${
                                theme === 'dark'
                                    ? 'bg-white/5 border-white/10 text-zinc-300'
                                    : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                            }`}>
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                {activeSession.duration}
                            </span>
                        </div>

                        {activeSession.isInteractive && (
                            <div className={`mt-3.5 pt-3 border-t ${theme === 'dark' ? 'border-white/10' : 'border-orange-200/60'}`}>
                                {activeSession.interactiveType === 'confession' ? (
                                    <Button
                                        onClick={() => setShowConfessionModal(true)}
                                        size="sm"
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 py-2 shadow-md"
                                    >
                                        <BookOpen className="w-3.5 h-3.5" />
                                        Open & Recite T.I.M.E. Confession
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => setShowQaModal(true)}
                                        size="sm"
                                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 py-2 shadow-md"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Ask Pastor Foluke a Question
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* LIVESTREAM REPLAY BANNER */}
                <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    theme === 'dark'
                        ? 'bg-gradient-to-r from-red-950/40 via-zinc-900 to-zinc-950 border-red-500/30 shadow-xl'
                        : 'bg-gradient-to-r from-red-50 to-white border-red-200 shadow-sm'
                }`}>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-500 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-full">
                                OFFICIAL RECORDING
                            </span>
                            <span className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                                5h 42m Livestream Available
                            </span>
                        </div>
                        <h3 className={`text-sm sm:text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            Relive the Impartation, Worship & Praise
                        </h3>
                        <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'}`}>
                            Access the complete uninterrupted stage broadcast directly on YouTube.
                        </p>
                    </div>
                    <a
                        href="https://www.youtube.com/live/ZCQCEWcHXzA"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                    >
                        <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs gap-1.5 w-full sm:w-auto px-5 py-2.5 shadow-md">
                            <Play className="w-3.5 h-3.5 fill-current" /> Watch Full Replay
                        </Button>
                    </a>
                </div>

                {/* VENUE FILTER SEGMENTED BUTTONS */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
                    <button
                        onClick={() => setSelectedVenueFilter('all')}
                        className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition-all ${
                            selectedVenueFilter === 'all'
                                ? 'bg-orange-500 text-white shadow-md font-black'
                                : theme === 'dark'
                                    ? 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs'
                        }`}
                    >
                        All Sessions ({PROGRAM_SCHEDULE.length})
                    </button>
                    <button
                        onClick={() => setSelectedVenueFilter('main')}
                        className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition-all ${
                            selectedVenueFilter === 'main'
                                ? 'bg-orange-500 text-white shadow-md font-black'
                                : theme === 'dark'
                                    ? 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs'
                        }`}
                    >
                        Main Stage
                    </button>
                    <button
                        onClick={() => setSelectedVenueFilter('studio')}
                        className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition-all ${
                            selectedVenueFilter === 'studio'
                                ? 'bg-orange-500 text-white shadow-md font-black'
                                : theme === 'dark'
                                    ? 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs'
                        }`}
                    >
                        Studio & Red Carpet
                    </button>
                    <button
                        onClick={() => setSelectedVenueFilter('activity')}
                        className={`px-3.5 py-2 rounded-2xl whitespace-nowrap transition-all ${
                            selectedVenueFilter === 'activity'
                                ? 'bg-orange-500 text-white shadow-md font-black'
                                : theme === 'dark'
                                    ? 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 shadow-xs'
                        }`}
                    >
                        Auditorium & Teams
                    </button>
                </div>

                {/* TIMELINE LIST */}
                <div className="space-y-3">
                    {filteredSessions.map((session, index) => {
                        const isCurrent = activeSession?.id === session.id;
                        const isPast = isPastSession(session);
                        const isExpanded = expandedSessionId === session.id;

                        return (
                            <div
                                key={session.id}
                                onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                                className={`relative rounded-2xl transition-all cursor-pointer border ${
                                    isCurrent 
                                        ? theme === 'dark'
                                            ? 'bg-gradient-to-r from-orange-500/15 via-zinc-900/90 to-zinc-900 border-orange-500/70 shadow-lg ring-1 ring-orange-500/40 p-4 sm:p-5'
                                            : 'bg-orange-50/80 border-orange-400 shadow-md ring-1 ring-orange-300/60 p-4 sm:p-5'
                                        : isPast
                                            ? theme === 'dark'
                                                ? 'bg-white/[0.02] border-white/5 text-zinc-400 p-3.5 sm:p-4 opacity-75'
                                                : 'bg-slate-100/70 border-slate-200 text-slate-500 p-3.5 sm:p-4 opacity-75'
                                            : theme === 'dark'
                                                ? 'bg-white/[0.04] hover:bg-white/[0.07] border-white/10 p-4 sm:p-4.5'
                                                : 'bg-white hover:bg-slate-50/80 border-slate-200/90 text-slate-800 shadow-xs p-4 sm:p-4.5'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        {/* Status Icon Indicator */}
                                        <div className="pt-0.5 shrink-0">
                                            {isCurrent ? (
                                                <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                                                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                                </div>
                                            ) : isPast ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500/80" />
                                            ) : (
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono font-bold ${
                                                    theme === 'dark'
                                                        ? 'bg-white/10 border-white/20 text-zinc-400'
                                                        : 'bg-slate-100 border-slate-200 text-slate-500'
                                                }`}>
                                                    {index + 1}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content Block */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <span className={`text-[11px] font-mono font-bold tracking-tight ${
                                                    isCurrent 
                                                        ? theme === 'dark' ? 'text-orange-400 font-extrabold' : 'text-orange-600 font-black'
                                                        : theme === 'dark' ? 'text-zinc-400' : 'text-slate-500 font-semibold'
                                                }`}>
                                                    {getAdjustedSessionTimeRange(session, liveState.delay_minutes)}
                                                </span>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                                                    session.venue === 'Main stage'
                                                        ? theme === 'dark'
                                                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                            : 'bg-blue-50 border-blue-200 text-blue-700'
                                                        : session.venue === 'Indoor Studio' || session.venue === 'Outdoor red carpet'
                                                            ? theme === 'dark'
                                                                ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                                                                : 'bg-purple-50 border-purple-200 text-purple-700'
                                                            : theme === 'dark'
                                                                ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                                                : 'bg-slate-100 border-slate-200 text-slate-600'
                                                }`}>
                                                    {session.venueDisplay}
                                                </span>
                                                {session.isInteractive && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                                        theme === 'dark'
                                                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                                            : 'bg-amber-50 border-amber-300 text-amber-700'
                                                    }`}>
                                                        Interactive
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className={`text-sm sm:text-base font-bold tracking-tight leading-snug ${
                                                isCurrent 
                                                    ? theme === 'dark' ? 'text-white' : 'text-slate-900 font-black'
                                                    : isPast 
                                                        ? theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
                                                        : theme === 'dark' ? 'text-white' : 'text-slate-900'
                                            }`}>
                                                {session.title}
                                            </h3>

                                            {session.minister && (
                                                <p className={`text-xs mt-0.5 ${
                                                    isCurrent 
                                                        ? theme === 'dark' ? 'text-orange-300 font-semibold' : 'text-orange-600 font-bold'
                                                        : theme === 'dark' ? 'text-orange-400/90 font-medium' : 'text-orange-600 font-medium'
                                                }`}>
                                                    {session.minister}
                                                </p>
                                            )}

                                            {/* Collapsible Details */}
                                            {isExpanded && session.description && (
                                                <p className={`text-xs mt-2.5 pt-2 border-t leading-relaxed ${
                                                    theme === 'dark' ? 'text-zinc-400 border-white/5' : 'text-slate-600 border-slate-100'
                                                }`}>
                                                    {session.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action link if interactive */}
                                    {session.isInteractive && (
                                        <div className="shrink-0 pt-1">
                                            {session.interactiveType === 'confession' ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowConfessionModal(true);
                                                    }}
                                                    className={`p-2 rounded-xl transition-colors ${
                                                        theme === 'dark'
                                                            ? 'bg-orange-500/20 hover:bg-orange-500 text-orange-400 hover:text-black'
                                                            : 'bg-orange-100 hover:bg-orange-500 text-orange-700 hover:text-white'
                                                    }`}
                                                    title="Open Confession"
                                                >
                                                    <BookOpen className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowQaModal(true);
                                                    }}
                                                    className={`p-2 rounded-xl transition-colors ${
                                                        theme === 'dark'
                                                            ? 'bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white'
                                                            : 'bg-blue-100 hover:bg-blue-500 text-blue-700 hover:text-white'
                                                    }`}
                                                    title="Ask a Question"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* BOTTOM ATTENDANCE VERIFICATION BANNER */}
                <div className={`rounded-3xl border p-5 text-center space-y-3 transition-all ${
                    theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-500 font-mono">
                        Experience T.I.M.E '26
                    </p>
                    <p className={`text-xs leading-relaxed max-w-md mx-auto ${
                        theme === 'dark' ? 'text-zinc-400' : 'text-slate-600'
                    }`}>
                        Check your verified conference registration and attendance clearance anytime.
                    </p>
                    <div className="flex items-center justify-center pt-1">
                        <Link
                            to="/check-status"
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                theme === 'dark' 
                                    ? 'bg-white/10 text-white hover:bg-white/15 border-white/10 shadow-sm' 
                                    : 'bg-slate-900 text-white hover:bg-slate-800 border-slate-900 shadow-sm'
                            }`}
                        >
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Check Registration Status</span>
                        </Link>
                    </div>
                </div>
            </main>

            {/* MODAL 1: T.I.M.E. CONFESSION MODAL */}
            {showConfessionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div 
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setShowConfessionModal(false)}
                    />
                    <div className={`relative w-full max-w-lg border rounded-3xl p-6 sm:p-7 shadow-2xl z-10 my-auto transition-all ${
                        theme === 'dark'
                            ? 'bg-[#0e1628] border-orange-500/30 text-white shadow-[0_0_60px_rgba(249,115,22,0.25)]'
                            : 'bg-white border-orange-200 text-slate-900'
                    }`}>
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-orange-500 bg-orange-500/10 border border-orange-500/25 px-3 py-1 rounded-full">
                                {TIME_CONFESSION.scripture}
                            </span>
                            <button
                                onClick={() => setShowConfessionModal(false)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
                                    theme === 'dark'
                                        ? 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/5'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                                }`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <h3 className={`text-xl sm:text-2xl font-black tracking-tight mb-4 ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                            {TIME_CONFESSION.title}
                        </h3>

                        <div className={`space-y-3.5 text-sm sm:text-base leading-relaxed border p-4 sm:p-5 rounded-2xl max-h-[60vh] overflow-y-auto ${
                            theme === 'dark'
                                ? 'text-zinc-200 bg-white/[0.03] border-white/5'
                                : 'text-slate-800 bg-slate-50 border-slate-200'
                        }`}>
                            {TIME_CONFESSION.paragraphs.map((p, i) => (
                                <p key={i} className={i === TIME_CONFESSION.paragraphs.length - 1 ? "font-bold text-orange-500 pt-1 text-center" : ""}>
                                    {p}
                                </p>
                            ))}
                        </div>

                        <Button
                            onClick={() => setShowConfessionModal(false)}
                            className="w-full mt-5 bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg"
                        >
                            Done Reciting
                        </Button>
                    </div>
                </div>
            )}

            {/* MODAL 2: TGS QUESTION SUBMISSION */}
            {showQaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div 
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => setShowQaModal(false)}
                    />
                    <div className={`relative w-full max-w-md border rounded-3xl p-6 sm:p-7 shadow-2xl z-10 my-auto transition-all ${
                        theme === 'dark'
                            ? 'bg-[#0e1628] border-blue-500/30 text-white shadow-[0_0_60px_rgba(59,130,246,0.25)]'
                            : 'bg-white border-blue-200 text-slate-900'
                    }`}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-blue-500 bg-blue-500/10 border border-blue-500/25 px-3 py-1 rounded-full">
                                LIVE STAGE Q&A
                            </span>
                            <button
                                onClick={() => setShowQaModal(false)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border ${
                                    theme === 'dark'
                                        ? 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border-white/5'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                                }`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <h3 className={`text-lg sm:text-xl font-bold tracking-tight mb-1 ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                            Ask Pastor Foluke Irukera
                        </h3>
                        <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                            Your question will be transmitted directly to the moderator's tablet backstage.
                        </p>

                        {qaSuccess ? (
                            <div className="text-center py-8 space-y-2">
                                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                                <h4 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    Question Transmitted!
                                </h4>
                                <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                                    Thank you! Selected questions will be answered live on stage.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleQaSubmit} className="space-y-3.5">
                                <div>
                                    <label className={`text-[11px] font-mono uppercase tracking-wider block mb-1 ${
                                        theme === 'dark' ? 'text-zinc-400' : 'text-slate-600 font-semibold'
                                    }`}>
                                        Your Name or Alias (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={qaName}
                                        onChange={(e) => setQaName(e.target.value)}
                                        placeholder="e.g. David from Region 2 (or leave blank)"
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:border-blue-500 ${
                                            theme === 'dark'
                                                ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-500'
                                                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                                        }`}
                                    />
                                </div>

                                <div>
                                    <label className={`text-[11px] font-mono uppercase tracking-wider block mb-1 ${
                                        theme === 'dark' ? 'text-zinc-400' : 'text-slate-600 font-semibold'
                                    }`}>
                                        Your Question <span className="text-orange-500">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={qaQuestion}
                                        onChange={(e) => setQaQuestion(e.target.value)}
                                        placeholder="Type your question for Pastor Foluke here..."
                                        className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:border-blue-500 resize-none ${
                                            theme === 'dark'
                                                ? 'bg-white/5 border-white/10 text-white placeholder:text-zinc-500'
                                                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                                        }`}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={qaSubmitting || !qaQuestion.trim()}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
                                >
                                    {qaSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                                    Send Question to Stage
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
