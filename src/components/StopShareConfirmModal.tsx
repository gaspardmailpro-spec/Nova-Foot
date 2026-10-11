import React from 'react';
import { motion } from 'motion/react';
import { StopCircle, Trash2, Radio, X } from 'lucide-react';

interface StopShareConfirmModalProps {
  isOpen: boolean;
  onConfirmStopAndDelete: () => void;
  onConfirmJustStop: () => void;
  onCancel: () => void;
}

export const StopShareConfirmModal: React.FC<StopShareConfirmModalProps> = ({
  isOpen,
  onConfirmStopAndDelete,
  onConfirmJustStop,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400">
          <StopCircle className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-bold text-white mb-2">
          Arrêter le partage d'écran
        </h3>
        <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
          Choisissez si vous souhaitez conserver la diffusion dans la liste des matchs à venir ou la supprimer définitivement du site.
        </p>

        <div className="space-y-3">
          {/* Bouton 1 demandé par l'utilisateur: Couper le partage et terminer et supprimer la diffusion */}
          <button
            type="button"
            onClick={onConfirmStopAndDelete}
            className="group w-full flex items-center justify-center gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3.5 text-xs font-bold text-red-300 hover:bg-red-900/60 hover:text-white transition-all shadow-lg active:scale-95"
          >
            <Trash2 className="h-4 w-4 text-red-400 group-hover:rotate-12 transition-transform" />
            <span>Couper le partage, terminer et supprimer la diffusion</span>
          </button>

          {/* Bouton 2 demandé par l'utilisateur: Non juste couper le partage */}
          <button
            type="button"
            onClick={onConfirmJustStop}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 px-4 py-3.5 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-md active:scale-95"
          >
            <Radio className="h-4 w-4" />
            <span>Non, juste couper le partage (Conserver la diffusion)</span>
          </button>

          {/* Annuler */}
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Annuler (Continuer le live)
          </button>
        </div>
      </motion.div>
    </div>
  );
};
