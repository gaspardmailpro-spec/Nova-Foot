import { socket } from './socket';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

// BroadcastChannel for instant local multi-tab sharing
let localBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    localBroadcastChannel = new BroadcastChannel('novafoot_stream_local');
  }
} catch (e) {
  // Ignore BroadcastChannel errors in restrictive environments
}

export class BroadcasterEngine {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private isBroadcasting: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  private fallbackTimer: any = null;
  private streamId: string = '';
  private lastTitle: string = '';
  private lastHasAudio: boolean = false;
  private lastFps: number = 60;
  private lastQuality: string = '1080p 60fps';
  private onStopCallback: (() => void) | null = null;
  private testStreamInterval: any = null;

  constructor() {
    this.setupSocketListeners();
  }

  private setupSocketListeners() {
    // When WebSocket reconnects, re-announce active broadcast to server
    socket.on('connected', () => {
      if (this.isBroadcasting && this.streamId) {
        socket.send('start-broadcast', {
          code: 'NOVA498632',
          streamId: this.streamId,
          title: this.lastTitle || 'Flux Live HD',
          hasAudio: this.lastHasAudio,
          fps: this.lastFps,
          quality: this.lastQuality
        });
      }
    });

    // When a viewer joins, create peer connection for them
    socket.on('viewer-connected', async (data: { viewerId: string; streamId: string }) => {
      if (!this.isBroadcasting || !this.localStream) return;
      await this.initiatePeerToViewer(data.viewerId);
    });

    // When viewer returns an answer
    socket.on('signal:answer', async (data: { answer: RTCSessionDescriptionInit; fromViewerId: string }) => {
      const pc = this.peerConnections.get(data.fromViewerId);
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (e) {
          // ignore signaling race errors
        }
      }
    });

    // When viewer sends ICE candidate
    socket.on('signal:ice-candidate', async (data: { candidate: RTCIceCandidateInit; fromViewerId: string }) => {
      const pc = this.peerConnections.get(data.fromViewerId);
      if (pc && data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          // ignore ICE candidate timing issues
        }
      }
    });
  }

  public async startScreenShare(
    streamId: string,
    title: string,
    qualityPreset: '1080p' | '720p' = '1080p',
    onStop?: () => void
  ): Promise<MediaStream> {
    this.streamId = streamId;
    this.onStopCallback = onStop || null;

    const frameRate = qualityPreset === '1080p' ? 60 : 30;
    const width = qualityPreset === '1080p' ? 1920 : 1280;
    const height = qualityPreset === '1080p' ? 1080 : 720;

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      const err = new Error('Votre navigateur ne supporte pas le partage d\'écran.');
      err.name = 'NotSupportedError';
      throw err;
    }

    let stream: MediaStream;

    try {
      // 1. Try with audio and preferred video frameRate
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: frameRate, max: 60 },
          width: { ideal: width, max: 1920 },
          height: { ideal: height, max: 1080 }
        },
        audio: true
      });
    } catch (errAudio: any) {
      // If user cancelled, don't retry, rethrow immediately
      if (
        errAudio.name === 'AbortError' ||
        (errAudio.name === 'NotAllowedError' && String(errAudio.message).toLowerCase().includes('cancel'))
      ) {
        throw errAudio;
      }

      // If audio constraint failed or unsupported, retry with plain video
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });
      } catch (errVideo: any) {
        throw errVideo;
      }
    }

    this.localStream = stream;
    this.isBroadcasting = true;

    // Handle native user stop (e.g. click "Stop sharing" browser banner)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        this.stopScreenShare();
      };
    }

    // Tell backend broadcast has started
    const hasAudio = stream.getAudioTracks().length > 0;
    this.lastTitle = title;
    this.lastHasAudio = hasAudio;
    this.lastFps = frameRate;
    this.lastQuality = `${height}p ${frameRate}fps`;

    socket.send('start-broadcast', {
      code: 'NOVA498632',
      streamId,
      title,
      hasAudio,
      fps: frameRate,
      quality: `${height}p ${frameRate}fps`
    });

    // Notify local channel for local multi-tab viewers
    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage({
          type: 'stream-started',
          streamId,
          title
        });
      } catch (e) {}
    }

    // Start fallback frame grabber
    this.startFallbackFrameCapture(stream);

    return stream;
  }

  // Simulated interactive 60fps Football test stream
  // Essential when running in restricted iframes or when user wants to preview without selecting display
  public startInteractiveTestStream(
    streamId: string,
    title: string,
    onStop?: () => void
  ): MediaStream {
    this.streamId = streamId;
    this.onStopCallback = onStop || null;

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d')!;

    let frame = 0;
    let ballX = 300;
    let ballY = 360;
    let ballVx = 7;
    let ballVy = 4;

    this.testStreamInterval = setInterval(() => {
      frame++;
      // Dark green grass
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, 1280, 720);

      // Pitch lines
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(60, 60, 1160, 600);

      // Center circle
      ctx.beginPath();
      ctx.arc(640, 360, 110, 0, Math.PI * 2);
      ctx.stroke();

      // Center line
      ctx.beginPath();
      ctx.moveTo(640, 60);
      ctx.lineTo(640, 660);
      ctx.stroke();

      // Penalty areas
      ctx.strokeRect(60, 200, 160, 320);
      ctx.strokeRect(1060, 200, 160, 320);

      // Bouncing ball
      ballX += ballVx;
      ballY += ballVy;
      if (ballX < 80 || ballX > 1200) ballVx *= -1;
      if (ballY < 80 || ballY > 640) ballVy *= -1;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
      ctx.fill();

      // Scoreboard header
      ctx.fillStyle = 'rgba(10, 12, 16, 0.9)';
      ctx.fillRect(400, 20, 480, 64);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.strokeRect(400, 20, 480, 64);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('NOVA FOOT LIVE · 1080p 60FPS', 640, 48);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px monospace';
      const elapsed = Math.floor(frame / 60);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      ctx.fillText(`FLUX HD EN COURS · TEMPS: ${mins}:${secs} · SPECTATEURS ACTIFS`, 640, 72);
    }, 1000 / 60);

    const stream = canvas.captureStream(60);
    this.localStream = stream;
    this.isBroadcasting = true;

    this.lastTitle = title || 'Flux Live HD';
    this.lastHasAudio = false;
    this.lastFps = 60;
    this.lastQuality = '1080p 60fps';

    socket.send('start-broadcast', {
      code: 'NOVA498632',
      streamId,
      title: title || 'Flux Live HD',
      hasAudio: false,
      fps: 60,
      quality: '1080p 60fps'
    });

    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage({
          type: 'stream-started',
          streamId,
          title
        });
      } catch (e) {}
    }

    this.startFallbackFrameCapture(stream);
    return stream;
  }

  private async initiatePeerToViewer(viewerId: string) {
    if (!this.localStream) return;

    if (this.peerConnections.has(viewerId)) {
      this.peerConnections.get(viewerId)?.close();
      this.peerConnections.delete(viewerId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(viewerId, pc);

    for (const track of this.localStream.getTracks()) {
      pc.addTrack(track, this.localStream);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send('signal:ice-candidate', {
          targetViewerId: viewerId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.peerConnections.delete(viewerId);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.send('signal:offer', {
        targetViewerId: viewerId,
        offer: pc.localDescription
      });
    } catch (err) {
      // Ignore offer creation races
    }
  }

  private startFallbackFrameCapture(_stream: MediaStream) {
    // No-op: Do not spawn offscreen video elements that hijack MediaStream or cause 0.1s blackouts
  }

  public stopScreenShare(deleteDiffusion: boolean = false) {
    if (!this.isBroadcasting) return;
    this.isBroadcasting = false;

    if (this.testStreamInterval) {
      clearInterval(this.testStreamInterval);
      this.testStreamInterval = null;
    }

    if (this.fallbackTimer) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    for (const [, pc] of this.peerConnections.entries()) {
      pc.close();
    }
    this.peerConnections.clear();

    socket.send('stop-broadcast', {
      code: 'NOVA498632',
      streamId: this.streamId,
      deleteDiffusion
    });

    if (localBroadcastChannel) {
      try {
        localBroadcastChannel.postMessage({
          type: 'stream-stopped',
          streamId: this.streamId
        });
      } catch (e) {}
    }

    if (this.onStopCallback) {
      this.onStopCallback();
    }
  }

  public getStream(): MediaStream | null {
    return this.localStream;
  }
}

// Viewer connection engine
export class ViewerEngine {
  private pc: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private onStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onFrameCallback: ((frameUrl: string) => void) | null = null;
  private onStatusChange: ((status: string) => void) | null = null;
  private streamId: string = '';

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    socket.on('signal:offer', async (data: { offer: RTCSessionDescriptionInit; from: string }) => {
      await this.handleOffer(data.offer);
    });

    socket.on('signal:ice-candidate', async (data: { candidate: RTCIceCandidateInit }) => {
      if (this.pc && data.candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          // ignore candidate error
        }
      }
    });

    socket.on('broadcast-started', (data: any) => {
      if (data.broadcast?.streamId === this.streamId) {
        if (this.onStatusChange) this.onStatusChange('connecting');
        // Re-announce viewer presence to broadcaster
        socket.send('join-room', { streamId: this.streamId });
      }
    });

    // Auto-reconnect viewer on socket recovery
    socket.on('connected', () => {
      if (this.streamId) {
        socket.send('join-room', { streamId: this.streamId });
      }
    });

    socket.on('stream:frame', (data: { frame: string }) => {
      if (this.onFrameCallback) {
        this.onFrameCallback(data.frame);
      }
    });

    if (localBroadcastChannel) {
      localBroadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'stream-stopped' && event.data.streamId === this.streamId) {
          this.disconnect();
          if (this.onStatusChange) this.onStatusChange('stopped');
        }
      };
    }
  }

  public joinStream(
    streamId: string,
    onStream: (stream: MediaStream) => void,
    onFrame: (frameUrl: string) => void,
    onStatusChange?: (status: string) => void
  ) {
    this.streamId = streamId;
    this.onStreamCallback = onStream;
    this.onFrameCallback = onFrame;
    this.onStatusChange = onStatusChange || null;

    socket.send('join-room', { streamId });
    if (this.onStatusChange) this.onStatusChange('connecting');
  }

  private async handleOffer(offer: RTCSessionDescriptionInit) {
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    this.pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : null;
      if (stream) {
        this.remoteStream = stream;
      } else if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
      if (this.onStreamCallback && this.remoteStream) {
        this.onStreamCallback(this.remoteStream);
      }
      if (this.onStatusChange) this.onStatusChange('live');
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.send('signal:ice-candidate', {
          candidate: event.candidate
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      if (state === 'connected' && this.onStatusChange) {
        this.onStatusChange('live');
      } else if (state === 'disconnected' || state === 'failed') {
        if (this.onStatusChange) this.onStatusChange('fallback');
      }
    };

    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      socket.send('signal:answer', {
        answer: this.pc.localDescription
      });
    } catch (err) {
      // Ignore offer race
    }
  }

  public disconnect() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
    socket.send('leave-room', { streamId: this.streamId });
  }
}

export const broadcaster = new BroadcasterEngine();
export const viewer = new ViewerEngine();
