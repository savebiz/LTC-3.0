import React, { useState, useEffect, useMemo } from 'react';
import { 
    Radio, Clock, MapPin, Volume2, AlertCircle, CheckCircle2, 
    RefreshCw, Sparkles, Send, Trash2, ExternalLink, QrCode, 
    FastForward, Play, Pause, ChevronRight, Layers, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDialog } from '@/components/ui/DialogProvider';
import { supabase } from '@/lib/supabase';
import { 
    PROGRAM_SCHEDULE, 
    ProgramSession, 
    LiveProgramState, 
    DEFAULT_LIVE_PROGRAM_STATE,
    getAdjustedSessionTimeRange,
    formatAdjustedTime
} from '@/constants/programSchedule';
import ProgramQrModal from './ProgramQrModal';

const PRESET_ANNOUNCEMENTS = [
    "🎤 Welcome to C3TC '26! Please take your seats in the main auditorium.",
    "⚠️ Attention Coordinators: Brief deployment check at Department Desks now.",
    "🎶 Up next: Praise & Worship with LTC Mass Choir!",
    "📖 Prepare for the Word: 'The Incredible Me Evolving' by Pastor Femi Oyewunmi.",
    "✨ Anchor Interlude: Open your Day-Pass for the T.I.M.E. Confession & Declarations!",
    "👑 Coming up: The Governor's Session (TGS) with Pastor Foluke Irukera.",
    "❓ TGS Live Q&A is now open! Submit your questions directly from your Day-Pass.",
    "🍽️ Lunch packs will be distributed at regional stands immediately after the Praise Party."
];

export default function StageDirector() {
    const { toast } = useDialog();
    const [liveState, setLiveState] = useState<LiveProgramState>(DEFAULT_LIVE_PROGRAM_STATE);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);

    // Ticker editor state
    const [tickerDraft, setTickerDraft] = useState('');
    const [customDelayInput, setCustomDelayInput] = useState('');
    const [venueFilter, setVenueFilter] = useState<'all' | 'main' | 'studio' | 'activity'>('all');

    // Operator name from session
    const volunteerName = typeof window !== 'undefined' 
        ? sessionStorage.getItem('c3tc_admin_volunteer') || 'Stage Manager' 
        : 'Stage Manager';

    // Fetch current state from Supabase settings
    async function loadLiveProgramState() {
        try {
            const { data, error } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'live_program_state')
                .single();

            if (!error && data && data.value) {
                setLiveState(data.value);
                setTickerDraft(data.value.ticker_message || '');
            }
        } catch (err) {
            console.warn('Error loading live program state:', err);
        } finally {
            setLoading(false);
        }
    }

    // Subscribe to realtime updates on settings table
    useEffect(() => {
        loadLiveProgramState();

        const channel = supabase
            .channel('stage-director-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.live_program_state' },
                (payload: any) => {
                    if (payload.new && payload.new.value) {
                        setLiveState(payload.new.value);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Save updated state to Supabase via backend API and direct Supabase fallback
    async function saveLiveState(newState: LiveProgramState, auditActionDesc: string) {
        setSaving(true);
        const updatedWithTimestamp = {
            ...newState,
            updated_at: new Date().toISOString()
        };

        // Optimistic UI update
        setLiveState(updatedWithTimestamp);

        try {
            // 1. Save via authenticated settings API
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'live_program_state',
                    value: updatedWithTimestamp
                })
            });

            if (!res.ok) {
                // Fallback to direct supabase client
                await supabase
                    .from('settings')
                    .upsert({ key: 'live_program_state', value: updatedWithTimestamp });
            }

            // 2. Insert audit log
            supabase.from('audit_log').insert({
                action: 'stage_director_update',
                performed_by: volunteerName,
                device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Stage Director Desk',
                notes: auditActionDesc,
                new_value: updatedWithTimestamp
            }).then(() => {});

            toast.success('Live Program Synced', auditActionDesc);
        } catch (err: any) {
            console.error('Failed to sync live program state:', err);
            toast.error('Sync Error', 'Could not broadcast live state update. Check connection.');
        } finally {
            setSaving(false);
        }
    }

    // Set active session manually
    const handleSetActiveSession = (session: ProgramSession) => {
        const newState: LiveProgramState = {
            ...liveState,
            active_session_id: session.id,
            is_live_override: true
        };
        saveLiveState(newState, `Set live on-stage session to: "${session.title}"`);
    };

    // Clear active session override (reverts to automatic clock)
    const handleClearActiveSession = () => {
        const newState: LiveProgramState = {
            ...liveState,
            active_session_id: null,
            is_live_override: false
        };
        saveLiveState(newState, 'Cleared manual session override (reverted to auto clock tracking)');
    };

    // Apply quick delay offset
    const handleSetDelay = (minutes: number) => {
        const newState: LiveProgramState = {
            ...liveState,
            delay_minutes: minutes
        };
        const desc = minutes === 0 
            ? 'Reset schedule delay offset to 0 mins (On Time)' 
            : `Set schedule delay offset to +${minutes} minutes`;
        saveLiveState(newState, desc);
    };

    // Apply custom delay
    const handleApplyCustomDelay = (e: React.FormEvent) => {
        e.preventDefault();
        const mins = parseInt(customDelayInput, 10);
        if (isNaN(mins)) return;
        handleSetDelay(mins);
        setCustomDelayInput('');
    };

    // Broadcast announcement ticker
    const handleBroadcastTicker = () => {
        const message = tickerDraft.trim();
        const newState: LiveProgramState = {
            ...liveState,
            ticker_message: message
        };
        saveLiveState(newState, message ? `Broadcast arena ticker: "${message}"` : 'Cleared arena ticker message');
    };

    // Clear announcement ticker
    const handleClearTicker = () => {
        setTickerDraft('');
        const newState: LiveProgramState = {
            ...liveState,
            ticker_message: ''
        };
        saveLiveState(newState, 'Cleared arena ticker message');
    };

    // Filter sessions
    const filteredSessions = useMemo(() => {
        if (venueFilter === 'all') return PROGRAM_SCHEDULE;
        if (venueFilter === 'main') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Main stage');
        }
        if (venueFilter === 'studio') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Indoor Studio' || s.venue === 'Outdoor red carpet');
        }
        if (venueFilter === 'activity') {
            return PROGRAM_SCHEDULE.filter(s => s.venue === 'Auditorium' || s.venue === 'Dept');
        }
        return PROGRAM_SCHEDULE;
    }, [venueFilter]);

    const activeSessionObject = useMemo(() => {
        if (!liveState.active_session_id) return null;
        return PROGRAM_SCHEDULE.find(s => s.id === liveState.active_session_id) || null;
    }, [liveState.active_session_id]);

    return (
        <div className="space-y-6">
            {/* TOP BAR / CONTROL HEADER (Clean Light Theme) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-xl bg-orange-100 text-orange-600 border border-orange-200">
                                <Radio className="w-5 h-5 animate-pulse" />
                            </span>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight font-heading">
                                Stage Director & Live Program Controller
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Broadcast real-time schedule delays, switch the active live session, and push arena tickers to 3,500+ phones.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Button
                            onClick={() => setIsQrModalOpen(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-10 px-4 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                            <QrCode className="w-4 h-4" />
                            <span>Program QR Code</span>
                        </Button>

                        <a
                            href="/program"
                            target="_blank"
                            rel="noreferrer"
                            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                        >
                            <span>Live Day-Pass</span>
                            <ExternalLink className="w-3.5 h-3.5 text-orange-500" />
                        </a>

                        <button
                            onClick={loadLiveProgramState}
                            disabled={loading || saving}
                            className="h-10 w-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
                            title="Refresh live status"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading || saving ? 'animate-spin text-orange-500' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* REAL-TIME STATUS SUMMARY PILLS */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Active Live Session Pill */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${activeSessionObject ? 'bg-orange-500 animate-ping' : 'bg-slate-400'}`} />
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                                Live On Stage
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block">
                                {activeSessionObject ? activeSessionObject.title : 'Auto (Device Clock Tracking)'}
                            </span>
                        </div>
                        {activeSessionObject && (
                            <button
                                onClick={handleClearActiveSession}
                                className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded-lg shrink-0"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Schedule Delay Offset Pill */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                                Schedule Offset
                            </span>
                            <span className={`text-xs font-bold block ${liveState.delay_minutes > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {liveState.delay_minutes === 0 
                                    ? 'On Time (0 mins delay)' 
                                    : `+${liveState.delay_minutes} minutes behind schedule`}
                            </span>
                        </div>
                    </div>

                    {/* Active Announcement Status */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                        <Volume2 className="w-4 h-4 text-orange-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                                Arena Ticker
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate block">
                                {liveState.ticker_message ? liveState.ticker_message : 'No active broadcast'}
                            </span>
                        </div>
                        {liveState.ticker_message && (
                            <button
                                onClick={handleClearTicker}
                                className="text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded-lg shrink-0 shadow-sm"
                            >
                                Mute
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* TWO-COLUMN CONTROLLER GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN: DELAY & TICKER CONTROLS */}
                <div className="lg:col-span-1 space-y-6">
                    {/* SCHEDULE DELAY BUMPER */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FastForward className="w-4 h-4 text-amber-500" />
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                    Arena Schedule Delay
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                                {liveState.delay_minutes > 0 ? `+${liveState.delay_minutes}m` : '0m'}
                            </span>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            If sessions run over time, tap a button below to dynamically push start and end times forward for all sessions across everyone's phone.
                        </p>

                        {/* Quick Delay Presets */}
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                onClick={() => handleSetDelay(0)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 0 
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                On Time (0m)
                            </Button>

                            <Button
                                onClick={() => handleSetDelay(5)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 5 
                                        ? 'bg-amber-50 border-amber-300 text-amber-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                +5 mins
                            </Button>

                            <Button
                                onClick={() => handleSetDelay(10)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 10 
                                        ? 'bg-amber-50 border-amber-300 text-amber-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                +10 mins
                            </Button>

                            <Button
                                onClick={() => handleSetDelay(15)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 15 
                                        ? 'bg-amber-50 border-amber-300 text-amber-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                +15 mins
                            </Button>

                            <Button
                                onClick={() => handleSetDelay(20)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 20 
                                        ? 'bg-amber-50 border-amber-300 text-amber-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                +20 mins
                            </Button>

                            <Button
                                onClick={() => handleSetDelay(30)}
                                variant="outline"
                                className={`h-10 text-xs font-bold rounded-xl border ${
                                    liveState.delay_minutes === 30 
                                        ? 'bg-orange-50 border-orange-300 text-orange-700' 
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                +30 mins
                            </Button>
                        </div>

                        {/* Custom Delay Form */}
                        <form onSubmit={handleApplyCustomDelay} className="flex items-center gap-2 pt-1">
                            <Input
                                type="number"
                                placeholder="Custom minutes (e.g. 25)"
                                value={customDelayInput}
                                onChange={(e) => setCustomDelayInput(e.target.value)}
                                className="bg-slate-50 border-slate-200 text-xs text-slate-800 h-9 rounded-xl focus:bg-white"
                            />
                            <Button
                                type="submit"
                                size="sm"
                                className="h-9 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shrink-0"
                            >
                                Apply
                            </Button>
                        </form>
                    </div>

                    {/* LIVE ARENA TICKER BROADCASTER */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-orange-500" />
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                    Live Arena Ticker Broadcast
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                                {tickerDraft.length}/140
                            </span>
                        </div>

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Broadcast urgent notifications or instructions directly across the top banner of all delegate screens.
                        </p>

                        <div className="space-y-2">
                            <textarea
                                rows={3}
                                maxLength={140}
                                placeholder="Type urgent announcement for arena screens and delegate phones..."
                                value={tickerDraft}
                                onChange={(e) => setTickerDraft(e.target.value)}
                                className="w-full rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 p-3 focus:outline-none focus:border-orange-500 focus:bg-white focus:ring-1 focus:ring-orange-500 font-sans resize-none"
                            />

                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={handleBroadcastTicker}
                                    disabled={saving || !tickerDraft.trim()}
                                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Broadcast Ticker</span>
                                </Button>

                                {liveState.ticker_message && (
                                    <Button
                                        onClick={handleClearTicker}
                                        disabled={saving}
                                        variant="outline"
                                        className="h-10 px-3 border-slate-200 bg-slate-50 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl"
                                        title="Clear active ticker"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Presets List */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                                Quick Preset Templates
                            </span>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                {PRESET_ANNOUNCEMENTS.map((msg, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setTickerDraft(msg)}
                                        className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-[11px] text-slate-700 transition-colors truncate block"
                                    >
                                        {msg}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: 21-SESSION SCHEDULE TIMELINE CONTROLLER */}
                <div className="lg:col-span-2 space-y-4">
                    {/* CONTROLLER TOOLBAR */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                Official Program Itinerary ({PROGRAM_SCHEDULE.length} Sessions)
                            </h3>
                            <p className="text-xs text-slate-500">
                                Tap <strong>[Set Active]</strong> to highlight the current live minister on stage
                            </p>
                        </div>

                        {/* Venue Filter Bar */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                            <button
                                onClick={() => setVenueFilter('all')}
                                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                                    venueFilter === 'all'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                                }`}
                            >
                                All ({PROGRAM_SCHEDULE.length})
                            </button>
                            <button
                                onClick={() => setVenueFilter('main')}
                                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                                    venueFilter === 'main'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                                }`}
                            >
                                Main Stage
                            </button>
                            <button
                                onClick={() => setVenueFilter('studio')}
                                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                                    venueFilter === 'studio'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:text-slate-800'
                                }`}
                            >
                                Studio & Red Carpet
                            </button>
                        </div>
                    </div>

                    {/* SESSIONS LIST */}
                    <div className="space-y-2.5">
                        {filteredSessions.map((session, index) => {
                            const isLiveActive = liveState.active_session_id === session.id;
                            const adjustedTime = getAdjustedSessionTimeRange(session, liveState.delay_minutes);

                            return (
                                <div
                                    key={session.id}
                                    className={`p-4 rounded-2xl border transition-all ${
                                        isLiveActive 
                                            ? 'bg-orange-50/70 border-2 border-orange-500 shadow-md ring-1 ring-orange-500/20' 
                                            : 'bg-white hover:bg-slate-50/80 border-slate-200 shadow-sm'
                                    }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            {/* Index or Live Pulse */}
                                            <div className="pt-0.5 shrink-0">
                                                {isLiveActive ? (
                                                    <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-xs shadow-md animate-pulse">
                                                        ▶
                                                    </span>
                                                ) : (
                                                    <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center font-mono text-[11px] font-bold">
                                                        {index + 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Session Details */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                                                        isLiveActive 
                                                            ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                    }`}>
                                                        {adjustedTime}
                                                    </span>

                                                    {liveState.delay_minutes !== 0 && (
                                                        <span className="text-[10px] font-mono text-slate-400 line-through">
                                                            {session.timeDisplay}
                                                        </span>
                                                    )}

                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                        {session.venueDisplay}
                                                    </span>

                                                    {session.isInteractive && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                            Interactive
                                                        </span>
                                                    )}

                                                    {isLiveActive && (
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500 text-white">
                                                            Live On Stage
                                                        </span>
                                                    )}
                                                </div>

                                                <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                                                    {session.title}
                                                </h4>

                                                {session.minister && (
                                                    <p className="text-xs font-semibold text-orange-600 mt-0.5">
                                                        {session.minister}
                                                    </p>
                                                )}

                                                {session.description && (
                                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                                        {session.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* ACTION BUTTON */}
                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                            {isLiveActive ? (
                                                <Button
                                                    onClick={handleClearActiveSession}
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-9 px-3 border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200 text-xs font-bold rounded-xl"
                                                >
                                                    <Pause className="w-3.5 h-3.5 mr-1" />
                                                    <span>End Live Session</span>
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={() => handleSetActiveSession(session)}
                                                    size="sm"
                                                    className="h-9 px-3.5 bg-slate-100 hover:bg-orange-500 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm"
                                                >
                                                    <Play className="w-3.5 h-3.5 mr-1" />
                                                    <span>Set Active</span>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* HIGH-RES PRINTABLE QR CODE MODAL */}
            <ProgramQrModal
                isOpen={isQrModalOpen}
                onClose={() => setIsQrModalOpen(false)}
            />
        </div>
    );
}
