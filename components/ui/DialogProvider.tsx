import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { Toast } from './Toast';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  subMessage?: string;
}

interface ModalConfig {
  isOpen: boolean;
  type: 'success' | 'danger' | 'primary';
  title: string;
  body: string;
  showInput?: boolean;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: { confirmed: boolean; value?: string }) => void;
}

interface DialogContextType {
  confirm: (options: {
    type?: 'success' | 'danger' | 'primary';
    title: string;
    body: string;
    showInput?: boolean;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }) => Promise<{ confirmed: boolean; value?: string }>;
  alert: (options: {
    title: string;
    body: string;
    type?: 'success' | 'danger' | 'primary';
  }) => Promise<void>;
  toast: {
    success: (message: string, subMessage?: string) => void;
    error: (message: string, subMessage?: string) => void;
    warning: (message: string, subMessage?: string) => void;
    info: (message: string, subMessage?: string) => void;
  };
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    type: 'primary',
    title: '',
    body: '',
  });

  const showToast = useCallback((type: ToastItem['type'], message: string, subMessage?: string) => {
    const id = self.crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message, subMessage }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback((options: {
    type?: 'success' | 'danger' | 'primary';
    title: string;
    body: string;
    showInput?: boolean;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  }) => {
    return new Promise<{ confirmed: boolean; value?: string }>((resolve) => {
      setModal({
        isOpen: true,
        type: options.type || 'primary',
        title: options.title,
        body: options.body,
        showInput: options.showInput || false,
        placeholder: options.placeholder || 'Enter details...',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: {
    title: string;
    body: string;
    type?: 'success' | 'danger' | 'primary';
  }) => {
    return new Promise<void>((resolve) => {
      setModal({
        isOpen: true,
        type: options.type || 'primary',
        title: options.title,
        body: options.body,
        showInput: false,
        confirmText: 'OK',
        cancelText: '',
        resolve: () => resolve(),
      });
    });
  }, []);

  const handleConfirm = useCallback((value: string) => {
    if (modal.resolve) {
      modal.resolve({ confirmed: true, value });
    }
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, [modal]);

  const handleCancel = useCallback(() => {
    if (modal.resolve) {
      modal.resolve({ confirmed: false });
    }
    setModal((prev) => ({ ...prev, isOpen: false }));
  }, [modal]);

  const toast = {
    success: (msg: string, sub?: string) => showToast('success', msg, sub),
    error: (msg: string, sub?: string) => showToast('error', msg, sub),
    warning: (msg: string, sub?: string) => showToast('warning', msg, sub),
    info: (msg: string, sub?: string) => showToast('info', msg, sub),
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, toast }}>
      {children}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        body={modal.body}
        showInput={modal.showInput}
        placeholder={modal.placeholder}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText || undefined}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />

      {/* Toast Notification Container */}
      <div 
        className="fixed z-[9999] flex flex-col gap-2 max-w-sm w-full p-4 pointer-events-none md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 bottom-4 left-1/2 -translate-x-1/2 md:p-0"
      >
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            type={t.type}
            message={t.message}
            subMessage={t.subMessage}
            onDismiss={dismissToast}
          />
        ))}
      </div>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
