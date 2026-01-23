
import React, { useState } from 'react';
import { INTERESTS, EVENT_DETAILS } from '../constants';
import { RegistrationData } from '../types';
import { generatePersonalizedWelcome } from '../services/geminiService';

const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState<RegistrationData>({
    fullName: '',
    email: '',
    age: 15,
    school: '',
    interests: [],
    zoneParish: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggleInterest = (interest: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.interests.length === 0) {
      setError("Please pick your growth tracks.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const message = await generatePersonalizedWelcome(formData);
      setAiMessage(message);
      
      // Save registration to local storage for the 'Verify' feature
      const existing = JSON.parse(localStorage.getItem('ltc_registrations') || '[]');
      existing.push({ 
        email: formData.email.toLowerCase().trim(), 
        name: formData.fullName,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('ltc_registrations', JSON.stringify(existing));

      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsSuccess(true);
    } catch (err) {
      setAiMessage("Welcome to the LEAD experience at LTC 3.0!");
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    document.getElementById('register-modal')?.classList.add('hidden');
    document.body.style.overflow = 'unset';
    if (isSuccess) {
      setIsSuccess(false);
      setFormData({ fullName: '', email: '', age: 15, school: '', interests: [], zoneParish: '' });
    }
  };

  return (
    <div 
      id="register-modal" 
      className="fixed inset-0 z-[200] hidden overflow-y-auto px-4 py-8 md:py-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-[#1E1B4B]/90 backdrop-blur-xl" onClick={closeModal}></div>
      <div className="relative bg-[#F8F9FA] w-full max-w-2xl mx-auto rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] animate-in fade-in zoom-in duration-500 overflow-hidden">
        <button 
          onClick={closeModal} 
          className="absolute top-8 right-8 z-10 p-3 bg-white/80 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all shadow-sm border border-slate-100"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div className="max-h-[85vh] overflow-y-auto custom-scrollbar">
          {isSuccess ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-600/20">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h3 className="text-4xl font-black mb-3 text-[#1E1B4B] tracking-tight">You're in.</h3>
              <p className="text-slate-500 mb-10 mono text-[10px] uppercase tracking-[0.4em] font-bold">{formData.fullName} • REGISTERED</p>
              
              <div className="glass p-10 rounded-[2rem] border-white/80 text-left relative overflow-hidden mb-12 shadow-inner">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl"></div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] block mb-4 mono">Prophetic Mandate</span>
                <p className="text-[#1E1B4B] font-bold leading-relaxed italic text-xl md:text-2xl">
                  "{aiMessage}"
                </p>
              </div>
              
              <button 
                onClick={closeModal} 
                className="w-full py-6 bg-[#1E1B4B] text-white rounded-2xl font-black uppercase tracking-[0.4em] text-xs hover:bg-blue-700 transition-all shadow-2xl shadow-blue-900/20"
              >
                Close Invitation
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-10 md:p-16">
              <div className="mb-14 text-center">
                <div className="inline-block px-4 py-1.5 bg-blue-600/10 rounded-full mono text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">
                  Registration Portal
                </div>
                <h2 className="text-4xl font-black text-[#1E1B4B] tracking-tighter mb-3 leading-none">LEAD Experience.</h2>
                <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">Fill in your details to secure your spot for the conference.</p>
              </div>

              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-3 animate-pulse">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mb-14">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Full Name</label>
                  <input required type="text" className="underline-input font-bold" placeholder="E.g. Samuel Ade" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Email Address</label>
                  <input required type="email" className="underline-input font-bold" placeholder="hello@growth.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Zone / Parish (RCCG)</label>
                  <input required type="text" className="underline-input font-bold" placeholder="Region 19..." value={formData.zoneParish} onChange={e => setFormData({...formData, zoneParish: e.target.value})} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Age</label>
                  <input required type="number" min="10" max="25" className="underline-input font-bold" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
                </div>
              </div>

              <div className="mb-16">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-6 ml-1">Growth Tracks <span className="text-blue-500 font-black italic">(Pick one or more)</span></label>
                <div className="flex flex-wrap gap-3">
                  {INTERESTS.map(interest => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-6 py-3 rounded-2xl border-2 text-[10px] font-black transition-all uppercase tracking-[0.2em] shadow-sm ${
                        formData.interests.includes(interest)
                          ? 'bg-[#1E1B4B] border-[#1E1B4B] text-white'
                          : 'bg-white border-slate-100 text-slate-500 hover:border-blue-200'
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={isSubmitting}
                type="submit"
                className="w-full py-6 bg-[#1E1B4B] text-white rounded-2xl font-black text-xs uppercase tracking-[0.4em] hover:bg-blue-700 transition-all shadow-[0_20px_40px_-10px_rgba(30,27,75,0.3)] flex items-center justify-center gap-4 group disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Validating Seat...
                  </>
                ) : (
                  <>
                    Complete Registration
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </>
                )}
              </button>
              
              <p className="text-center text-[10px] font-bold text-slate-300 mt-10 mono uppercase tracking-widest">
                {EVENT_DETAILS.date.split(',').join(' • ')}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
