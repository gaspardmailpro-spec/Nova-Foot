import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  Send,
  Users,
  ScreenShare,
  StopCircle,
  Sparkles,
  ArrowLeft,
  Settings,
  MessageSquare,
  Shield,
  Smile,
  ExternalLink,
  AlertTriangle,
  Clock,
  PauseCircle,
  Trash2,
  Ban,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Diffusion, ChatMessage, StreamOverlay } from '../types';
import { socket } from '../services/socket';
import { broadcaster, viewer } from '../services/webrtc';
import { ChatRulesModal } from './ChatRulesModal';
import { StopShareConfirmModal } from './StopShareConfirmModal';

interface LivePlayerProps {
  diffusion: Diffusion;
  isAdmin: boolean;
  onBack: () => void;
  onOpenDiscordVip: () => void;
  discordUserName?: string;
}

const CountdownDisplay: React.FC<{ timeStr: string }> = ({ timeStr }) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number; isImminent: boolean }>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isImminent: false
  });

  useEffect(() => {
    const updateCountdown = () => {
      try {
        const parts = timeStr.split(':');
        if (parts.length >= 2) {
          const now = new Date();
          const target = new Date();
          target.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);

          const diff = target.getTime() - now.getTime();
          if (diff <= 0) {
            setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isImminent: true });
            return;
          }

          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeLeft({ hours, minutes, seconds, isImminent: false });
        }
      } catch (e) {}
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeStr]);

  if (timeLeft.isImminent) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 px-5 py-2.5 text-sm font-bold text-emerald-400 animate-pulse">
        <span>⏱️ Coup d'envoi imminent !</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 sm:gap-3">
      {timeLeft.hours > 0 && (
        <div className="flex flex-col items-center rounded-2xl bg-black/70 border border-white/10 px-3 sm:px-4 py-2 min-w-[50px] sm:min-w-[58px] shadow-lg">
          <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
            {String(timeLeft.hours).padStart(2, '0')}
          </span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400">Heures</span>
        </div>
      )}
      <div className="flex flex-col items-center rounded-2xl bg-black/70 border border-white/10 px-3 sm:px-4 py-2 min-w-[50px] sm:min-w-[58px] shadow-lg">
        <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400">
          {String(timeLeft.minutes).padStart(2, '0')}
        </span>
        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400">Minutes</span>
      </div>
      <div className="flex flex-col items-center rounded-2xl bg-black/70 border border-white/10 px-3 sm:px-4 py-2 min-w-[50px] sm:min-w-[58px] shadow-lg">
        <span className="font-mono text-xl sm:text-2xl font-black text-white">
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
        <span className="text-[9px] sm:text-[10px] uppercase font-bold text-neutral-400">Secondes</span>
      </div>
    </div>
  );
};

export const LivePlayer: React.FC<LivePlayerProps> = ({
  diffusion,
  isAdmin,
  onBack,
  onOpenDiscordVip,
  discordUserName
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Stream & Overlay states
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const isBroadcastingRef = useRef(false);
  useEffect(() => {
    isBroadcastingRef.current = isBroadcasting;
  }, [isBroadcasting]);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'live' | 'fallback'>('idle');
  const [currentOverlay, setCurrentOverlay] = useState<StreamOverlay>(diffusion.currentOverlay || 'normal');
  const [isSharedByOtherAdmin, setIsSharedByOtherAdmin] = useState<boolean>(false);
  const [viewerCount, setViewerCount] = useState(diffusion.viewersCount || 1);
  const [fallbackFrame, setFallbackFrame] = useState<string | null>(null);
  const [qualityPreset, setQualityPreset] = useState<'1080p' | '720p'>('1080p');
  const [shareError, setShareError] = useState<string | null>(null);

  // Video playback controls
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  // Modals
  const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);
  const [isChatRulesModalOpen, setIsChatRulesModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isBannedFromChat, setIsBannedFromChat] = useState(false);

  // Chat state
  const getInitialUserName = () => {
    const saved = discordUserName || (typeof window !== 'undefined' ? localStorage.getItem('nova_user_name') : null);
    if (saved && saved.trim()) return saved.trim();
    return `Supporter_${Math.floor(100 + Math.random() * 900)}`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [userName, setUserName] = useState<string>(getInitialUserName);
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    const saved = discordUserName || localStorage.getItem('nova_user_name');
    if (saved && saved.trim()) {
      setUserName(saved.trim());
    }
  }, [discordUserName]);

  // Auto scroll chat
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load initial messages
  useEffect(() => {
    fetch(`/api/chat/${diffusion.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch(() => {});
  }, [diffusion.id]);

  // WebSocket listeners
  useEffect(() => {
    socket.send('join-room', { streamId: diffusion.id });

    const onChatMessage = (data: { message: ChatMessage }) => {
      setMessages((prev) => [...prev, data.message]);
    };

    const onChatMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    const onUserBanned = (data: { username: string }) => {
      setMessages((prev) => prev.filter((m) => m.user !== data.username));
      if (data.username === userName) {
        setIsBannedFromChat(true);
      }
    };

    const onViewerCount = (data: { streamId: string; count: number }) => {
      if (data.streamId === diffusion.id) {
        setViewerCount(Math.max(1, data.count));
      }
    };

    const onBroadcastStarted = (data: any) => {
      if (data.broadcast?.streamId === diffusion.id) {
        if (!isBroadcastingRef.current) {
          setStreamStatus('connecting');
          socket.send('join-room', { streamId: diffusion.id });
        }
      }
    };

    const onRoomJoined = (data: any) => {
      if (typeof data.viewerCount === 'number') {
        setViewerCount(Math.max(1, data.viewerCount));
      }
      if (data.currentOverlay) {
        setCurrentOverlay(data.currentOverlay);
      }
      if (typeof data.isSharedByAnotherAdmin === 'boolean') {
        setIsSharedByOtherAdmin(data.isSharedByAnotherAdmin);
      }
      if (data.isBroadcastActive) {
        if (isBroadcastingRef.current) {
          setStreamStatus('live');
          return;
        }
        setStreamStatus((prev) => (prev === 'live' ? 'live' : 'connecting'));
      }
    };

    const onOverlayChanged = (data: { streamId: string; overlay: StreamOverlay }) => {
      if (data.streamId === diffusion.id) {
        setCurrentOverlay(data.overlay);
      }
    };

    const onBroadcastInProgress = (data: { streamId: string; message: string }) => {
      if (data.streamId === diffusion.id) {
        setIsSharedByOtherAdmin(true);
        setShareError(data.message || "Un admin s'occupe déjà de la diffusion.");
      }
    };

    const onBroadcastStopped = (data: any) => {
      if (data.streamId === diffusion.id) {
        if (isBroadcastingRef.current) {
          return;
        }
        setIsBroadcasting(false);
        setStreamStatus('idle');
        setFallbackFrame(null);
        setIsSharedByOtherAdmin(false);
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    };

    socket.on('new-chat-message', onChatMessage);
    socket.on('chat-message-deleted', onChatMessageDeleted);
    socket.on('user-banned', onUserBanned);
    socket.on('viewer-count-updated', onViewerCount);
    socket.on('broadcast-started', onBroadcastStarted);
    socket.on('room-joined', onRoomJoined);
    socket.on('overlay-state-changed', onOverlayChanged);
    socket.on('broadcast-in-progress', onBroadcastInProgress);
    socket.on('broadcast-stopped', onBroadcastStopped);

    if (!isBroadcastingRef.current) {
      viewer.joinStream(
        diffusion.id,
        (stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
            setStreamStatus('live');
          }
        },
        (frameUrl) => {
          setFallbackFrame((prev) => (prev === frameUrl ? prev : frameUrl));
        },
        (status) => {
          if (status === 'live') setStreamStatus('live');
          if (status === 'stopped' && !isBroadcastingRef.current) {
            setStreamStatus('idle');
            setFallbackFrame(null);
          }
        }
      );
    }

    return () => {
      socket.off('new-chat-message', onChatMessage);
      socket.off('chat-message-deleted', onChatMessageDeleted);
      socket.off('user-banned', onUserBanned);
      socket.off('viewer-count-updated', onViewerCount);
      socket.off('broadcast-started', onBroadcastStarted);
      socket.off('room-joined', onRoomJoined);
      socket.off('overlay-state-changed', onOverlayChanged);
      socket.off('broadcast-in-progress', onBroadcastInProgress);
      socket.off('broadcast-stopped', onBroadcastStopped);
      socket.send('leave-room', { streamId: diffusion.id });
      if (!isBroadcastingRef.current) {
        viewer.disconnect();
      }
    };
  }, [diffusion.id, isAdmin]);

  // Prevent device screen sleep during live match
  useEffect(() => {
    let wakeLockSentinel: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch (e) {}
    };
    requestWakeLock();

    return () => {
      if (wakeLockSentinel) {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, []);

  // Ensure broadcaster video element is never detached while screen sharing
  useEffect(() => {
    if (isBroadcasting) {
      const activeStream = broadcaster.getStream();
      if (activeStream && activeStream.active && videoRef.current) {
        if (videoRef.current.srcObject !== activeStream) {
          videoRef.current.srcObject = activeStream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
        if (streamStatus !== 'live') {
          setStreamStatus('live');
        }
      }
    }
  }, [isBroadcasting, streamStatus]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Admin Overlay Change handler
  const handleChangeOverlay = (newOverlay: StreamOverlay) => {
    setCurrentOverlay(newOverlay);
    socket.send('set-overlay-state', {
      streamId: diffusion.id,
      overlay: newOverlay,
      code: 'NOVA498632'
    });
  };

  // Admin Screen Sharing trigger
  const handleStartShare = async () => {
    if (isSharedByOtherAdmin) {
      setShareError("Un admin s'occupe déjà de la diffusion.");
      return;
    }
    setShareError(null);
    try {
      const stream = await broadcaster.startScreenShare(
        diffusion.id,
        diffusion.title,
        qualityPreset,
        () => {
          setIsBroadcasting(false);
          setStreamStatus('idle');
          if (videoRef.current) videoRef.current.srcObject = null;
        }
      );

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }

      setIsBroadcasting(true);
      setStreamStatus('live');
      handleChangeOverlay('normal');
    } catch (err: any) {
      console.warn('Screen share notice, falling back to test stream:', err);
      handleStartTestStream();
      setShareError('active_fallback');
    }
  };

  const handleStartTestStream = () => {
    setShareError(null);
    const stream = broadcaster.startInteractiveTestStream(
      diffusion.id,
      diffusion.title,
      () => {
        setIsBroadcasting(false);
        setStreamStatus('idle');
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    );

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }

    setIsBroadcasting(true);
    setStreamStatus('live');
    handleChangeOverlay('normal');
  };

  // Admin Stop button clicked -> Open confirmation modal
  const handleRequestStopShare = () => {
    setIsStopConfirmOpen(true);
  };

  // Modal Action 1: Couper le partage et terminer et supprimer la diffusion
  const handleConfirmStopAndDelete = () => {
    broadcaster.stopScreenShare(true);
    setIsBroadcasting(false);
    setStreamStatus('idle');
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStopConfirmOpen(false);
    onBack();
  };

  // Modal Action 2: Non, juste couper le partage
  const handleConfirmJustStop = () => {
    broadcaster.stopScreenShare(false);
    setIsBroadcasting(false);
    setStreamStatus('idle');
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStopConfirmOpen(false);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Sound toggle
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        videoRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  // Chat message submit
  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isBannedFromChat) return;

    // Check if user has accepted the chat rules
    const hasAcceptedRules = localStorage.getItem('nova_chat_rules_accepted') === 'true';
    if (!hasAcceptedRules && !isAdmin) {
      setPendingMessage(chatInput);
      setIsChatRulesModalOpen(true);
      return;
    }

    sendChatMessage(chatInput);
  };

  const sendChatMessage = (text: string) => {
    socket.send('chat-message', {
      diffusionId: diffusion.id,
      text: text,
      user: userName,
      isAdmin: isAdmin,
      adminCode: isAdmin ? 'NOVA498632' : undefined,
      avatarColor: isAdmin ? '#10b981' : '#38bdf8'
    });
    setChatInput('');
    setPendingMessage(null);
  };

  const handleAcceptRules = () => {
    localStorage.setItem('nova_chat_rules_accepted', 'true');
    setIsChatRulesModalOpen(false);
    if (pendingMessage) {
      sendChatMessage(pendingMessage);
    }
  };

  // Admin Chat Moderation actions
  const handleDeleteMessage = (messageId: string) => {
    socket.send('delete-chat-message', {
      messageId,
      diffusionId: diffusion.id,
      code: 'NOVA498632'
    });
  };

  const handleBanUser = (username: string) => {
    socket.send('ban-user', {
      username,
      diffusionId: diffusion.id,
      code: 'NOVA498632'
    });
  };

  // Auto hide controls on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (streamStatus === 'live' && !isBroadcasting && currentOverlay === 'normal') {
        setShowControls(false);
      }
    }, 3500);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#050608]">
      {/* Top Breadcrumb / Return Bar */}
      <div className="border-b border-white/5 bg-[#090b0e] px-4 py-2.5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={onBack}
            className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Retour aux matchs</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-400">
              {diffusion.competition}
            </span>
            <span className="text-neutral-600">·</span>
            <span className="text-xs font-medium text-neutral-300">
              {diffusion.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenDiscordVip}
              className="flex items-center gap-1.5 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/40 px-2.5 py-1 text-xs font-semibold text-[#8b95ff] hover:bg-[#5865F2]/30 transition-colors"
            >
              <span>Discord officiel</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Collision Notice Banner */}
      {isAdmin && isSharedByOtherAdmin && !isBroadcasting && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-xs font-bold text-amber-300 shadow-lg">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Un admin s'occupe déjà de la diffusion.</span>
          </div>
        </div>
      )}

      {/* Admin Broadcast Management Bar (Overlay Page Switchers) */}
      {isAdmin && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-[#0f1218] p-3 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-300">Page de diffusion :</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleChangeOverlay('normal')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    currentOverlay === 'normal'
                      ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                      : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  <span>Direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeOverlay('avant-match')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    currentOverlay === 'avant-match'
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                      : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Avant match</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeOverlay('mi-temps')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    currentOverlay === 'mi-temps'
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                      : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  <span>Mi-temps</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleChangeOverlay('erreur')}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    currentOverlay === 'erreur'
                      ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                      : 'border border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>Erreur</span>
                </button>
              </div>
            </div>

            {/* If broadcasting, display prominent Arrêter button */}
            {isBroadcasting && (
              <button
                type="button"
                onClick={handleRequestStopShare}
                className="flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition-all active:scale-95"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>Arrêter le partage</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Stream + Chat Container */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:p-6">
        {/* Left: Video Player Area */}
        <div className="flex-1 flex flex-col">
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowControls(false)}
            className="relative flex aspect-video w-full flex-col justify-center overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-black shadow-2xl"
          >
            {/* Live Video Element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              className={`h-full w-full object-contain transition-opacity duration-300 ${
                (isBroadcasting || streamStatus === 'live') && currentOverlay === 'normal' ? 'opacity-100' : 'opacity-0 absolute'
              }`}
            />

            {/* Fallback Canvas / Frame Player when direct WebRTC is buffering */}
            {streamStatus === 'fallback' && fallbackFrame && currentOverlay === 'normal' && (
              <img
                src={fallbackFrame}
                alt="Flux vidéo"
                className="h-full w-full object-contain"
              />
            )}

            {/* OVERLAY 1: ERREUR */}
            {currentOverlay === 'erreur' && (
              <div className="relative z-20 flex h-full w-full flex-col items-center justify-center bg-black/95 p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/40 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                  <AlertCircle className="h-8 w-8 animate-pulse text-red-500" />
                </div>
                <h3 className="text-lg sm:text-2xl font-black text-white max-w-lg mb-2">
                  Une erreur est survenue notre STAFF intervient au plus vite
                </h3>
                <p className="text-xs text-neutral-400 max-w-md">
                  Veuillez rester sur cette page. La diffusion reprendra automatiquement dès l'intervention de l'équipe technique.
                </p>
              </div>
            )}

            {/* OVERLAY 2: AVANT MATCH */}
            {currentOverlay === 'avant-match' && (
              <div className="relative z-20 flex h-full w-full flex-col items-center justify-center overflow-hidden p-6 text-center">
                <img
                  src={diffusion.coverUrl}
                  alt={diffusion.title}
                  className="absolute inset-0 h-full w-full object-cover filter blur-md opacity-30 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />

                <div className="relative z-10 max-w-lg space-y-4 flex flex-col items-center">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-400">
                    <Clock className="h-3.5 w-3.5" />
                    {diffusion.competition}
                  </span>

                  <h2 className="text-xl sm:text-3xl font-extrabold text-white">
                    {diffusion.title}
                  </h2>

                  <p className="text-sm sm:text-base font-semibold text-neutral-200">
                    Le match va bientôt commencer avec un countdown jusqu'au coup d'envoi
                  </p>

                  <CountdownDisplay timeStr={diffusion.time} />

                  <p className="text-xs text-neutral-400 pt-1">
                    Coup d'envoi prévu à <span className="text-white font-bold">{diffusion.time}</span> · Restez connectés sur Nova Foot
                  </p>
                </div>
              </div>
            )}

            {/* OVERLAY 3: MI-TEMPS */}
            {currentOverlay === 'mi-temps' && (
              <div className="relative z-20 flex h-full w-full flex-col items-center justify-center overflow-hidden p-6 text-center">
                <img
                  src={diffusion.coverUrl}
                  alt={diffusion.title}
                  className="absolute inset-0 h-full w-full object-cover filter blur-md opacity-25 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/70" />

                <div className="relative z-10 max-w-md space-y-3 flex flex-col items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    <PauseCircle className="h-6 w-6" />
                  </div>

                  <span className="rounded-full bg-blue-500/20 border border-blue-500/40 px-4 py-1 text-xs font-black tracking-widest text-blue-300 uppercase">
                    MI-TEMPS
                  </span>

                  <h3 className="text-lg sm:text-2xl font-bold text-white">
                    {diffusion.title}
                  </h3>

                  <p className="text-xs text-neutral-300 leading-relaxed">
                    Pause réglementaire. Reprise du direct pour la seconde période très prochainement.
                  </p>
                </div>
              </div>
            )}

            {/* Waiting Screen when stream is idle and normal overlay */}
            {currentOverlay === 'normal' && streamStatus === 'idle' && (
              <div className="relative flex h-full w-full flex-col items-center justify-center p-6 text-center overflow-hidden">
                <img
                  src={diffusion.coverUrl}
                  alt={diffusion.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-20 filter blur-sm scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60" />

                <div className="relative z-10 max-w-md space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Radio className="h-7 w-7 animate-pulse" />
                  </div>

                  <div>
                    <span className="text-xs font-bold tracking-wider uppercase text-emerald-400">
                      {diffusion.competition}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {diffusion.title}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-2">
                      Coup d'envoi programmé à <span className="text-white font-semibold">{diffusion.time}</span> ({diffusion.date})
                    </p>
                  </div>

                  {isAdmin ? (
                    <div className="pt-2 space-y-3">
                      {isSharedByOtherAdmin ? (
                        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs font-bold text-amber-300">
                          ⚠️ Un admin s'occupe déjà de la diffusion.
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          <button
                            onClick={handleStartShare}
                            className="group inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95"
                          >
                            <ScreenShare className="h-5 w-5 transition-transform group-hover:scale-110" />
                            <span>Lancer le live</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleStartTestStream}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
                            title="Lancer flux synthétique 60fps"
                          >
                            <Sparkles className="h-4 w-4 text-emerald-400" />
                            <span>Flux test (60 FPS)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                      <p className="text-xs text-neutral-300">
                        La diffusion va débuter sous peu. Installez-vous confortablement et discutez dans le chat en direct !
                      </p>
                      <button
                        onClick={onOpenDiscordVip}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline"
                      >
                        <span>Rejoindre le Discord Nova Foot</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Connecting State */}
            {currentOverlay === 'normal' && streamStatus === 'connecting' && (
              <div className="relative flex h-full w-full flex-col items-center justify-center bg-black/90">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <p className="mt-4 text-xs font-medium text-neutral-300">
                  Connexion au flux haute définition en cours...
                </p>
              </div>
            )}

            {/* Top Overlay Stats */}
            <div
              className={`absolute top-0 left-0 right-0 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-30 ${
                showControls || streamStatus !== 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2">
                {streamStatus === 'live' ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                    </span>
                    EN DIRECT
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-900/80 px-2.5 py-1 text-[11px] font-semibold text-neutral-400 border border-white/10">
                    PROGRAMMÉ
                  </span>
                )}

                <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-neutral-300 border border-white/10 backdrop-blur-md">
                  <Users className="h-3 w-3 text-emerald-400" />
                  {viewerCount} spectateurs
                </span>

                <span className="hidden sm:inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  {qualityPreset} 60FPS
                </span>
              </div>

              {/* Admin Stop button if broadcasting */}
              {isAdmin && isBroadcasting && (
                <button
                  type="button"
                  onClick={handleRequestStopShare}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition-all"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  <span>Arrêter le partage</span>
                </button>
              )}
            </div>

            {/* Bottom Controls Bar (Visible on hover - NO EMOJIS UNDER STREAM) */}
            <div
              className={`absolute bottom-0 left-0 right-0 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-30 ${
                showControls || streamStatus !== 'live' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Left audio controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-emerald-400 transition-colors"
                  title={isMuted ? 'Activer le son' : 'Couper le son'}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 sm:w-24 accent-emerald-500 cursor-pointer"
                />

                <span className="text-[11px] text-neutral-400 hidden sm:inline">
                  Latence: &lt; 0.2s
                </span>
              </div>

              {/* Right: Fullscreen & Quality Preset */}
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <select
                    value={qualityPreset}
                    onChange={(e) => setQualityPreset(e.target.value as any)}
                    className="bg-black/60 text-[11px] text-emerald-400 border border-white/10 rounded-lg px-2 py-1 outline-none"
                    title="Qualité du stream"
                  >
                    <option value="1080p">1080p 60fps</option>
                    <option value="720p">720p 30fps</option>
                  </select>
                )}

                <button
                  onClick={toggleFullscreen}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-emerald-500 hover:text-black"
                  title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Under-player Match Details */}
          <div className="mt-4 rounded-2xl border border-white/5 bg-[#0c0d12] p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <span>{diffusion.competition}</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-neutral-400">{diffusion.date} à {diffusion.time}</span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-white mt-1">
                  {diffusion.title}
                </h1>
                <p className="text-xs text-neutral-400 mt-1">
                  {diffusion.description || 'Diffusion optimisée haute fluidité 60fps sur Nova Foot.'}
                </p>
              </div>

              {isAdmin && !isBroadcasting && (
                <button
                  onClick={handleStartShare}
                  disabled={isSharedByOtherAdmin}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition-all hover:bg-emerald-400 shadow-md active:scale-95 disabled:opacity-40"
                >
                  <ScreenShare className="h-4 w-4" />
                  <span>{isSharedByOtherAdmin ? "En diffusion par un autre admin" : "Lancer le live"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Real-time Live Chat */}
        <div className="w-full lg:w-80 xl:w-96 flex flex-col h-[480px] lg:h-[620px] rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0c0d12] overflow-hidden shadow-2xl">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-[#101217] px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" />
              <h3 className="text-xs font-bold tracking-tight text-white uppercase">
                Chat en direct
              </h3>
            </div>

            {/* Editable Supporter Nickname */}
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              {isAdmin && (
                <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                  <Shield className="h-2.5 w-2.5" />
                  ADMIN
                </span>
              )}
              {isEditingName ? (
                <input
                  type="text"
                  maxLength={18}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onBlur={() => {
                    setIsEditingName(false);
                    localStorage.setItem('nova_user_name', userName);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                      localStorage.setItem('nova_user_name', userName);
                    }
                  }}
                  autoFocus
                  className="w-24 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white border border-emerald-500/40 outline-none"
                />
              ) : (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                  title="Modifier mon pseudo"
                >
                  <span className="font-semibold text-neutral-300 max-w-[120px] truncate">
                    {userName}
                  </span>
                  <span className="text-[10px] text-neutral-500">✏️</span>
                </button>
              )}
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-neutral-500 text-xs py-8">
                <Smile className="h-6 w-6 mb-2 opacity-40 text-emerald-400" />
                <p>Aucun message pour le moment.</p>
                <p className="text-[11px] text-neutral-600 mt-1">Sois le premier à réagir au match !</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className="group relative text-xs leading-relaxed break-words rounded-xl bg-black/30 p-2.5 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {msg.isAdmin ? (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                          <Shield className="h-2.5 w-2.5" />
                          ADMIN
                        </span>
                      ) : null}
                      <span className={`font-semibold ${msg.isAdmin ? 'text-emerald-300' : 'text-neutral-200'}`}>
                        {msg.user}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {msg.timestamp}
                      </span>

                      {/* Admin Moderation Actions */}
                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-neutral-400 hover:text-red-400 p-0.5 rounded transition-colors"
                            title="Supprimer ce message"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {!msg.isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleBanUser(msg.user)}
                              className="text-neutral-400 hover:text-red-500 p-0.5 rounded transition-colors"
                              title={`Bannir ${msg.user} du chat`}
                            >
                              <Ban className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-neutral-300">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Chat Input form or Banned notice */}
          {isBannedFromChat ? (
            <div className="border-t border-red-500/30 bg-red-950/40 p-3 text-center text-xs font-bold text-red-300">
              Vous avez été banni du chat par un administrateur.
            </div>
          ) : (
            <form
              onSubmit={handleChatSubmit}
              className="border-t border-white/5 bg-[#101217] p-3"
            >
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Envoyer un message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={250}
                  className="w-full rounded-xl border border-white/10 bg-black/60 px-3.5 py-2.5 pr-10 text-xs text-white placeholder-neutral-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-black transition-all hover:bg-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500">
                <span>Respectez les autres supporters</span>
                <span className="text-emerald-400/80">Nova Foot Live</span>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Chat Rules Modal (Shown on first message) */}
      <ChatRulesModal
        isOpen={isChatRulesModalOpen}
        onAccept={handleAcceptRules}
        onCancel={() => {
          setIsChatRulesModalOpen(false);
          setPendingMessage(null);
        }}
      />

      {/* Stop Sharing Confirmation Modal */}
      <StopShareConfirmModal
        isOpen={isStopConfirmOpen}
        onConfirmStopAndDelete={handleConfirmStopAndDelete}
        onConfirmJustStop={handleConfirmJustStop}
        onCancel={() => setIsStopConfirmOpen(false)}
      />
    </div>
  );
};
