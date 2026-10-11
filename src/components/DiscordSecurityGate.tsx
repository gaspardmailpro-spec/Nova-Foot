import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  ShieldCheck,
  Loader2
} from 'lucide-react';

interface DiscordUser {
  id: string;
  username: string;
  global_name: string;
  avatar?: string;
  email?: string;
}

interface DiscordSecurityGateProps {
  onAuthenticated: (discordUser: DiscordUser) => void;
}

export const DiscordSecurityGate: React.FC<DiscordSecurityGateProps> = ({
  onAuthenticated
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [connectedUser, setConnectedUser] = useState<DiscordUser | null>(null);

  const discordInviteUrl = 'https://discord.gg/fKWtyTyNry';

  const getActiveRedirectUri = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth/discord/callback`;
    }
    return 'https://ais-pre-7obb722sbh257syicn4hhs-915138611013.europe-west2.run.app/api/auth/discord/callback';
  };

  // Listen for Discord OAuth popup postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DISCORD_OAUTH_SUCCESS' && event.data.user) {
        const user: DiscordUser = event.data.user;
        completeLogin(user);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthenticated]);

  const completeLogin = (user: DiscordUser) => {
    setConnectedUser(user);
    setIsSuccess(true);
    setIsConnecting(false);

    localStorage.setItem('nova_discord_auth', 'true');
    localStorage.setItem('nova_user_name', user.global_name || user.username);
    if (user.avatar) {
      localStorage.setItem('nova_discord_avatar', user.avatar);
    }

    setTimeout(() => {
      onAuthenticated(user);
    }, 800);
  };

  const handleStartDiscordOAuth = async () => {
    setIsConnecting(true);

    try {
      const activeUri = getActiveRedirectUri();
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch(`/api/auth/discord/url?redirect_uri=${encodeURIComponent(activeUri)}&return_origin=${encodeURIComponent(currentOrigin)}`);
      const data = await res.json();

      if (data.configured && data.url) {
        const width = 500;
        const height = 750;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        let popup: Window | null = null;
        try {
          popup = window.open(
            data.url,
            'DiscordOAuth',
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
          );
        } catch (e) {
          popup = null;
        }

        // If popup was blocked (common in iframe/mobile), redirect directly
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          window.location.href = data.url;
          return;
        }

        // Check if popup closed by user
        const checkClosedTimer = setInterval(() => {
          if (popup && popup.closed) {
            clearInterval(checkClosedTimer);
            setIsConnecting(false);
          }
        }, 1000);
      } else {
        setIsConnecting(false);
      }
    } catch (err) {
      console.error('Failed to get Discord auth URL:', err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Heavy Backdrop Blur for background site */}
      <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl transition-all" />

      {/* Security Gate Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0c0d12] p-6 sm:p-8 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]"
      >
        {/* Glowing Ambient Top Effect */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[#5865F2]/25 blur-3xl" />

        {/* Logo Nova Foot & Security Badge */}
        <div className="relative mb-5 flex justify-center">
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#141620] border border-white/10 p-2 shadow-xl shadow-black/60">
              <img
                src="https://i.postimg.cc/G3DmvQw1/novafoot.webp"
                alt="Nova Foot"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Titre Principal */}
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-3">
          NOVA FOOT renforce sa sécurité.
        </h2>

        {/* Description demandée exactement par l'utilisateur */}
        <p className="text-xs sm:text-sm font-medium leading-relaxed text-neutral-300 mb-6">
          Pour accéder au site connecte toi à ton compte discord. Cela permet de renforcer la sécurité de notre site et de le garder en état sure.
        </p>

        {/* Feedback Succès */}
        {isSuccess && connectedUser && (
          <div className="mb-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <p className="font-bold flex items-center justify-center gap-1.5">
              <Check className="h-4 w-4" />
              <span>Connecté en tant que {connectedUser.global_name}</span>
            </p>
            <p className="text-[11px] text-neutral-400 mt-1">Accès sécurisé déverrouillé, chargement du live...</p>
          </div>
        )}

        {/* Bouton principal : Se connecter avec discord */}
        {!isSuccess && (
          <div className="mb-4">
            <button
              onClick={handleStartDiscordOAuth}
              disabled={isConnecting}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] px-5 py-3.5 text-sm font-bold text-white shadow-[0_0_25px_rgba(88,101,242,0.35)] transition-all hover:bg-[#4752c4] hover:shadow-[0_0_35px_rgba(88,101,242,0.5)] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Connexion à l'API Discord...</span>
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                  <span>Se connecter avec Discord</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Bouton type texte sans encadrement comme demandé : Rejoindre le serveur discord */}
        <div className="pt-2">
          <a
            href={discordInviteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-medium text-neutral-400 hover:text-white transition-colors duration-200 underline-offset-4 hover:underline"
          >
            Rejoindre le serveur discord
          </a>
        </div>
      </motion.div>
    </div>
  );
};
