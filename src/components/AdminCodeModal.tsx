import React, { useState, useEffect, useRef } from 'react';
import { X, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminCodeModal: React.FC<AdminCodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setError(false);
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = async (codeToTest = code) => {
    const clean = codeToTest.trim().toUpperCase();
    if (!clean) return;

    setIsVerifying(true);
    setError(false);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean })
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      } else {
        setError(true);
      }
    } catch (err) {
      // Direct local verification fallback if offline
      if (clean === 'NOVA498632') {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500);
      } else {
        setError(true);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().slice(0, 10);
    setCode(val);
    setError(false);

    // Auto verify once 10 characters are reached
    if (val.length === 10) {
      handleVerify(val);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleVerify();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <div className="relative w-full max-w-sm">
          {/* Petite croix au-dessus */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="group flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900/90 border border-white/10 text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white hover:scale-105 active:scale-95 shadow-lg"
            >
              <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          {/* Modal Box - AUCUNE DESCRIPTION comme demandé par l'utilisateur */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 340 }}
            className={`overflow-hidden rounded-2xl border p-6 shadow-2xl transition-all duration-300 ${
              error
                ? 'border-red-500/50 bg-[#14080a]'
                : isSuccess
                ? 'border-emerald-500/50 bg-[#07130e]'
                : 'border-white/10 bg-[#0c0e12]'
            }`}
          >
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={code}
                maxLength={10}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="••••••••••"
                autoComplete="off"
                spellCheck="false"
                className={`w-full rounded-xl bg-black/60 px-4 py-4 text-center font-mono text-xl tracking-[0.35em] text-white outline-none transition-all border ${
                  error
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500/40 text-red-300'
                    : isSuccess
                    ? 'border-emerald-500 text-emerald-300'
                    : 'border-white/15 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20'
                }`}
              />

              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={isVerifying || code.length === 0}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition-all hover:bg-emerald-500 hover:text-black disabled:opacity-30 disabled:pointer-events-none"
              >
                {isSuccess ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
