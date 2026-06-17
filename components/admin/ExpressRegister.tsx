import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useDialog } from '../ui/DialogProvider';
import { LAGOS_REGIONS, OGUN_REGIONS, REGIONS_AND_PROVINCES } from '@/constants';
import { Zap, Wifi, WifiOff, Loader2, Search, Check, ChevronDown, User, Phone, MapPin, Sparkles } from 'lucide-react';

export default function ExpressRegister() {
  const { toast } = useDialog();

  const [mounted, setMounted] = useState(false);

  // Basic authentication check
  const volunteerName = (typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_volunteer') : '') || 'admin';
  const userRole = typeof window !== 'undefined' ? sessionStorage.getItem('c3tc_admin_role') : '';

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | ''>('Male');
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
  const [regionCoords, setRegionCoords] = useState({ top: 0, left: 0, width: 0 });
  const [regionPlacement, setRegionPlacement] = useState<'top' | 'bottom'>('bottom');
  const regionDropdownRef = useRef<HTMLDivElement>(null);
  const regionInputRef = useRef<HTMLInputElement>(null);

  // Searchable Province Dropdown State
  const [provinceSearch, setProvinceSearch] = useState('');
  const [isProvinceDropdownOpen, setIsProvinceDropdownOpen] = useState(false);
  const [provinceCoords, setProvinceCoords] = useState({ top: 0, left: 0, width: 0 });
  const [provincePlacement, setProvincePlacement] = useState<'top' | 'bottom'>('bottom');
  const provinceDropdownRef = useRef<HTMLDivElement>(null);
  const provinceInputRef = useRef<HTMLInputElement>(null);

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
    setMounted(true);
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

  // Update dropdown positions on resize / scroll
  const updateDropdownCoords = useCallback(() => {
    if (isRegionDropdownOpen && regionInputRef.current) {
      const rect = regionInputRef.current.getBoundingClientRect();
      const dropdownHeight = 192; // max-h-48 is 192px
      const margin = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setRegionCoords({
          top: rect.top - dropdownHeight - margin,
          left: rect.left,
          width: rect.width
        });
        setRegionPlacement('top');
      } else {
        setRegionCoords({
          top: rect.bottom + margin,
          left: rect.left,
          width: rect.width
        });
        setRegionPlacement('bottom');
      }
    }
    if (isProvinceDropdownOpen && provinceInputRef.current) {
      const rect = provinceInputRef.current.getBoundingClientRect();
      const dropdownHeight = 192;
      const margin = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        setProvinceCoords({
          top: rect.top - dropdownHeight - margin,
          left: rect.left,
          width: rect.width
        });
        setProvincePlacement('top');
      } else {
        setProvinceCoords({
          top: rect.bottom + margin,
          left: rect.left,
          width: rect.width
        });
        setProvincePlacement('bottom');
      }
    }
  }, [isRegionDropdownOpen, isProvinceDropdownOpen]);

  useEffect(() => {
    if (isRegionDropdownOpen || isProvinceDropdownOpen) {
      window.addEventListener('resize', updateDropdownCoords);
      window.addEventListener('scroll', updateDropdownCoords, true);
    }
    return () => {
      window.removeEventListener('resize', updateDropdownCoords);
      window.removeEventListener('scroll', updateDropdownCoords, true);
    };
  }, [isRegionDropdownOpen, isProvinceDropdownOpen, updateDropdownCoords]);

  // Click outside listener for both dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isRegionDropdownOpen &&
        regionDropdownRef.current &&
        !regionDropdownRef.current.contains(e.target as Node) &&
        regionInputRef.current &&
        !regionInputRef.current.contains(e.target as Node)
      ) {
        setIsRegionDropdownOpen(false);
      }
      if (
        isProvinceDropdownOpen &&
        provinceDropdownRef.current &&
        !provinceDropdownRef.current.contains(e.target as Node) &&
        provinceInputRef.current &&
        !provinceInputRef.current.contains(e.target as Node)
      ) {
        setIsProvinceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRegionDropdownOpen, isProvinceDropdownOpen]);

  const openRegionDropdown = () => {
    if (regionInputRef.current) {
      const rect = regionInputRef.current.getBoundingClientRect();
      const dropdownHeight = 192;
      const margin = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + margin;
      let placement: 'top' | 'bottom' = 'bottom';
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - dropdownHeight - margin;
        placement = 'top';
      }
      
      setRegionCoords({
        top,
        left: rect.left,
        width: rect.width
      });
      setRegionPlacement(placement);
      setIsRegionDropdownOpen(true);
      setIsProvinceDropdownOpen(false); // Close the other
    }
  };

  const openProvinceDropdown = () => {
    if (!selectedRegion) return;
    if (provinceInputRef.current) {
      const rect = provinceInputRef.current.getBoundingClientRect();
      const dropdownHeight = 192;
      const margin = 4;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      let top = rect.bottom + margin;
      let placement: 'top' | 'bottom' = 'bottom';
      
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top - dropdownHeight - margin;
        placement = 'top';
      }
      
      setProvinceCoords({
        top,
        left: rect.left,
        width: rect.width
      });
      setProvincePlacement(placement);
      setIsProvinceDropdownOpen(true);
      setIsRegionDropdownOpen(false); // Close the other
    }
  };

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
            gender: item.gender,
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
              gender: item.gender,
              category: item.category,
              batch_reference: refCode,
              payment_status: item.payment_status,
              amount_due: item.amount_due,
              payment_method: item.payment_method
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

    if (!gender) {
      newErrors.gender = 'Gender is required';
      triggerShake('gender');
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
      gender: gender,
      category: category,
      region: selectedRegion,
      province: selectedProvince || selectedRegion, // Fallback to region as province
      payment_method: 'pay_on_arrival',
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
            gender: gender,
            category: category,
            batch_reference: referenceCode,
            payment_status: 'cleared',
            amount_due: amount,
            payment_method: 'pay_on_arrival'
          }
        });

      if (auditError) console.error("Audit log error:", auditError);

      incrementSessionCount();
      setTodayCount(prev => prev + 1);

      setLastRegisteredDelegate({ name: payload.full_name, ref: referenceCode });
      setIsSuccessFlashOpen(true);

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
    setGender('Male');
    setCategory('teenager');
    setSelectedRegion('');
    setSelectedProvince('');
    setRegionSearch('');
    setProvinceSearch('');
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
  const filteredProvinces = provinces.filter(p =>
    p.toLowerCase().includes(provinceSearch.toLowerCase())
  );

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
        /* Custom thin scrollbar matching both dropdowns */
        .dropdown-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .dropdown-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .dropdown-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .dropdown-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      {/* SUCCESS FLASH OVERLAY */}
      {isSuccessFlashOpen && lastRegisteredDelegate && (
        <div className="fixed inset-0 z-50 bg-[#16a34a] text-white flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-white/10 p-5 rounded-full mb-4 animate-bounce">
            <Check size={64} className="stroke-[4px]" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black font-heading tracking-tight mb-2 uppercase break-words max-w-full">
            {lastRegisteredDelegate.name}
          </h2>
          <p className="text-xl sm:text-2xl font-semibold opacity-90 tracking-wider">
            REGISTERED & CHECKED IN
          </p>
          <div className="mt-6 bg-black/20 border border-white/20 px-6 py-3 rounded-2xl font-mono text-2xl sm:text-3xl font-extrabold tracking-widest shadow-md">
            {lastRegisteredDelegate.ref}
          </div>

          {/* Success Screen Action Buttons */}
          <div className="mt-8 flex flex-col gap-3 w-full max-w-md shrink-0">
            <button
              type="button"
              onClick={() => {
                // Same Region / Group click: clears Name only. Keeps Phone, Region, Province, Category. Resets Gender to Male
                setFullName('');
                setGender('Male');
                setErrors({});
                setIsSuccessFlashOpen(false);
                setTimeout(() => {
                  if (fullNameRef.current) fullNameRef.current.focus();
                }, 100);
              }}
              className="w-full h-14 bg-white text-[#16a34a] hover:bg-emerald-50 font-black text-base uppercase tracking-wider rounded-xl shadow-lg border-0 cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.99] transition-all"
            >
              Same Region / Group
            </button>
            <button
              type="button"
              onClick={() => {
                // New Registration click: clears everything
                resetFormFields();
                setIsSuccessFlashOpen(false);
              }}
              className="w-full h-14 bg-emerald-800 text-white hover:bg-emerald-900 font-black text-base uppercase tracking-wider rounded-xl shadow-lg border border-emerald-700 cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.99] transition-all"
            >
              New Registration
            </button>
          </div>
        </div>
      )}

      {/* TOP COUNTERS & STATUS BAR */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
            </span>
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
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
            <span className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              Session: <strong className="text-blue-900 font-black">{sessionCount}</strong>
            </span>
            <span className="bg-orange-50 text-orange-800 border border-orange-200 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              Today: <strong className="text-orange-900 font-black">{todayCount}</strong>
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

      {/* CORE DESIGN FORM CARD */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm mt-3 flex-1 flex flex-col justify-between overflow-hidden">
        <form onSubmit={handleRegisterSubmit} className="flex-1 flex flex-col justify-between gap-3 overflow-hidden">
          {/* Responsive Row-by-Row Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 overflow-y-auto pr-1">
            
            {/* Row 1 Left: Full Name */}
            <div className="space-y-1">
              <label htmlFor="full-name-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-slate-400" /> Full Name <span className="text-red-500">*</span>
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
                className={`w-full h-11 px-3 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium ${
                  errors.fullName ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                } ${shakeFields.fullName ? 'animate-shake' : ''}`}
                autoComplete="off"
              />
              {errors.fullName && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.fullName}</p>}
            </div>

            {/* Row 1 Right: Region */}
            <div className="space-y-1 relative">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" /> Region <span className="text-red-500">*</span>
              </label>
              
              <div className="relative">
                <input
                  ref={regionInputRef}
                  type="text"
                  readOnly={!isRegionDropdownOpen}
                  placeholder={selectedRegion || "Select Region"}
                  value={isRegionDropdownOpen ? regionSearch : selectedRegion}
                  onClick={openRegionDropdown}
                  onChange={(e) => setRegionSearch(e.target.value)}
                  className={`w-full h-11 pl-3 pr-10 bg-white border rounded-xl text-slate-900 placeholder:text-slate-500 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer transition-all font-medium ${
                    errors.region ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  } ${shakeFields.region ? 'animate-shake' : ''}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Fixed Searchable Region Dropdown Menu */}
              {mounted && isRegionDropdownOpen && createPortal(
                <div 
                  ref={regionDropdownRef}
                  style={{
                    position: 'fixed',
                    top: `${regionCoords.top}px`,
                    left: `${regionCoords.left}px`,
                    width: `${regionCoords.width}px`,
                  }}
                  className={`z-[9999] bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto shadow-2xl animate-in fade-in duration-100 dropdown-scrollbar ${
                    regionPlacement === 'top' ? 'mb-1 origin-bottom' : 'mt-1 origin-top'
                  }`}
                >
                  <div className="sticky top-0 bg-white p-2 border-b border-slate-100 z-10">
                    <div className="relative flex items-center w-full">
                      <Search size={14} className="absolute left-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search regions..."
                        value={regionSearch}
                        onChange={(e) => setRegionSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-800 placeholder:text-slate-400 text-xs focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Grouped Regions */}
                  <div className="p-1">
                    {/* Lagos Header */}
                    {filteredLagos.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-orange-600 tracking-wider">Lagos</div>
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
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between hover:bg-slate-50 text-slate-700 ${
                          selectedRegion === r ? 'bg-orange-50 text-orange-600 font-bold border-l-2 border-orange-500' : ''
                        }`}
                      >
                        <span>{r}</span>
                        {selectedRegion === r && <Check size={12} />}
                      </button>
                    ))}

                    {/* Ogun Header */}
                    {filteredOgun.length > 0 && (
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase text-orange-600 tracking-wider mt-2">Ogun</div>
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
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between hover:bg-slate-50 text-slate-700 ${
                          selectedRegion === r ? 'bg-orange-50 text-orange-600 font-bold border-l-2 border-orange-500' : ''
                        }`}
                      >
                        <span>{r}</span>
                        {selectedRegion === r && <Check size={12} />}
                      </button>
                    ))}

                    {filteredLagos.length === 0 && filteredOgun.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">No regions found</div>
                    )}
                  </div>
                </div>,
                document.body
              )}
              {errors.region && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.region}</p>}
            </div>

            {/* Row 2 Left: Phone Number */}
            <div className="space-y-1">
              <label htmlFor="phone-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" /> Phone Number <span className="text-red-500">*</span>
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
                className={`w-full h-11 px-3 bg-white border rounded-xl text-slate-900 placeholder:text-slate-400 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all font-mono font-medium ${
                  errors.phone ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                } ${shakeFields.phone ? 'animate-shake' : ''}`}
              />
              {errors.phone && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.phone}</p>}
            </div>

            {/* Row 2 Right: Province Dropdown */}
            <div className="space-y-1 relative">
              <label className="text-[10.5px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap select-none">
                <MapPin size={13} className="text-slate-400 shrink-0" /> Province <span className="text-slate-400 font-normal lowercase text-[9.5px] sm:text-[10.5px]">(optional - fallbacks to region)</span>
              </label>
              
              <div className="relative">
                <input
                  ref={provinceInputRef}
                  type="text"
                  readOnly={!isProvinceDropdownOpen}
                  placeholder={selectedProvince || "Select Province (Fallback to Region)"}
                  value={isProvinceDropdownOpen ? provinceSearch : selectedProvince}
                  onClick={openProvinceDropdown}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  disabled={!selectedRegion}
                  className={`w-full h-11 pl-3 pr-10 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-500 text-base focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 cursor-pointer transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <ChevronDown size={18} />
                </div>
              </div>

              {/* Fixed Searchable Province Dropdown Menu */}
              {mounted && isProvinceDropdownOpen && selectedRegion && createPortal(
                <div 
                  ref={provinceDropdownRef}
                  style={{
                    position: 'fixed',
                    top: `${provinceCoords.top}px`,
                    left: `${provinceCoords.left}px`,
                    width: `${provinceCoords.width}px`,
                  }}
                  className={`z-[9999] bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto shadow-2xl animate-in fade-in duration-100 dropdown-scrollbar ${
                    provincePlacement === 'top' ? 'mb-1 origin-bottom' : 'mt-1 origin-top'
                  }`}
                >
                  <div className="sticky top-0 bg-white p-2 border-b border-slate-100 z-10">
                    <div className="relative flex items-center w-full">
                      <Search size={14} className="absolute left-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search provinces..."
                        value={provinceSearch}
                        onChange={(e) => setProvinceSearch(e.target.value)}
                        className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-800 placeholder:text-slate-400 text-xs focus:outline-none focus:border-orange-500"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="p-1">
                    <div className="px-2.5 py-1 text-[10px] font-black uppercase text-orange-600 tracking-wider">
                      Provinces under {selectedRegion}
                    </div>
                    {filteredProvinces.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setSelectedProvince(p);
                          setProvinceSearch('');
                          setIsProvinceDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between hover:bg-slate-50 text-slate-700 ${
                          selectedProvince === p ? 'bg-orange-50 text-orange-600 font-bold border-l-2 border-orange-500' : ''
                        }`}
                      >
                        <span>{p}</span>
                        {selectedProvince === p && <Check size={12} />}
                      </button>
                    ))}

                    {filteredProvinces.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">No provinces found</div>
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* Row 3 Left: Gender Toggle */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Gender <span className="text-red-500">*</span>
              </span>
              <div 
                className={`grid grid-cols-2 gap-2 mt-1 rounded-xl border p-1 ${
                  errors.gender ? 'border-red-500 bg-red-50/50' : 'border-slate-200 bg-white'
                } ${shakeFields.gender ? 'animate-shake' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setGender('Male');
                    if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
                  }}
                  className={`h-11 rounded-lg text-sm font-semibold transition-all cursor-pointer select-none active:scale-[0.97] flex items-center justify-center border-0 ${
                    gender === 'Male'
                      ? 'bg-[#0A1628] text-white font-extrabold shadow-sm'
                      : 'bg-gray-50 border border-gray-200/60 text-slate-700 hover:bg-gray-100'
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGender('Female');
                    if (errors.gender) setErrors(prev => ({ ...prev, gender: '' }));
                  }}
                  className={`h-11 rounded-lg text-sm font-semibold transition-all cursor-pointer select-none active:scale-[0.97] flex items-center justify-center border-0 ${
                    gender === 'Female'
                      ? 'bg-[#0A1628] text-white font-extrabold shadow-sm'
                      : 'bg-gray-50 border border-gray-200/60 text-slate-700 hover:bg-gray-100'
                  }`}
                >
                  Female
                </button>
              </div>
              {errors.gender && <p className="text-[11px] text-red-500 font-bold tracking-wide">{errors.gender}</p>}
            </div>

            {/* Row 3 Right: Category Toggle */}
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Category <span className="text-red-500">*</span>
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1 rounded-xl border border-slate-200 p-1 bg-white">
                <button
                  type="button"
                  onClick={() => setCategory('teenager')}
                  className={`h-11 rounded-lg border-0 flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-[0.97] ${
                    category === 'teenager'
                      ? 'bg-[#16a34a] text-white font-extrabold shadow-sm'
                      : 'bg-gray-50 border border-gray-200/60 text-slate-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-semibold">Teenager</span>
                  <span className={`text-[10px] ${category === 'teenager' ? 'text-emerald-100 opacity-90' : 'text-slate-500'} font-bold`}>₦1,000</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('teacher')}
                  className={`h-11 rounded-lg border-0 flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-[0.97] ${
                    category === 'teacher'
                      ? 'bg-[#f97316] text-white font-extrabold shadow-sm'
                      : 'bg-gray-50 border border-gray-200/60 text-slate-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-sm font-semibold">Teacher / Adult</span>
                  <span className={`text-[10px] ${category === 'teacher' ? 'text-orange-100 opacity-90' : 'text-slate-500'} font-bold`}>₦1,500</span>
                </button>
              </div>
            </div>

          </div>

          {/* Row 4: Amount Collected Display */}
          <div className="bg-white border border-slate-200 p-3 rounded-2xl flex justify-between items-center shadow-sm mt-1 shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Amount Collected</span>
              <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <Sparkles size={10} className="text-emerald-500" /> cleared by cash/transfer
              </span>
            </div>
            <div 
              style={{ fontSize: 'clamp(1.25rem, 5vw, 1.875rem)' }}
              className="font-black font-heading text-orange-500 tracking-tight whitespace-nowrap shrink-0 ml-2"
            >
              {category === 'teenager' ? '₦1,000' : '₦1,500'}
            </div>
          </div>

          {/* SUBMIT REGISTRATION BUTTON */}
          <div className="pt-1 shrink-0">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-300 disabled:to-slate-400 disabled:text-slate-500 text-white font-black text-base uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.99] border-0 cursor-pointer flex items-center justify-center gap-2 select-none"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Registering & Checking In...
                </>
              ) : (
                <>
                  <Zap size={18} className="fill-white" />
                  REGISTER & CHECK IN
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
