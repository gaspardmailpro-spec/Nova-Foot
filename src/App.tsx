import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Radio,
  Trophy,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tv,
  Plus,
  ScreenShare
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { MatchCard } from './components/MatchCard';
import { DiscordVipModal } from './components/DiscordVipModal';
import { AdminCodeModal } from './components/AdminCodeModal';
import { CreateDiffusionModal } from './components/CreateDiffusionModal';
import { ManageDiffusionsModal } from './components/ManageDiffusionsModal';
import { LivePlayer } from './components/LivePlayer';
import { DiscordSecurityGate } from './components/DiscordSecurityGate';
import { Diffusion } from './types';
import { socket } from './services/socket';
import { getUpcomingInfo } from './utils/dateUtils';

const CATEGORIES: { label: string; value: string }[] = [
  { label: 'Tous les matchs', value: 'Tous' },
  { label: 'Champions League', value: 'Champions League' },
  { label: 'Ligue 1', value: 'Ligue 1' },
  { label: 'Ligue 2', value: 'Ligue 2' },
  { label: 'La Liga', value: 'La Liga' },
  { label: 'Premier League', value: 'Premier League' },
  { label: 'Serie A', value: 'Serie A' },
  { label: 'Bundesliga', value: 'Bundesliga' },
];

export default function App() {
  const [diffusions, setDiffusions] = useState<Diffusion[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('nova_admin_auth') === 'true';
  });

  // Discord Security Authentication check
  const [isDiscordAuth, setIsDiscordAuth] = useState<boolean>(() => {
    return localStorage.getItem('nova_discord_auth') === 'true';
  });

  const [discordUserName, setDiscordUserName] = useState<string>(() => {
    return localStorage.getItem('nova_user_name') || 'Supporter';
  });

  const [discordUserAvatar, setDiscordUserAvatar] = useState<string | null>(() => {
    return localStorage.getItem('nova_discord_avatar') || null;
  });

  // Handle URL callback if redirected directly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord_auth') === '1') {
      const userStr = params.get('user');
      let userName = 'Supporter';
      let avatar: string | null = null;
      if (userStr) {
        try {
          const u = JSON.parse(decodeURIComponent(userStr));
          userName = u.global_name || u.username || 'Supporter';
          if (u.avatar) avatar = u.avatar;
          localStorage.setItem('nova_user_name', userName);
          if (avatar) localStorage.setItem('nova_discord_avatar', avatar);
        } catch (e) {}
      }
      localStorage.setItem('nova_discord_auth', 'true');
      setIsDiscordAuth(true);
      setDiscordUserName(userName);
      setDiscordUserAvatar(avatar);
      showToast(`Bienvenue ${userName} !`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Navigation & Modals state
  const [activeStreamDiffusion, setActiveStreamDiffusion] = useState<Diffusion | null>(null);
  const [discordModalDiffusion, setDiscordModalDiffusion] = useState<Diffusion | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [adminToast, setAdminToast] = useState<string | null>(null);

  // Fetch diffusions from backend
  const fetchDiffusions = async () => {
    try {
      const res = await fetch('/api/diffusions');
      const data = await res.json();
      if (data.success && data.diffusions) {
        const unique = Array.from(new Map<string, Diffusion>(data.diffusions.map((d: Diffusion) => [d.id, d])).values());
        setDiffusions(unique);
      }
    } catch (err) {
      console.error('Failed to fetch diffusions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiffusions();

    // Socket broadcasts for real-time list updates
    const onDiffusionAdded = (data: { diffusion: Diffusion }) => {
      setDiffusions((prev) => {
        if (prev.some((d) => d.id === data.diffusion.id)) return prev;
        return [data.diffusion, ...prev.filter(d => d.id !== data.diffusion.id)];
      });
    };

    const onDiffusionDeleted = (data: { diffusionId: string }) => {
      setDiffusions((prev) => prev.filter((d) => d.id !== data.diffusionId));
    };

    const onDiffusionFeatured = (data: { featuredId: string }) => {
      setDiffusions((prev) =>
        prev.map((d) => ({
          ...d,
          isFeatured: d.id === data.featuredId
        }))
      );
    };

    const onBroadcastStarted = (data: any) => {
      setDiffusions((prev) =>
        prev.map((d) =>
          d.id === data.broadcast?.streamId ? { ...d, isLive: true, statusText: 'EN DIRECT' } : d
        )
      );
    };

    const onBroadcastStopped = (data: any) => {
      setDiffusions((prev) =>
        prev.map((d) =>
          d.id === data.streamId ? { ...d, isLive: false, statusText: 'PROGRAMMÉ', currentOverlay: 'normal' } : d
        )
      );
    };

    socket.on('diffusion-added', onDiffusionAdded);
    socket.on('diffusion-deleted', onDiffusionDeleted);
    socket.on('diffusion-featured', onDiffusionFeatured);
    socket.on('broadcast-started', onBroadcastStarted);
    socket.on('broadcast-stopped', onBroadcastStopped);

    if (isAdmin) {
      socket.send('admin-auth', { code: 'NOVA498632' });
    }

    return () => {
      socket.off('diffusion-added', onDiffusionAdded);
      socket.off('diffusion-deleted', onDiffusionDeleted);
      socket.off('diffusion-featured', onDiffusionFeatured);
      socket.off('broadcast-started', onBroadcastStarted);
      socket.off('broadcast-stopped', onBroadcastStopped);
    };
  }, [isAdmin]);

  // Handle Admin Login Success
  const handleAdminSuccess = () => {
    setIsAdmin(true);
    localStorage.setItem('nova_admin_auth', 'true');
    socket.send('admin-auth', { code: 'NOVA498632' });
    showToast('Session administrateur activée');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('nova_admin_auth');
    showToast('Déconnecté de la session admin');
  };

  // Handle Discord Disconnect / Logout to retest
  const handleDiscordLogout = () => {
    setIsDiscordAuth(false);
    setDiscordUserName('');
    setDiscordUserAvatar(null);
    localStorage.removeItem('nova_discord_auth');
    localStorage.removeItem('nova_user_name');
    localStorage.removeItem('nova_discord_avatar');
    showToast('Déconnecté de Discord. Vous pouvez retester la connexion !');
  };

  const showToast = (msg: string) => {
    setAdminToast(msg);
    setTimeout(() => {
      setAdminToast(null);
    }, 3000);
  };

  // Match Click Handler:
  // Si admin -> ouvre directement le match avec le bouton "Lancer le live"
  // Si visiteur -> affiche le pop up Discord
  const handleMatchClick = (diffusion: Diffusion) => {
    if (isAdmin) {
      setActiveStreamDiffusion(diffusion);
    } else {
      setDiscordModalDiffusion(diffusion);
    }
  };

  // Launch stream player from visitor modal
  const handleProceedToStream = (diffusion: Diffusion) => {
    setActiveStreamDiffusion(diffusion);
  };

  // Admin delete match without window.confirm
  const handleDeleteMatch = async (id: string) => {
    try {
      await fetch(`/api/diffusions/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-code': 'NOVA498632' }
      });
      setDiffusions((prev) => prev.filter((d) => d.id !== id));
      if (activeStreamDiffusion?.id === id) {
        setActiveStreamDiffusion(null);
      }
      showToast('Diffusion supprimée');
    } catch (e) {
      console.error(e);
    }
  };

  // Admin feature match (Mettre à la une)
  const handleFeatureMatch = async (id: string) => {
    try {
      await fetch(`/api/diffusions/${id}/feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-code': 'NOVA498632'
        }
      });
      setDiffusions((prev) =>
        prev.map((d) => ({
          ...d,
          isFeatured: d.id === id
        }))
      );
      showToast('Diffusion mise à la une sur le site');
    } catch (e) {
      console.error(e);
    }
  };

  // Ensure unique diffusions by ID
  const uniqueDiffusions = Array.from(new Map(diffusions.map((d) => [d.id, d])).values());

  // Filtered diffusions
  const filteredDiffusions = uniqueDiffusions.filter((d) => {
    if (selectedCategory === 'Tous') return true;
    return d.competition.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const liveDiffusions = uniqueDiffusions.filter((d) => d.isLive);
  const featuredMatch =
    uniqueDiffusions.find((d) => d.isFeatured) ||
    (liveDiffusions.length > 0 ? liveDiffusions[0] : (uniqueDiffusions.length > 0 ? uniqueDiffusions[0] : null));
  const featuredUpcoming = featuredMatch ? getUpcomingInfo(featuredMatch.date, featuredMatch.dateValue) : null;

  return (
    <div className="relative min-h-screen bg-[#050608] text-white selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Toast Notification */}
      <AnimatePresence>
        {adminToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-[#0e1612] px-4 py-3 text-xs font-semibold text-emerald-400 shadow-2xl backdrop-blur-xl"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{adminToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discord Security Gate - Floute le site tant que non connecté */}
      {!isDiscordAuth && (
        <DiscordSecurityGate
          onAuthenticated={(user) => {
            setIsDiscordAuth(true);
            const name = user.global_name || user.username || 'Supporter';
            setDiscordUserName(name);
            setDiscordUserAvatar(user.avatar || null);
            showToast(`Bienvenue ${name} !`);
          }}
        />
      )}

      {/* Main Content wrapper - blurred when not authenticated with Discord */}
      <div className={`transition-all duration-700 ${!isDiscordAuth ? 'filter blur-2xl pointer-events-none select-none max-h-screen overflow-hidden' : ''}`}>
        {/* Global iOS Navbar */}
        <Navbar
          isAdmin={isAdmin}
          onOpenCodeModal={() => setIsCodeModalOpen(true)}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenManageModal={() => setIsManageModalOpen(true)}
          onAdminLogout={handleAdminLogout}
          isAnyLive={liveDiffusions.length > 0}
          onGoHome={() => setActiveStreamDiffusion(null)}
          isDiscordAuth={isDiscordAuth}
          discordUserName={discordUserName}
          discordUserAvatar={discordUserAvatar}
          onDiscordLogout={handleDiscordLogout}
        />

        {/* If Active Stream is selected, display Live Player */}
        {activeStreamDiffusion ? (
          <LivePlayer
            diffusion={activeStreamDiffusion}
            isAdmin={isAdmin}
            discordUserName={discordUserName}
            onBack={() => setActiveStreamDiffusion(null)}
            onOpenDiscordVip={() => setDiscordModalDiffusion(activeStreamDiffusion)}
          />
        ) : (
          /* Home Feed View */
          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {/* Spotlight Hero Banner (Featured / Live Match if any exists) */}
            {featuredMatch && (
              <section className="mb-10">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => handleMatchClick(featuredMatch)}
                  className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] shadow-2xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)]"
                >
                  <div className="relative aspect-[21/9] sm:aspect-[24/9] w-full min-h-[220px] overflow-hidden bg-neutral-950">
                    <img
                      src={featuredMatch.coverUrl}
                      alt={featuredMatch.title}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d12] via-black/50 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d12]/90 via-[#0c0d12]/40 to-transparent" />

                    <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 md:p-10">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-2 sm:mb-3">
                          {featuredMatch.isLive ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                              </span>
                              EN DIRECT MAINTENANT
                            </span>
                          ) : featuredUpcoming?.isUpcoming ? (
                            <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1 text-xs font-black text-black shadow-lg backdrop-blur-md border border-amber-300">
                              <Calendar className="h-3.5 w-3.5 fill-black/20" />
                              MATCH À VENIR DANS {featuredUpcoming.daysUntil} {featuredUpcoming.daysUntil === 1 ? 'JOUR' : 'JOURS'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-md">
                              <Calendar className="h-3.5 w-3.5" />
                              À L'AFFICHE AUJOURD'HUI
                            </span>
                          )}
                          <span className="text-xs font-medium text-neutral-300">
                            {featuredMatch.competition}
                          </span>
                        </div>

                        <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                          {featuredMatch.title}
                        </h1>

                        <p className="mt-2 text-xs sm:text-sm text-neutral-300 line-clamp-2 max-w-xl">
                          {featuredMatch.description || 'Diffusion optimisée haute fluidité 60fps sur Nova Foot.'}
                        </p>

                        <div className="mt-4 sm:mt-6 flex items-center gap-3">
                          <button
                            type="button"
                            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95"
                          >
                            <Tv className="h-4 w-4" />
                            <span>{isAdmin ? 'Lancer le live' : (featuredMatch.isLive ? 'Rejoindre le Live' : 'Regarder la diffusion')}</span>
                            <ChevronRight className="h-4 w-4 ml-0.5" />
                          </button>

                          <span className="text-xs font-semibold text-neutral-400">
                            {featuredUpcoming?.isUpcoming
                              ? `Coup d'envoi dans ${featuredUpcoming.daysUntil}j à ${featuredMatch.time}`
                              : `Coup d'envoi à ${featuredMatch.time}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </section>
            )}

            {/* Section Header: Diffusions et matchs programmés */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                    Diffusions & Matchs programmés
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Accédez aux flux en direct et découvrez les prochains matchs à venir
                </p>
              </div>

              {/* Bouton Discord Officiel demandé par l'utilisateur */}
              <a
                href="https://discord.gg/fKWtyTyNry"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 px-3.5 py-2 text-xs font-semibold text-[#8b95ff] transition-all hover:bg-[#5865F2]/20 hover:border-[#5865F2]/50"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 127.14 96.36">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
                </svg>
                <span>Discord officiel</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Interactive Competition Filter Tabs */}
            <div className="mb-8 flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                        : 'border border-white/5 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Grid of Matches (Landscape Format) or Clean Empty State */}
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
            ) : filteredDiffusions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-[#0a0c10] text-center p-8 sm:p-12">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-neutral-400">
                  <Trophy className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                  Aucune diffusion programmée pour aujourd'hui
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mb-6">
                  {isAdmin
                    ? 'Vous êtes connecté en tant qu\'administrateur. Créez votre première diffusion pour lancer le direct et partager votre écran.'
                    : 'Les prochains matchs seront annoncés sur notre serveur Discord officiel.'}
                </p>

                {isAdmin ? (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Créer une diffusion</span>
                  </button>
                ) : (
                  <a
                    href="https://discord.gg/fKWtyTyNry"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <span>Rejoindre le Discord pour les alertes</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDiffusions.map((diffusion, index) => (
                  <MatchCard
                    key={`${diffusion.id}-${index}`}
                    diffusion={diffusion}
                    onClick={() => handleMatchClick(diffusion)}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
          </main>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-white/5 bg-[#050608] py-8 text-center text-xs text-neutral-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img
                src="https://i.postimg.cc/G3DmvQw1/novafoot.webp"
                alt="Nova Foot"
                className="h-6 w-6 object-contain"
              />
              <span className="font-bold text-white tracking-tight">NOVA FOOT</span>
              <span>· Tous droits réservés</span>
            </div>
            <div className="flex items-center gap-4 text-neutral-400">
              <a
                href="https://discord.gg/fKWtyTyNry"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-emerald-400 transition-colors"
              >
                Discord officiel
              </a>
              <span>·</span>
              <span>Flux 60FPS Low-Latency</span>
            </div>
          </div>
        </footer>
      </div>

      {/* Popups & Modals */}
      {/* 1. Discord VIP Modal (Triggered on match click for normal visitors) */}
      <DiscordVipModal
        isOpen={!!discordModalDiffusion}
        diffusion={discordModalDiffusion}
        onClose={() => setDiscordModalDiffusion(null)}
        onProceedToStream={handleProceedToStream}
      />

      {/* 2. Admin Code Modal ("J'ai un code") - Aucune description comme demandé */}
      <AdminCodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onSuccess={handleAdminSuccess}
      />

      {/* 3. Create Diffusion Modal (Admin only, supports image link or upload) */}
      <CreateDiffusionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newDiff) => {
          setDiffusions((prev) => {
            if (prev.some((d) => d.id === newDiff.id)) return prev;
            return [newDiff, ...prev];
          });
          showToast('Diffusion créée avec succès');
        }}
      />

      {/* 4. Manage Diffusions Modal (Admin only: Supprimer, Mettre à la une) */}
      <ManageDiffusionsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        diffusions={uniqueDiffusions}
        onFeature={handleFeatureMatch}
        onDelete={handleDeleteMatch}
        onOpenCreateModal={() => {
          setIsManageModalOpen(false);
          setIsCreateModalOpen(true);
        }}
      />
    </div>
  );
}
