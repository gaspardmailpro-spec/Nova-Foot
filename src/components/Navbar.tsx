import React from 'react';
import { Plus, KeyRound, LogOut, Radio, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  isAdmin: boolean;
  onOpenCodeModal: () => void;
  onOpenCreateModal: () => void;
  onOpenManageModal?: () => void;
  onAdminLogout: () => void;
  isAnyLive: boolean;
  onGoHome: () => void;
  isDiscordAuth?: boolean;
  discordUserName?: string;
  discordUserAvatar?: string | null;
  onDiscordLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdmin,
  onOpenCodeModal,
  onOpenCreateModal,
  onOpenManageModal,
  onAdminLogout,
  isAnyLive,
  onGoHome,
  isDiscordAuth,
  discordUserName,
  discordUserAvatar,
  onDiscordLogout
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/8 bg-[#050608]/80 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Name */}
        <div 
          onClick={onGoHome}
          className="group flex cursor-pointer items-center gap-3 select-none"
        >
          <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-transform duration-300 group-hover:scale-105 group-hover:border-emerald-500/40">
            <img 
              src="https://i.postimg.cc/G3DmvQw1/novafoot.webp" 
              alt="Nova Foot Logo" 
              className="h-8 w-8 object-contain transition-transform duration-300 group-hover:scale-110"
              onError={(e) => {
                // fallback if image blocked
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white transition-colors group-hover:text-emerald-400">
              NOVA <span className="text-emerald-400 font-extrabold">FOOT</span>
            </span>
            <span className="text-[11px] font-medium text-neutral-400 -mt-0.5">
              Direct Streaming HD 60FPS
            </span>
          </div>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Discord Session Info & Logout button */}
          {isDiscordAuth && onDiscordLogout && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* User badge */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 px-2.5 py-1.5 text-xs text-neutral-200">
                {discordUserAvatar ? (
                  <img
                    src={discordUserAvatar}
                    alt={discordUserName || 'Discord User'}
                    className="h-4 w-4 rounded-full object-cover border border-[#5865F2]"
                  />
                ) : (
                  <svg className="h-3.5 w-3.5 fill-[#5865F2]" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                )}
                <span className="font-medium text-white max-w-[110px] truncate">
                  {discordUserName || 'Discord'}
                </span>
              </div>

              {/* Explicit Se Déconnecter Button */}
              <button
                onClick={onDiscordLogout}
                title="Se déconnecter pour retester la connexion Discord"
                className="group flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/10 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/20 hover:text-white active:scale-95 shadow-sm"
              >
                <LogOut className="h-3.5 w-3.5 text-red-400 group-hover:rotate-12 transition-transform" />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}

          {isAdmin ? (
            <div className="flex items-center gap-2">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-400"
              >
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                <span>Admin</span>
              </motion.div>

              {onOpenManageModal && (
                <button
                  onClick={onOpenManageModal}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold text-neutral-200 transition-all hover:bg-white/10 hover:border-emerald-500/40 hover:text-white active:scale-95"
                  title="Gérer, supprimer ou mettre à la une des diffusions"
                >
                  <LayoutGrid className="h-4 w-4 text-emerald-400" />
                  <span className="hidden sm:inline">Gérer les diffusions</span>
                  <span className="sm:hidden">Gérer</span>
                </button>
              )}

              <button
                onClick={onOpenCreateModal}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Créer une diffusion</span>
                <span className="sm:hidden">Créer</span>
              </button>

              <button
                onClick={onAdminLogout}
                title="Quitter le mode admin"
                className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400 transition-colors hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
              >
                <span className="text-[11px] font-bold text-amber-400">Admin✕</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenCodeModal}
              className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium text-neutral-200 backdrop-blur-md transition-all hover:border-emerald-500/40 hover:bg-white/10 hover:text-white active:scale-95"
            >
              <KeyRound className="h-4 w-4 text-emerald-400 transition-transform group-hover:rotate-12" />
              <span>J'ai un code</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
