
import React, { useState } from 'react';

const ConfirmRegistration: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [userData, setUserData] = useState<{name: string, date: string} | null>(null);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('searching');
    
    // Simulate lookup delay for that "professional" feel
    setTimeout(() => {
      const registrations = JSON.parse(localStorage.getItem('ltc_registrations') || '[]');
      const found = registrations.find((r: any) => r.email === email.toLowerCase().trim());
      
      if (found) {
        setUserData({ name: found.name, date: found.timestamp });
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    }, 1500);
  };

  return (
    <div className="glass p-10 md:p-16 rounded-[3rem] border-white/60 shadow-2xl relative overflow-hidden max-w-4xl mx-auto">
      <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
        <svg className="w-64 h-64 text-blue-900" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>

      <div className="relative z-10 grid md:grid-cols-5 gap-12 items-center">
        <div className="md:col-span-2">
            <span className="mono text-[10px] font-bold text-blue-600 uppercase tracking-[0.4em] mb-4 block">Self Service</span>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-4 leading-none">Check Status.</h3>
            <p className="text-slate-500 font-medium leading-relaxed">
              Verify your registration and access details instantly.
            </p>
        </div>

        <div className="md:col-span-3">
            {status === 'found' ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-blue-600 rounded-[2rem] text-white shadow-2xl shadow-blue-600/20 mb-6 border border-white/20">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-md">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <div className="text-center sm:text-left">
                    <h4 className="text-xl font-black tracking-tight">{userData?.name}</h4>
                    <p className="mono text-[10px] uppercase font-bold tracking-[0.2em] opacity-80 mt-1">
                    Confirmed • {new Date(userData?.date || '').toLocaleDateString()}
                    </p>
                </div>
                </div>
                <button 
                onClick={() => { setStatus('idle'); setEmail(''); }}
                className="w-full py-3 text-center text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-800 transition-colors"
                >
                Check another email
                </button>
            </div>
            ) : (
            <form onSubmit={handleVerify} className="relative">
                <div className="relative mb-6 group">
                <input 
                    required
                    type="email"
                    placeholder="Enter your registered email"
                    className="w-full bg-white/50 border border-slate-200 rounded-2xl px-6 py-5 pr-12 text-lg font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={status === 'searching'}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </div>
                </div>

                {status === 'not_found' && (
                <div className="absolute -top-16 left-0 right-0 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    Email not found. Please check spelling.
                </div>
                )}

                <button
                disabled={status === 'searching'}
                type="submit"
                className="w-full py-5 bg-[#1E1B4B] text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/10 disabled:opacity-70 flex items-center justify-center gap-3 active:scale-95"
                >
                {status === 'searching' ? (
                    <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Verifying...
                    </>
                ) : (
                    'Verify Registration'
                )}
                </button>
            </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmRegistration;
