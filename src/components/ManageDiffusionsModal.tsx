import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Trash2, Plus, Clock, Tv, AlertCircle, Check, Calendar } from 'lucide-react';
import { Diffusion } from '../types';
import { getUpcomingInfo } from '../utils/dateUtils';

interface ManageDiffusionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffusions: Diffusion[];
  onFeature: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onOpenCreateModal: () => void;
}

export const ManageDiffusionsModal: React.FC<ManageDiffusionsModalProps> = ({
  isOpen,
  onClose,
  diffusions,
  onFeature,
  onDelete,
  onOpenCreateModal
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFeatureClick = async (id: string) => {
    setLoadingId(id);
    try {
      await onFeature(id);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteClick = async (id: string) => {
    setLoadingId(id);
    try {
      await onDelete(id);
      setDeleteConfirmId(null);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#12141a] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Gérer les diffusions</h2>
              <p className="text-xs text-neutral-400">
                Supprimez ou épinglez une diffusion à la une (affichée en grand)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content / Diffusions list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {diffusions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tv className="h-10 w-10 text-neutral-600 mb-3" />
              <p className="text-sm font-semibold text-neutral-300">Aucune diffusion enregistrée</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Créez une diffusion pour la programmer ou la diffuser en direct.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateModal();
                }}
                className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Créer une diffusion</span>
              </button>
            </div>
          ) : (
            diffusions.map((diffusion) => {
              const isDeleting = deleteConfirmId === diffusion.id;
              const upcomingInfo = getUpcomingInfo(diffusion.date, diffusion.dateValue);
              return (
                <div
                  key={diffusion.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                    diffusion.isFeatured
                      ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                      : 'border-white/5 bg-white/[0.03] hover:border-white/10'
                  }`}
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black border border-white/10">
                      <img
                        src={diffusion.coverUrl}
                        alt={diffusion.title}
                        className="h-full w-full object-cover"
                      />
                      {diffusion.isLive && (
                        <span className="absolute top-1 left-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                          Live
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-emerald-400">
                          {diffusion.competition}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {diffusion.time}
                        </span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-neutral-500" />
                          {diffusion.date}
                        </span>
                        {upcomingInfo?.isUpcoming && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <Calendar className="h-2.5 w-2.5" />
                            Dans {upcomingInfo.daysUntil}j
                          </span>
                        )}
                        {diffusion.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <Star className="h-2.5 w-2.5 fill-current" />
                            À la une
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white truncate mt-0.5">
                        {diffusion.title}
                      </h4>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* Feature button */}
                    <button
                      type="button"
                      disabled={loadingId === diffusion.id}
                      onClick={() => handleFeatureClick(diffusion.id)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                        diffusion.isFeatured
                          ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                          : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30'
                      }`}
                      title="Mettre en grand à la une sur le site"
                    >
                      <Star className={`h-3.5 w-3.5 ${diffusion.isFeatured ? 'fill-current' : ''}`} />
                      <span>{diffusion.isFeatured ? 'À la une' : 'Mettre à la une'}</span>
                    </button>

                    {/* Delete button or confirmation */}
                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-500/40 rounded-xl p-1">
                        <button
                          type="button"
                          disabled={loadingId === diffusion.id}
                          onClick={() => handleDeleteClick(diffusion.id)}
                          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded-lg px-2 py-1 text-xs text-neutral-400 hover:text-white"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(diffusion.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Supprimer la diffusion"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-[#12141a] px-6 py-3.5">
          <button
            onClick={() => {
              onClose();
              onOpenCreateModal();
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-black hover:bg-emerald-400 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Créer une nouvelle diffusion</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
};
