import { useEffect, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  type?: 'success' | 'danger' | 'primary';
  title: string;
  body: string;
  showInput?: boolean;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  type = 'primary',
  title,
  body,
  showInput = false,
  placeholder = 'Enter details...',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    document.body.style.overflow = 'hidden';
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      if (modalRef.current) {
        const input = modalRef.current.querySelector('input') as HTMLElement;
        if (input) {
          input.focus();
        } else {
          const cancelBtn = modalRef.current.querySelector('.cancel-btn') as HTMLElement;
          if (cancelBtn) {
            cancelBtn.focus();
          }
        }
      }
    }, 50);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const iconMap = {
    success: <CheckCircle2 className="text-emerald-500 h-6 w-6 shrink-0" />,
    danger: <AlertCircle className="text-red-500 h-6 w-6 shrink-0" />,
    primary: <Info className="text-orange-500 h-6 w-6 shrink-0" />,
  };

  const confirmColors = {
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent focus:ring-emerald-500/20',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent focus:ring-red-500/20',
    primary: 'bg-orange-600 hover:bg-orange-700 text-white border-transparent focus:ring-orange-500/20',
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-white border border-slate-200 rounded-[12px] p-6 w-full max-w-[420px] shadow-2xl relative z-10 text-slate-900 transition-all duration-200 animate-in fade-in zoom-in-95"
      >
        <div className="flex gap-3">
          {iconMap[type]}
          <div className="flex-1 min-w-0">
            <h3 id="modal-title" className="text-lg font-bold text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              {body}
            </p>
          </div>
        </div>

        {showInput && (
          <div className="mt-4">
            <Input 
              placeholder={placeholder}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full text-slate-900 placeholder:text-slate-400 border-slate-300 focus:border-slate-400 rounded-xl"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {cancelText && (
            <Button
              variant="outline"
              className="cancel-btn hover:bg-slate-50 border-slate-200 text-slate-700 font-semibold"
              onClick={onCancel}
            >
              {cancelText}
            </Button>
          )}
          <Button
            className={`confirm-btn font-semibold ${confirmColors[type]}`}
            onClick={() => onConfirm(inputValue)}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
