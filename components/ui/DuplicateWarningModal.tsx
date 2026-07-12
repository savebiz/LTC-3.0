import React from 'react';
import { Button } from './button';
import { AlertTriangle, X } from 'lucide-react';

interface DuplicateMatch {
  id: string;
  full_name: string;
  created_at: string;
  status: string;
  payment_status?: string;
  phone: string;
  similarity: number;
  batch_reference?: string;
  rejection_reason?: string;
}

interface DuplicateWarningModalProps {
  isOpen: boolean;
  type: 'delegate' | 'volunteer';
  matches: DuplicateMatch[];
  onCancel: () => void; // "Different Person — Continue Registration"
  onClose: () => void;
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.trim();
  if (clean.length <= 4) return clean;
  return '****' + clean.slice(-4);
}

export function DuplicateWarningModal({
  isOpen,
  type,
  matches,
  onCancel,
  onClose
}: DuplicateWarningModalProps) {
  if (!isOpen || matches.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Modal Container (Bottom sheet on mobile, Centered Card on desktop) */}
      <div 
        role="dialog"
        aria-modal="true"
        className="w-full max-h-[90vh] sm:max-h-[85vh] rounded-t-[20px] sm:rounded-[12px] bg-white border-t sm:border border-slate-200 p-6 shadow-2xl relative z-10 text-slate-900 transition-all duration-200 animate-in slide-in-from-bottom sm:zoom-in-95 max-w-lg overflow-y-auto"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-650 rounded-lg p-1 hover:bg-slate-100 transition-colors focus:outline-none cursor-pointer"
          title="Close Warning"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Amber Warning Icon */}
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-500 rounded-full shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
              We found a similar registration
            </h3>
            
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              It looks like this person may already be registered. If this is you, please check with your coordinator or the registration team on the day. If this is a different person, tap Continue below.
            </p>

            {/* Matched Records Card List */}
            <div className="mt-4 space-y-3">
              {matches.slice(0, 3).map((match) => {
                const isCleared = match.payment_status?.toLowerCase() === 'cleared' || match.status?.toLowerCase() === 'confirmed';
                const isPending = match.payment_status?.toLowerCase() === 'pending' || match.status?.toLowerCase() === 'pending_payment' || match.status?.toLowerCase() === 'pending_verification';
                const isArrival = match.payment_status?.toLowerCase() === 'pay_on_arrival' || match.status?.toLowerCase() === 'pay_on_arrival' || match.payment_method?.toLowerCase() === 'pay_on_arrival';
                const isRejected = match.status?.toLowerCase() === 'rejected' || match.payment_status?.toLowerCase() === 'rejected';

                let statusBadgeClass = 'bg-amber-50 border-amber-200 text-amber-700';
                let statusLabel = match.status || 'Pending';
                if (isCleared) {
                  statusBadgeClass = 'bg-emerald-50 border-emerald-200 text-emerald-700';
                  statusLabel = 'Cleared';
                } else if (isArrival) {
                  statusBadgeClass = 'bg-blue-50 border-blue-200 text-blue-700';
                  statusLabel = 'Pay on Arrival';
                } else if (isRejected) {
                  statusBadgeClass = 'bg-red-50 border-red-200 text-red-700';
                  statusLabel = 'Rejected';
                } else if (isPending) {
                  statusBadgeClass = 'bg-amber-50 border-amber-200 text-amber-700';
                  statusLabel = 'Pending';
                }

                return (
                  <div key={match.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs font-semibold text-slate-700">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-bold text-slate-900 leading-tight">{match.full_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold capitalize border shrink-0 ${statusBadgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-500 font-medium">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Registration Date</span>
                        <span className="mt-0.5 block">{new Date(match.created_at).toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Phone Number</span>
                        <span className="mt-0.5 block font-mono">{maskPhone(match.phone)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-4 items-center">
          <Button
            className="w-full h-12 sm:h-10 bg-orange-500 hover:bg-orange-650 text-white font-bold rounded-xl flex items-center justify-center cursor-pointer text-sm"
            onClick={onCancel}
          >
            Different Person — Continue Registration
          </Button>
          
          <button
            type="button"
            className="text-slate-500 hover:text-slate-750 font-semibold text-sm underline cursor-pointer py-1.5 focus:outline-none"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
