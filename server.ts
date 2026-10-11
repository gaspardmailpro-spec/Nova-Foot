import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const ADMIN_CODE = 'NOVA498632';

interface Diffusion {
  id: string;
  title: string;
  competition: string;
  time: string; // e.g. "21:00"
  date: string; // e.g. "Aujourd'hui"
  dateValue?: string; // e.g. "2026-10-15"
  coverUrl: string;
  isLive: boolean;
  isFeatured?: boolean;
  statusText?: string;
  currentOverlay?: 'normal' | 'avant-match' | 'mi-temps' | 'erreur';
  teams?: {
    home: string;
    away: string;
    homeLogo?: string;
    awayLogo?: string;
  };
  description?: string;
  viewersCount: number;
}

interface ChatMessage {
  id: string;
  diffusionId: string;
  user: string;
  isAdmin: boolean;
  text: string;
  timestamp: string;
  avatarColor?: string;
}

function getInitialDiffusions(): Diffusion[] {
  const now = new Date();
  const formatIso = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return [
    {
      id: 'diff-today-psg-om',
      title: 'Paris Saint-Germain vs Olympique de Marseille',
      competition: "Ligue 1 McDonald's",
      time: '20:45',
      date: "Aujourd'hui",
      dateValue: formatIso(0),
      coverUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
      isLive: false,
      isFeatured: true,
      statusText: 'PROGRAMMÉ',
      description: 'Le Classique français en direct ultra haute définition 60fps sur Nova Foot.',
      viewersCount: 0
    },
    {
      id: 'diff-upcoming-clasico',
      title: 'Real Madrid vs FC Barcelone',
      competition: 'LaLiga EA Sports',
      time: '21:00',
      date: 'Dans 2 jours',
      dateValue: formatIso(2),
      coverUrl: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1200&q=80',
      isLive: false,
      statusText: 'PROGRAMMÉ',
      description: 'Le grand choc de LaLiga entre le Real Madrid et le FC Barcelone.',
      viewersCount: 0
    },
    {
      id: 'diff-upcoming-arsenal-city',
      title: 'Arsenal vs Manchester City',
      competition: 'Premier League',
      time: '17:30',
      date: 'Dans 4 jours',
      dateValue: formatIso(4),
      coverUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
      isLive: false,
      statusText: 'PROGRAMMÉ',
      description: 'Choc au sommet de la Premier League entre Arsenal et Manchester City.',
      viewersCount: 0
    }
  ];
}

let diffusions: Diffusion[] = getInitialDiffusions();

let chatMessages: ChatMessage[] = [];

// Active live broadcast state
interface ActiveBroadcast {
  streamId: string;
  adminSocketId: string;
  title: string;
  isLive: boolean;
  hasAudio: boolean;
  fps: number;
  quality: string;
  startedAt: number;
  currentOverlay?: 'normal' | 'avant-match' | 'mi-temps' | 'erreur';
  currentFrame?: string; // Last captured keyframe for instant preview / fallback
}

let activeBroadcast: ActiveBroadcast | null = null;
let broadcasterDisconnectTimer: any = null;
const bannedUsers = new Set<string>();
let discordClientId = process.env.DISCORD_CLIENT_ID || '';
let discordClientSecret = process.env.DISCORD_CLIENT_SECRET || '';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // WebSocket Server setup
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Map client socket to metadata
  interface ClientMeta {
    id: string;
    isAdmin: boolean;
    streamId: string | null;
    socket: WebSocket;
  }

  const clients = new Map<WebSocket, ClientMeta>();

  function broadcastToRoom(streamId: string, data: any, excludeWs?: WebSocket) {
    const message = JSON.stringify(data);
    for (const [ws, meta] of clients.entries()) {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN && meta.streamId === streamId) {
        ws.send(message);
      }
    }
  }

  function broadcastToAll(data: any) {
    const message = JSON.stringify(data);
    for (const [ws] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  function getViewerCount(streamId: string): number {
    let count = 0;
    for (const [, meta] of clients.entries()) {
      if (meta.streamId === streamId) count++;
    }
    return count;
  }

  // Server-side keepalive ping to maintain connections indefinitely across proxies/Cloud Run
  const keepAliveInterval = setInterval(() => {
    for (const [ws] of clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'server-ping', timestamp: Date.now() }));
        } catch (e) {}
      }
    }
  }, 15000);

  wss.on('connection', (ws) => {
    const clientId = 'client_' + Math.random().toString(36).substring(2, 9);
    clients.set(ws, {
      id: clientId,
      isAdmin: false,
      streamId: null,
      socket: ws
    });

    // Send initial handshake
    ws.send(JSON.stringify({
      type: 'connected',
      clientId,
      activeBroadcast: activeBroadcast ? {
        streamId: activeBroadcast.streamId,
        title: activeBroadcast.title,
        isLive: activeBroadcast.isLive,
        hasAudio: activeBroadcast.hasAudio,
        quality: activeBroadcast.quality
      } : null
    }));

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const meta = clients.get(ws);
        if (!meta) return;

        switch (data.type) {
          // Heartbeat ping
          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;
          }

          // Join a match room
          case 'join-room': {
            meta.streamId = data.streamId;
            const count = getViewerCount(data.streamId);

            const isThisBroadcastActive = Boolean(activeBroadcast && activeBroadcast.streamId === data.streamId && activeBroadcast.isLive);
            const overlay = activeBroadcast?.currentOverlay || diffusions.find(d => d.id === data.streamId)?.currentOverlay || 'normal';
            const isSharedByAnotherAdmin = Boolean(
              activeBroadcast &&
              activeBroadcast.streamId === data.streamId &&
              activeBroadcast.isLive &&
              activeBroadcast.adminSocketId !== meta.id
            );

            // Send room state
            ws.send(JSON.stringify({
              type: 'room-joined',
              streamId: data.streamId,
              viewerCount: count,
              isBroadcastActive: isThisBroadcastActive,
              currentOverlay: overlay,
              isSharedByAnotherAdmin,
              currentFrame: isThisBroadcastActive ? (activeBroadcast?.currentFrame || null) : null
            }));

            // Notify others of viewer count update
            broadcastToRoom(data.streamId, {
              type: 'viewer-count-updated',
              streamId: data.streamId,
              count
            });

            // If this room has an active broadcast, notify admin broadcaster that a new viewer joined
            if (activeBroadcast && activeBroadcast.streamId === data.streamId && activeBroadcast.isLive) {
              for (const [adminWs, adminMeta] of clients.entries()) {
                if (adminMeta.isAdmin && adminWs.readyState === WebSocket.OPEN) {
                  adminWs.send(JSON.stringify({
                    type: 'viewer-connected',
                    viewerId: meta.id,
                    streamId: data.streamId
                  }));
                }
              }
            }
            break;
          }

          // Leave room
          case 'leave-room': {
            const oldRoom = meta.streamId;
            meta.streamId = null;
            if (oldRoom) {
              const count = getViewerCount(oldRoom);
              broadcastToRoom(oldRoom, {
                type: 'viewer-count-updated',
                streamId: oldRoom,
                count
              });
            }
            break;
          }

          // Admin authenticates over socket
          case 'admin-auth': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
              if (activeBroadcast) {
                // Seamlessly rebind active broadcast to reconnected admin socket
                activeBroadcast.adminSocketId = meta.id;
              }
              ws.send(JSON.stringify({
                type: 'admin-auth-success',
                message: 'Admin session authorized',
                activeBroadcast
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'admin-auth-error',
                message: 'Code invalide'
              }));
            }
            break;
          }

          // Admin starts screen sharing broadcast
          case 'start-broadcast': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
            }

            if (!meta.isAdmin) {
              ws.send(JSON.stringify({ type: 'error', message: 'Accès non autorisé' }));
              return;
            }

            // COLLISION CHECK: Check if another admin is already broadcasting on this stream
            if (
              activeBroadcast &&
              activeBroadcast.isLive &&
              activeBroadcast.streamId === data.streamId &&
              activeBroadcast.adminSocketId !== meta.id
            ) {
              ws.send(JSON.stringify({
                type: 'broadcast-in-progress',
                streamId: data.streamId,
                message: "Un admin s'occupe déjà de la diffusion."
              }));
              return;
            }

            if (broadcasterDisconnectTimer) {
              clearTimeout(broadcasterDisconnectTimer);
              broadcasterDisconnectTimer = null;
            }

            activeBroadcast = {
              streamId: data.streamId,
              adminSocketId: meta.id,
              title: data.title || 'Live Streaming',
              isLive: true,
              hasAudio: !!data.hasAudio,
              fps: data.fps || 60,
              quality: data.quality || '1080p 60fps',
              currentOverlay: 'normal',
              startedAt: Date.now()
            };

            // Update diffusion status
            const found = diffusions.find(d => d.id === data.streamId);
            if (found) {
              found.isLive = true;
              found.statusText = 'EN DIRECT';
              found.currentOverlay = 'normal';
            }

            // Broadcast to everyone that live has started
            broadcastToAll({
              type: 'broadcast-started',
              broadcast: {
                streamId: activeBroadcast.streamId,
                title: activeBroadcast.title,
                quality: activeBroadcast.quality
              }
            });

            // Immediately notify broadcaster of all viewers currently in the room!
            for (const [clientWs, clientMeta] of clients.entries()) {
              if (clientMeta.streamId === data.streamId && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'viewer-connected',
                  viewerId: clientMeta.id,
                  streamId: data.streamId
                }));
              }
            }
            break;
          }

          // Overlay state changer (Erreur, Avant match, Mi-temps, Direct)
          case 'set-overlay-state': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
            }
            if (!meta.isAdmin) return;

            const overlay = data.overlay || 'normal';
            if (activeBroadcast && activeBroadcast.streamId === data.streamId) {
              activeBroadcast.currentOverlay = overlay;
            }
            const found = diffusions.find(d => d.id === data.streamId);
            if (found) {
              found.currentOverlay = overlay;
            }

            broadcastToRoom(data.streamId, {
              type: 'overlay-state-changed',
              streamId: data.streamId,
              overlay
            });
            break;
          }

          // Admin stops broadcast
          case 'stop-broadcast': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
            }
            if (!meta.isAdmin) return;

            if (broadcasterDisconnectTimer) {
              clearTimeout(broadcasterDisconnectTimer);
              broadcasterDisconnectTimer = null;
            }

            if (activeBroadcast) {
              const streamId = activeBroadcast.streamId;
              const found = diffusions.find(d => d.id === streamId);
              if (found) {
                found.isLive = false;
                found.statusText = 'PROGRAMMÉ';
                found.currentOverlay = 'normal';
              }

              activeBroadcast = null;

              // Check if user requested to also delete the diffusion
              if (data.deleteDiffusion) {
                diffusions = diffusions.filter(d => d.id !== streamId);
                broadcastToAll({
                  type: 'diffusion-deleted',
                  diffusionId: streamId
                });
              }

              broadcastToAll({
                type: 'broadcast-stopped',
                streamId
              });
            }
            break;
          }

          // WebRTC Signaling: Offer from Admin to Viewer
          case 'signal:offer': {
            const targetViewerId = data.targetViewerId;
            for (const [targetWs, targetMeta] of clients.entries()) {
              if (targetMeta.id === targetViewerId && targetWs.readyState === WebSocket.OPEN) {
                targetWs.send(JSON.stringify({
                  type: 'signal:offer',
                  offer: data.offer,
                  from: meta.id
                }));
                break;
              }
            }
            break;
          }

          // WebRTC Signaling: Answer from Viewer to Admin
          case 'signal:answer': {
            const adminSocketId = activeBroadcast?.adminSocketId;
            for (const [targetWs, targetMeta] of clients.entries()) {
              if (
                ((adminSocketId && targetMeta.id === adminSocketId) || targetMeta.isAdmin) &&
                targetWs.readyState === WebSocket.OPEN
              ) {
                targetWs.send(JSON.stringify({
                  type: 'signal:answer',
                  answer: data.answer,
                  fromViewerId: meta.id
                }));
                break;
              }
            }
            break;
          }

          // WebRTC Signaling: ICE Candidate exchange
          case 'signal:ice-candidate': {
            if (data.targetViewerId) {
              // Admin to specific viewer
              for (const [targetWs, targetMeta] of clients.entries()) {
                if (targetMeta.id === data.targetViewerId && targetWs.readyState === WebSocket.OPEN) {
                  targetWs.send(JSON.stringify({
                    type: 'signal:ice-candidate',
                    candidate: data.candidate
                  }));
                  break;
                }
              }
            } else {
              // Viewer to Admin
              const adminSocketId = activeBroadcast?.adminSocketId;
              for (const [targetWs, targetMeta] of clients.entries()) {
                if (
                  ((adminSocketId && targetMeta.id === adminSocketId) || targetMeta.isAdmin) &&
                  targetWs.readyState === WebSocket.OPEN
                ) {
                  targetWs.send(JSON.stringify({
                    type: 'signal:ice-candidate',
                    candidate: data.candidate,
                    fromViewerId: meta.id
                  }));
                  break;
                }
              }
            }
            break;
          }

          // Fallback / High-performance direct video frame streaming
          case 'stream:frame': {
            if (!meta.isAdmin || !activeBroadcast) return;
            activeBroadcast.currentFrame = data.frame;
            // Relay to all viewers in that stream room
            broadcastToRoom(activeBroadcast.streamId, {
              type: 'stream:frame',
              frame: data.frame,
              timestamp: data.timestamp
            }, ws);
            break;
          }

          // Chat message sent
          case 'chat-message': {
            if (!data.text || !data.text.trim()) return;

            if (data.adminCode === ADMIN_CODE) {
              meta.isAdmin = true;
            }

            const senderUser = (data.user || 'Spectateur').trim();
            if (bannedUsers.has(senderUser)) {
              ws.send(JSON.stringify({
                type: 'chat-error',
                message: 'Vous avez été banni du chat.'
              }));
              return;
            }

            const isSenderAdmin = !!meta.isAdmin || !!data.isAdmin;

            const newMsg: ChatMessage = {
              id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              diffusionId: data.diffusionId,
              user: senderUser || (isSenderAdmin ? 'Admin' : 'Spectateur'),
              isAdmin: isSenderAdmin,
              text: data.text.trim().substring(0, 300),
              timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              avatarColor: data.avatarColor || (isSenderAdmin ? '#10b981' : '#38bdf8')
            };

            chatMessages.push(newMsg);
            if (chatMessages.length > 200) {
              chatMessages.shift();
            }

            // Broadcast to room
            broadcastToRoom(data.diffusionId, {
              type: 'new-chat-message',
              message: newMsg
            });
            break;
          }

          // Admin deletes chat message
          case 'delete-chat-message': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
            }
            if (!meta.isAdmin) return;

            chatMessages = chatMessages.filter(m => m.id !== data.messageId);
            broadcastToRoom(data.diffusionId, {
              type: 'chat-message-deleted',
              messageId: data.messageId,
              diffusionId: data.diffusionId
            });
            break;
          }

          // Admin bans user from chat
          case 'ban-user': {
            if (data.code === ADMIN_CODE) {
              meta.isAdmin = true;
            }
            if (!meta.isAdmin) return;

            if (data.username) {
              bannedUsers.add(data.username);
              // Also remove existing messages from this banned user
              chatMessages = chatMessages.filter(m => m.user !== data.username);
              broadcastToRoom(data.diffusionId, {
                type: 'user-banned',
                username: data.username,
                diffusionId: data.diffusionId
              });
            }
            break;
          }

          // Live reaction
          case 'reaction': {
            broadcastToRoom(data.diffusionId, {
              type: 'reaction',
              emoji: data.emoji,
              user: data.user || 'Spectateur'
            });
            break;
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      const meta = clients.get(ws);
      if (meta) {
        // NOTE: We DO NOT terminate activeBroadcast when an admin socket closes.
        // The broadcast must stay alive continuously until an admin explicitly clicks to stop or delete it.
        if (meta.streamId) {
          const count = getViewerCount(meta.streamId) - 1;
          broadcastToRoom(meta.streamId, {
            type: 'viewer-count-updated',
            streamId: meta.streamId,
            count: Math.max(0, count)
          });
        }
      }
      clients.delete(ws);
    });
  });

  // REST API Routes
  // 1. Verify admin code
  app.post('/api/admin/verify', (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Code requis' });
    }
    // Clean code: trim and uppercase
    const clean = String(code).trim().toUpperCase();
    if (clean === ADMIN_CODE) {
      return res.json({
        success: true,
        message: 'Accès administrateur accordé',
        adminName: 'Admin Nova'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Code incorrect'
      });
    }
  });

  // 2. Get list of scheduled diffusions
  app.get('/api/diffusions', (req, res) => {
    const seen = new Set<string>();
    const unique = diffusions.filter(d => {
      if (!d || !d.id || seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    }).map(d => ({
      ...d,
      viewersCount: getViewerCount(d.id)
    }));
    diffusions = unique;
    res.json({
      success: true,
      diffusions: unique,
      activeBroadcast: activeBroadcast ? {
        streamId: activeBroadcast.streamId,
        title: activeBroadcast.title,
        isLive: activeBroadcast.isLive,
        quality: activeBroadcast.quality
      } : null
    });
  });

  // 3. Create a new scheduled diffusion (Admin only)
  app.post('/api/diffusions', (req, res) => {
    const { code, title, competition, time, date, dateValue, coverUrl, description } = req.body;
    if (String(code).trim().toUpperCase() !== ADMIN_CODE) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    if (!title || !competition || !time) {
      return res.status(400).json({ success: false, error: 'Champs obligatoires manquants' });
    }

    const uniqueId = 'diff-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

    const newDiff: Diffusion = {
      id: uniqueId,
      title: title.trim(),
      competition: competition.trim(),
      time: time.trim(),
      date: date ? date.trim() : 'Aujourd\'hui',
      dateValue: dateValue ? String(dateValue).trim() : (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date).trim()) ? String(date).trim() : undefined),
      coverUrl: coverUrl ? coverUrl.trim() : 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
      isLive: false,
      statusText: 'PROGRAMMÉ',
      description: description ? description.trim() : 'Diffusion officielle Nova Foot HD.',
      viewersCount: 0
    };

    if (!diffusions.some(d => d.id === newDiff.id)) {
      diffusions.unshift(newDiff);
    }

    // Notify all via WS
    broadcastToAll({
      type: 'diffusion-added',
      diffusion: newDiff
    });

    res.status(201).json({ success: true, diffusion: newDiff });
  });

  // 4. Delete diffusion
  app.delete('/api/diffusions/:id', (req, res) => {
    const authHeader = req.headers['x-admin-code'];
    if (String(authHeader).trim().toUpperCase() !== ADMIN_CODE) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    const { id } = req.params;
    diffusions = diffusions.filter(d => d.id !== id);

    broadcastToAll({
      type: 'diffusion-deleted',
      diffusionId: id
    });

    res.json({ success: true });
  });

  // 5. Feature a diffusion (Mettre à la une sur le site)
  app.post('/api/diffusions/:id/feature', (req, res) => {
    const authHeader = req.headers['x-admin-code'] || req.body?.code;
    if (String(authHeader).trim().toUpperCase() !== ADMIN_CODE) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    const { id } = req.params;
    diffusions.forEach(d => {
      d.isFeatured = d.id === id;
    });

    broadcastToAll({
      type: 'diffusion-featured',
      featuredId: id
    });

    res.json({ success: true, featuredId: id });
  });

  // 6. Get chat messages for diffusion
  app.get('/api/chat/:diffusionId', (req, res) => {
    const { diffusionId } = req.params;
    const msgs = chatMessages.filter(m => m.diffusionId === diffusionId);
    res.json({ success: true, messages: msgs });
  });

  // 7. Config info (Discord URL, Logo)
  app.get('/api/config', (req, res) => {
    res.json({
      siteName: 'Nova Foot',
      discordUrl: 'https://discord.gg/fKWtyTyNry',
      logoUrl: 'https://i.postimg.cc/G3DmvQw1/novafoot.webp',
      discordOAuthConfigured: Boolean(discordClientId)
    });
  });

  // 8. Discord OAuth URL generator
  app.get('/api/auth/discord/url', (req, res) => {
    const requestedRedirect = req.query.redirect_uri ? String(req.query.redirect_uri).trim() : null;
    const requestedReturnOrigin = req.query.return_origin ? String(req.query.return_origin).trim() : null;
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const currentSiteOrigin = requestedReturnOrigin || req.get('origin') || `${protocol}://${host}`;
    const redirectUri = requestedRedirect || `${currentSiteOrigin}/api/auth/discord/callback`;

    if (!discordClientId) {
      return res.json({
        configured: false,
        redirectUri,
        message: 'DISCORD_CLIENT_ID non configuré.'
      });
    }

    const stateObj = {
      redirectUri,
      returnOrigin: currentSiteOrigin
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    const params = new URLSearchParams({
      client_id: discordClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify email guilds',
      prompt: 'consent',
      state: state
    });

    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
    res.json({
      configured: true,
      url,
      redirectUri,
      returnOrigin: currentSiteOrigin,
      clientId: discordClientId
    });
  });

  // 9. Update Discord OAuth config in runtime
  app.post('/api/auth/discord/config', (req, res) => {
    const { clientId, clientSecret, adminCode } = req.body;
    if (adminCode && String(adminCode).trim().toUpperCase() !== ADMIN_CODE) {
      return res.status(403).json({ success: false, error: 'Code incorrect' });
    }
    if (clientId) discordClientId = String(clientId).trim();
    if (clientSecret) discordClientSecret = String(clientSecret).trim();
    res.json({ success: true, configured: Boolean(discordClientId) });
  });

  // 10. Discord OAuth Callback Handler
  app.get(['/api/auth/discord/callback', '/api/auth/discord/callback/'], async (req, res) => {
    const { code, error, state } = req.query;

    if (error || !code) {
      return res.send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#090a0f;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
            <h3>Connexion annulée ou rejetée</h3>
            <p>${error || 'Code manquant'}</p>
            <script>setTimeout(() => window.close(), 2500);</script>
          </body>
        </html>
      `);
    }

    try {
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
      let redirectUri = `${protocol}://${host}/api/auth/discord/callback`;
      let returnOrigin = `${protocol}://${host}`;

      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(String(state), 'base64').toString('utf8'));
          if (parsed.redirectUri) redirectUri = parsed.redirectUri;
          if (parsed.returnOrigin) returnOrigin = parsed.returnOrigin;
        } catch (e) {}
      }

      // Exchange code for token
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: discordClientId,
          client_secret: discordClientSecret,
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'Échec de récupération du jeton Discord');
      }

      // Fetch user profile from Discord API
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const userData = await userRes.json();

      const userProfile = {
        id: userData.id,
        username: userData.username,
        global_name: userData.global_name || userData.username,
        avatar: userData.avatar
          ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0', 10) % 5}.png`,
        discriminator: userData.discriminator,
        email: userData.email
      };

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connexion Discord validée - Nova Foot</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body style="background:#0b0e14;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="background:#131722;padding:28px;border-radius:20px;text-align:center;border:1px solid rgba(255,255,255,0.1);max-width:320px;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
              <img src="${userProfile.avatar}" style="width:68px;height:68px;border-radius:50%;margin-bottom:14px;border:3px solid #5865F2;" />
              <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;">Bienvenue ${userProfile.global_name} !</h2>
              <p style="margin:0;color:#94a3b8;font-size:13px;">Redirection vers le site Nova Foot...</p>
            </div>
            <script>
              const profile = ${JSON.stringify(userProfile)};
              const targetOrigin = ${JSON.stringify(returnOrigin)};

              try {
                localStorage.setItem('nova_discord_auth', 'true');
                localStorage.setItem('nova_user_name', profile.global_name || profile.username);
                if (profile.avatar) {
                  localStorage.setItem('nova_discord_avatar', profile.avatar);
                }
              } catch (e) {}

              const redirectUrl = targetOrigin + '/?discord_auth=1&user=' + encodeURIComponent(JSON.stringify(profile));

              if (window.opener && window.opener !== window) {
                try {
                  window.opener.postMessage({
                    type: 'DISCORD_OAUTH_SUCCESS',
                    user: profile
                  }, '*');
                } catch (e) {}

                setTimeout(() => {
                  try { window.close(); } catch (e) {}
                  // In case popup close was blocked by browser, redirect directly to Nova Foot site
                  setTimeout(() => { window.location.href = redirectUrl; }, 300);
                }, 600);
              } else {
                window.location.href = redirectUrl;
              }
            </script>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('Discord OAuth error:', err);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <body style="background:#090a0f;color:#fff;font-family:sans-serif;text-align:center;padding:40px;">
            <h3>Erreur d'authentification Discord</h3>
            <p>${err.message || 'Erreur inconnue'}</p>
            <script>setTimeout(() => window.close(), 4000);</script>
          </body>
        </html>
      `);
    }
  });

  // Vite middleware in dev or static serving in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`> Nova Foot Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
