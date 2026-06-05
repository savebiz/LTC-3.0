import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { LAGOS_REGIONS, OGUN_REGIONS, REGIONS_AND_PROVINCES } from '@/constants';
import { Zap, Wifi, WifiOff, Loader2, Search, Check, ChevronDown, User, Phone, MapPin, Sparkles } from 'lucide-react';

export default function ExpressRegister() {
  const { toast } = useDialog();

  // Basic authentication check
  const volunteerName = (typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_volunteer') : '') || 'admin';
  const userRole = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_role') : '';

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<'teenager' | 'teacher'>('teenager');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');

  // Counters State
  const [sessionCount, setSessionCount] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('c3tc_express_session_count');
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });
  const [todayCount, setTodayCount] = useState(0);

  // Searchable Region Dropdown State
  const [regionSearch, setRegionSearch] = useState('');
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const regionInputRef = useRef<HTMLInputElement>(null);

  // Validation & Animation State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shakeFields, setShakeFields] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Success Flash State
  const [isSuccessFlashOpen, setIsSuccessFlashOpen] = useState(false);
  const [lastRegisteredDelegate, setLastRegisteredDelegate] = useState<{ name: string; ref: string } | null>(null);

  // Offline Resilience State
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queue, setQueue] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('c3tc_queued_express_registrations');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  // Focus Ref for Auto-focus
  const fullNameRef = useRef<HTMLInputElement>(null);

  // Wake Lock Sentinel
  const wakeLockRef = useRef<any>(null);

  // Request screen wake lock
  const requestWakeLock = async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        console.log('Screen Wake Lock acquired successfully');
      }
    } catch (err: any) {
      console.warn(`Screen Wake Lock error: ${err.name}, ${err.message}`);
    }
  };

  // Release screen wake lock
  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Screen Wake Lock released');
      }
    } catch (err: any) {
      console.error('Failed to release wake lock:', err);
    }
  };

  // Enforce Access Control client-side
  useEffect(() => {
    if (userRole && userRole !== 'Super Admin' && userRole !== 'Access Admin') {
      toast.error('Access Denied', 'You do not have permission to view the Express Registration page.');
    }
  }, [userRole]);

  // Wake Lock and Focus Setup on Mount
  useEffect(() => {
    requestWakeLock();
    
    // Autofocus name input on load
    if (fullNameRef.current) {
      fullNameRef.current.focus();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  // Fetch Today's Count from Audit Log
  const fetchTodayCount = async () => {
    try {
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      const midnightISO = midnight.toISOString();

      const { count, error } = await supabase
        .from('audit_log')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'express_registration')
        .gte('created_at', midnightISO);

      if (!error && count !== null) {
        setTodayCount(count);
      }
    } catch (err) {
      console.error('Error fetching today count:', err);
    }
  };

  useEffect(() => {
    fetchTodayCount();
  }, []);

  // Monitor Online/Offline state & trigger sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queue]);

  // Sync Queue Background Process
  const syncQueue = async (currentQueue: any[]) => {
    if (currentQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    let successCount = 0;
    const remainingQueue = [...currentQueue];

    try {
      for (let i = 0; i < currentQueue.length; i++) {
        const item = currentQueue[i];

        const { data: regData, error: regError } = await supabase
          .from('registrations')
          .insert({
            id: item.id,
            full_name: item.full_name,
            phone: item.phone,
            category: item.category,
            region: item.region,
            province: item.province,
            amount_due: item.amount_due,
            type: item.type,
            payment_method: item.payment_method,
            payment_status: item.payment_status,
            cleared_by: item.cleared_by,
            cleared_at: item.cleared_at,
            checked_in: item.checked_in,
            checked_in_at: item.checked_in_at,
            registration_type: item.registration_type,
            batch_id: item.batch_id
          })
          .select();

        if (regError) {
          console.error('Sync error inserting delegate:', regError);
          // If insert fails due to DB rules or network, pause syncing
          break;
        }

        const insertedRecord = regData && regData[0];
        const refCode = insertedRecord ? insertedRecord.batch_reference : 'C3TC-2026-SYNC';

        // Write Audit Log Entry
        const { error: logError } = await supabase
          .from('audit_log')
          .insert({
            action: 'express_registration',
            registration_id: item.id,
            batch_reference: refCode,
            registrant_name: item.full_name,
            performed_by: item.cleared_by,
            device_info: typeof navigator !== 'undefined' ? navigator.userAgent + ' (Synced)' : 'Offline Sync',
            new_value: {
              id: item.id,
              full_name: item.full_name,
              category: item.category,
              batch_reference: refCode,
              payment_status: item.payment_status,
              amount_due: item.amount_due
            }
          });

        if (logError) {
          console.warn('Sync warning writing audit log:', logError);
        }

        successCount++;
        remainingQueue.shift();
      }
    } catch (err) {
      console.error('Error in sync queue task:', err);
    } finally {
      setIsSyncing(false);
      localStorage.setItem('c3tc_queued_express_registrations', JSON.stringify(remainingQueue));
      setQueue(remainingQueue);

      if (successCount > 0) {
        toast.success(
          'Offline Registrations Synced',
          `${successCount} queued delegate${successCount > 1 ? 's' : ''} synced successfully.`
        );
        fetchTodayCount();
      }
    }
  };

  const triggerSync = () => {
    const stored = localStorage.getItem('c3tc_queued_express_registrations');
    const currentQueue = stored ? JSON.parse(stored) : [];
    if (currentQueue.length > 0) {
      syncQueue(currentQueue);
    }
  };

  // Close searchable region dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setIsRegionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update sessionCount in sessionStorage helper
  const incrementSessionCount = () => {
    const nextVal = sessionCount + 1;
    setSessionCount(nextVal);
    sessionStorage.setItem('c3tc_express_session_count', nextVal.toString());
  };

  // Validation Shake Trigger Helper
  const triggerShake = (field: string) => {
    setShakeFields(prev => ({ ...prev, [field]: true }));
    setTimeout(() => {
      setShakeFields(prev => ({ ...prev, [field]: false }));
    }, 500);
  };

  // Form Submission Logic
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};

    // 1. Validation Checks
    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
      triggerShake('fullName');
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone Number is required';
      triggerShake('phone');
    } else if (phone.trim().replace(/\D/g, '').length < 10) {
      newErrors.phone = 'Enter a valid Nigerian phone number';
      triggerShake('phone');
    }

    if (!selectedRegion) {
      newErrors.region = 'Region is required';
      triggerShake('region');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Autofocus first failing field
      if (newErrors.fullName && fullNameRef.current) {
        fullNameRef.current.focus();
      } else if (newErrors.phone) {
        // focus phone input
        const phoneEl = document.getElementById('phone-input');
        if (phoneEl) phoneEl.focus();
      }
      return;
    }

    setLoading(true);

    const amount = category === 'teenager' ? 1000 : 1500;
    const registrationId = self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
    const batchId = self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

    const payload = {
      id: registrationId,
      full_name: fullName.trim(),
      phone: phone.trim().replace(/\D/g, ''),
      category: category,
      region: selectedRegion,
      province: selectedProvince || selectedRegion, // Fallback to region as province
      payment_method: 'bank_transfer',
      payment_status: 'cleared',
      cleared_by: volunteerName,
      cleared_at: new Date().toISOString(),
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      type: 'delegate',
      amount_due: amount,
      registration_type: 'individual',
      batch_id: batchId
    };

    if (!isOnline) {
      // Offline Processing
      const nextQueue = [...queue, payload];
      localStorage.setItem('c3tc_queued_express_registrations', JSON.stringify(nextQueue));
      setQueue(nextQueue);
      incrementSessionCount();
      
      // Open Flash Screen immediately
      const tempRef = `OFFLINE-${Math.floor(1000 + Math.random() * 9000)}`;
      setLastRegisteredDelegate({ name: payload.full_name, ref: tempRef });
      setIsSuccessFlashOpen(true);
      setLoading(false);

      // Trigger auto reset after 1.5s
      setTimeout(() => {
        setIsSuccessFlashOpen(false);
        resetFormFields();
      }, 1500);

      return;
    }

    // Online Processing
    try {
      const { data: regData, error: regError } = await supabase
        .from('registrations')
        .insert(payload)
        .select();

      if (regError) throw regError;

      const insertedRecord = regData && regData[0];
      const referenceCode = insertedRecord ? insertedRecord.batch_reference : `C3TC-${Math.floor(10000 + Math.random() * 90000)}`;

      // Insert Audit Log Entry (Non-blocking but awaited for robustness)
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert({
          action: 'express_registration',
          registration_id: registrationId,
          batch_reference: referenceCode,
          registrant_name: payload.full_name,
          performed_by: volunteerName,
          device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Web Client',
          new_value: {
            id: registrationId,
            full_name: payload.full_name,
            category: category,
            batch_reference: referenceCode,
            payment_status: 'cleared',
            amount_due: amount
          }
        });

      if (auditError) console.error("Audit log error:", auditError);

      incrementSessionCount();
      setTodayCount(prev => prev + 1);

      setLastRegisteredDelegate({ name: payload.full_name, ref: referenceCode });
      setIsSuccessFlashOpen(true);

      // Trigger auto reset after 1.5s
      setTimeout(() => {
        setIsSuccessFlashOpen(false);
        resetFormFields();
      }, 1500);

    } catch (err: any) {
      console.error('Express registration submit error:', err);
      toast.error('Registration failed — please try again', err.message || '');
    } finally {
      setLoading(false);
    }
  };

  // Reset form helper
  const resetFormFields = () => {
    setFullName('');
    setPhone('');
    setCategory('teenager');
    setSelectedRegion('');
    setSelectedProvince('');
    setRegionSearch('');
    setErrors({});
    
    // Autofocus name input
    if (fullNameRef.current) {
      fullNameRef.current.focus();
    }
  };

  // Filter Region options
  const filteredLagos = LAGOS_REGIONS.filter(r =>
    r.toLowerCase().includes(regionSearch.toLowerCase())
  );
  const filteredOgun = OGUN_REGIONS.filter(r =>
    r.toLowerCase().includes(regionSearch.toLowerCase())
  );

  const provinces = selectedRegion ? REGIONS_AND_PROVINCES[selectedRegion] || [] : [];

  return (
    <div className="w-full h-full max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col justify-between p-1 select-none">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-6px); }
          30%, 60%, 90% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      {/* SUCCESS FLASH OVERLAY */}
      {isSuccessFlashOpen && lastRegisteredDelegate && (
        <div className="fixed inset-0 z-50 bg-[#16a34a] text-white flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/10 p-5 rounded-full mb-6 animate-bounce">
            <Check size={64} className="stroke-[4px]" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black font-heading tracking-tight mb-2 uppercase break-words max-w-full">
            {lastRegisteredDelegate.name}
          </h2>
          <p className="text-xl sm:text-2xl font-semibold opacity-90 tracking-wider">
            REGISTERED & CHECKED IN
          </p>
          <div className="mt-8 bg-black/20 border border-white/20 px-6 py-3 rounded-2xl font-mono text-2xl sm:text-3xl font-extrabold tracking-widest shadow-md">
            {lastRegisteredDelegate.ref}
          </div>
        </div>
      )}

      {/* TOP COUNTERS & STATUS BAR */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              {isOnline ? (
                <>
                  <Wifi size={14} className="text-green-500" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff size={14} className="text-red-500 animate-pulse" />
                  Offline Mode
                </>
              )}
            </span>
          </div>
          
          <div className="flex gap-2">
            <span className="bg-slate-800 text-slate-300 font-bold px-3 py-1 rounded-full text-xs border border-slate-700/50">
              Session: <strong className="text-white font-black">{sessionCount}</strong>
            </span>
            <span className="bg-slate-800 text-orange-400 font-bold px-3 py-1 rounded-full text-xs border border-slate-700/50">
              Today: <strong className="text-white font-black">{todayCount}</strong>
            </span>
          </div>
        </div>

        {/* Offline Queue Indicator */}
        {!isOnline && queue.length > 0 && (
          <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-between shadow-md animate-in slide-in-from-top-3">
            <div className="flex items-center gap-2">
              <WifiOff size={14} className="animate-pulse" />
              <span>Offline — {queue.length} registration{queue.length > 1 ? 's' : ''} queued. Will sync when connection returns.</span>
            </div>
            {isSyncing && <Loader2 size={12} className="animate-spin" />}
          </div>
        )}
      </div>

      {/* CORE DESIGN FORM */}
      <form onSubmit={handleRegisterSubmit} className="flex-1 flex flex-col justify-between mt-3 gap-3">
        {/* Responsive Grid Structure to eliminate scrolling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto pr-1">
          
          {/* Column 1: Info */}
          <div className="space-y-3">
            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="full-name-input" className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} /> Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="full-name-input"
                ref={fullNameRef}
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                }}
                placeholder="Enter delegate full name"
                className={`w-full h-11 px-3 bg-slate-900 border rounded-xl text-slate-100 placeholder:text-slate-500 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium ${
                  errors.fullName ? 'border-red-500 bg-red-950/10' : 'border-slate-800'
                } ${shakeFields.fullName ? 'animate-shake' : ''}`}
                autoComplete="off"
              />
              {errors.fullName && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.fullName}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-1">
              <label htmlFor="phone-input" className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={13} /> Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone-input"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setPhone(val);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                }}
                placeholder="080XXXXXXXX"
                className={`w-full h-11 px-3 bg-slate-900 border rounded-xl text-slate-100 placeholder:text-slate-500 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-mono font-medium ${
                  errors.phone ? 'border-red-500 bg-red-950/10' : 'border-slate-800'
                } ${shakeFields.phone ? 'animate-shake' : ''}`}
              />
              {errors.phone && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.phone}</p>}
            </div>

            {/* Category selection */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Category <span className="text-red-500">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setCategory('teenager')}
                  className={`h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-[0.97] ${
                    category === 'teenager'
                      ? 'bg-emerald-600 border-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  <span className="text-sm">Teenager</span>
                  <span className={`text-xs ${category === 'teenager' ? 'text-emerald-100 opacity-90' : 'text-slate-500'} font-bold`}>₦1,000</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('teacher')}
                  className={`h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-[0.97] ${
                    category === 'teacher'
                      ? 'bg-orange-500 border-orange-400 text-white font-extrabold shadow-lg shadow-orange-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                >
                  <span className="text-sm">Teacher / Adult</span>
                  <span className={`text-xs ${category === 'teacher' ? 'text-orange-100 opacity-90' : 'text-slate-500'} font-bold`}>₦1,500</span>
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Region, Province & Cost Display */}
          <div className="space-y-3 flex flex-col justify-between">
            {/* Region searchable input */}
            <div className="space-y-1 relative" ref={regionDropdownRef}>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} /> Region <span className="text-red-500">*</span>
              </label>
              
              <div className="relative">
                <input
                  ref={regionInputRef}
                  type="text"
                  readOnly={!isRegionDropdownOpen}
                  placeholder={selectedRegion || "Select Region"}
                  value={isRegionDropdownOpen ? regionSearch : selectedRegion}
                  onClick={() => setIsRegionDropdownOpen(true)}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  className={`w-full h-11 pl-3 pr-10 bg-slate-900 border rounded-xl text-slate-100 placeholder:text-slate-400 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer transition-all font-medium ${
                    errors.region ? 'border-red-500 bg-red-950/10' : 'border-slate-800'
                  } ${shakeFields.region ? 'animate-shake' : ''}`}
                />
                <div 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                >
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Float Dropdown Menu */}
              {isRegionDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-2xl animate-in fade-in duration-100">
                  <div className="sticky top-0 bg-slate-950 p-2 border-b border-slate-900">
                    <div className="relative flex items-center w-full">
                      <Search size={14} className="absolute left-2.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search regions..."
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Grouped Regions */}
                  <div className="p-1">
                    {/* Lagos Header */}
                    {filteredLagos.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-orange-500 tracking-wider">Lagos</div>
                    )}
                    {filteredLagos.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setSelectedRegion(r);
                          setSelectedProvince('');
                          setRegionSearch('');
                          setIsRegionDropdownOpen(false);
                          if (errors.region) setErrors(prev => ({ ...prev, region: '' }));
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between hover:bg-slate-900 text-slate-200 ${
                          selectedRegion === r ? 'bg-orange-500/10 text-orange-400 font-bold border-l-2 border-orange-500' : ''
                        }`}
                      >
                        <span>{r}</span>
                        {selectedRegion === r && <Check size={12} />}
                      </button>
                    ))}

                    {/* Ogun Header */}
                    {filteredOgun.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-orange-500 tracking-wider mt-2">Ogun</div>
                    )}
                    {filteredOgun.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setSelectedRegion(r);
                          setSelectedProvince('');
                          setRegionSearch('');
                          setIsRegionDropdownOpen(false);
                          if (errors.region) setErrors(prev => ({ ...prev, region: '' }));
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between hover:bg-slate-900 text-slate-200 ${
                          selectedRegion === r ? 'bg-orange-500/10 text-orange-400 font-bold border-l-2 border-orange-500' : ''
                        }`}
                      >
                        <span>{r}</span>
                        {selectedRegion === r && <Check size={12} />}
                      </button>
                    ))}

                    {filteredLagos.length === 0 && filteredOgun.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-500">No regions found</div>
                    )}
                  </div>
                </div>
              )}
              {errors.region && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.region}</p>}
            </div>

            {/* Province Selection */}
            <div className="space-y-1">
              <label htmlFor="province-select" className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Province <span className="text-slate-500">(Optional - Fallbacks to Region)</span>
              </label>
              <select
                id="province-select"
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                disabled={!selectedRegion}
                className={`w-full h-11 px-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">Select Province (Fallback to Region)</option>
                {provinces.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Amount Collected display box */}
            <div className="bg-slate-950/80 border border-slate-900 p-3 rounded-2xl flex justify-between items-center shadow-inner mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Amount Collected</span>
                <span className="text-[10px] text-emerald-500 font-bold mt-0.5 flex items-center gap-1">
                  <Sparkles size={10} /> cleared by cash/transfer
                </span>
              </div>
              <div className="text-3xl font-black font-heading text-orange-500 tracking-tight">
                {category === 'teenager' ? '₦1,000' : '₦1,500'}
              </div>
            </div>

          </div>
        </div>

        {/* SUBMIT REGISTRATION BUTTON */}
        <div className="pt-2 shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 text-white font-black text-base uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] border-0 cursor-pointer flex items-center justify-center gap-2 select-none"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Registering & Checking In...
              </>
            ) : (
              <>
                <Zap size={18} className="fill-white" />
                Register & Check In
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
