import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  subMessage?: string;
  onDismiss: (id: string) => void;
}

export function Toast({ id, type, message, subMessage, onDismiss }: ToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const duration = 4000;
    const intervalTime = 40; // 40ms interval for smooth transition
    const decrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onDismiss(id);
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="text-emerald-500 h-5 w-5 shrink-0" />,
    error: <AlertCircle className="text-red-500 h-5 w-5 shrink-0" />,
    warning: <AlertCircle className="text-amber-500 h-5 w-5 shrink-0" />,
    info: <Info className="text-blue-500 h-5 w-5 shrink-0" />,
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  const progressColors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div
      role="alert"
      className={`pointer-events-auto border rounded-xl shadow-lg p-4 flex gap-3 relative overflow-hidden transition-all duration-300 w-full max-w-sm bg-white ${bgColors[type]} animate-in slide-in-from-right-5 md:slide-in-from-right-5 slide-in-from-bottom-5 md:slide-in-from-bottom-0`}
    >
      {icons[type]}
      <div className="flex-1 min-w-0 pr-4">
        <h4 className="font-bold text-sm leading-tight break-words">{message}</h4>
        {subMessage && <p className="text-xs mt-1 text-slate-500 leading-normal break-words">{subMessage}</p>}
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-lg hover:bg-slate-100/50 absolute top-3 right-3"
      >
        <X size={16} />
      </button>
      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50">
        <div
          className={`h-full transition-all duration-75 ease-linear ${progressColors[type]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
