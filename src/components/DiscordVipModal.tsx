import React from 'react';
import { X, ExternalLink, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Diffusion } from '../types';

interface DiscordVipModalProps {
  isOpen: boolean;
  diffusion: Diffusion | null;
  onClose: () => void;
  onProceedToStream: (diffusion: Diffusion) => void;
}

export const DiscordVipModal: React.FC<DiscordVipModalProps> = ({
  isOpen,
  diffusion,
  onClose,
  onProceedToStream
}) => {
  if (!isOpen || !diffusion) return null;

  const discordUrl = 'https://discord.gg/fKWtyTyNry';

  const handleJoinDiscord = () => {
    window.open(discordUrl, '_blank', 'noopener,noreferrer');
  };

  const handleWatchNow = () => {
    onProceedToStream(diffusion);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window Container */}
        <div className="relative w-full max-w-md">
          {/* Petite croix au-dessus du pop up */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="group flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900/90 border border-white/10 text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white hover:scale-105 active:scale-95 shadow-lg"
            >
              <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
            className="overflow-hidden rounded-2xl border border-white/10 bg-[#0e1015] p-6 shadow-2xl"
          >
            {/* Match Preview banner */}
            <div className="relative mb-5 overflow-hidden rounded-xl border border-white/10 aspect-video">
              <img
                src={diffusion.coverUrl}
                alt={diffusion.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-400">
                    {diffusion.competition}
                  </span>
                  <h4 className="text-sm font-bold text-white line-clamp-1">
                    {diffusion.title}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-300 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                  {diffusion.time}
                </span>
              </div>
            </div>

            {/* Prompt text requested by user */}
            <div className="text-center mb-6">
              <p className="text-base font-medium leading-relaxed text-neutral-200">
                Rejoins le serveur discord, discute avec la communauté et achète ton vip pour accéder aux autres championnats européens.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {/* Bouton bleu avec logo de Discord et écrit Rejoindre */}
              <button
                onClick={handleJoinDiscord}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#5865F2] px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#4752c4] hover:shadow-[0_0_24px_rgba(88,101,242,0.4)] active:scale-95"
              >
                {/* SVG Discord Logo */}
                <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                <span>Rejoindre</span>
                <ExternalLink className="h-4 w-4 opacity-70" />
              </button>

              {/* Bouton pour accéder au flux du match */}
              <button
                onClick={handleWatchNow}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
              >
                <Play className="h-4 w-4 fill-emerald-400" />
                <span>Accéder à la diffusion</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
