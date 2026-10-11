import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Check, X, AlertTriangle } from 'lucide-react';

interface ChatRulesModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

export const ChatRulesModal: React.FC<ChatRulesModalProps> = ({
  isOpen,
  onAccept,
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
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] p-6 text-center shadow-2xl"
      >
        {/* Header Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <h3 className="text-lg font-bold text-white mb-1.5">
          Règles du chat Nova Foot
        </h3>
        <p className="text-xs text-neutral-400 mb-5 leading-relaxed">
          Pour maintenir une ambiance saine et agréable pour tous les supporters, veuillez respecter nos règles obligatoires :
        </p>

        {/* Rules Box */}
        <div className="space-y-2.5 rounded-2xl bg-black/50 p-4 text-left border border-white/5 mb-6 text-xs text-neutral-300">
          <div className="flex items-start gap-2.5">
            <span className="text-red-400 font-bold shrink-0">✕</span>
            <span>
              <strong className="text-white">Pas d'insultes ni de provocations</strong> : Respect mutuel envers tous les supporters et les équipes.
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-red-400 font-bold shrink-0">✕</span>
            <span>
              <strong className="text-white">Pas de spoil</strong> : Interdiction de révéler les scores d'autres matchs en cours.
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-red-400 font-bold shrink-0">✕</span>
            <span>
              <strong className="text-white">Pas de spam ni de pubs</strong> : Tout lien externe ou spam est strictement banni.
            </span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-amber-300 text-[11px]">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>Attention :</strong> Tout non-respect de ces consignes entraînera un bannissement immédiat et irréversible du chat par le STAFF.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onAccept}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-black hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
          >
            <Check className="h-4 w-4" />
            <span>J'ai compris et j'accepte les règles</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
};
