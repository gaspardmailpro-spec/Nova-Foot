export interface Diffusion {
  id: string;
  title: string;
  competition: string;
  time: string; // e.g. "20:45"
  date: string; // e.g. "Aujourd'hui"
  dateValue?: string; // e.g. "2026-10-15" (ISO format for calendar & upcoming calculations)
  coverUrl: string;
  isLive: boolean;
  isFeatured?: boolean;
  statusText?: string;
  currentOverlay?: StreamOverlay;
  teams?: {
    home: string;
    away: string;
    homeLogo?: string;
    awayLogo?: string;
  };
  description?: string;
  viewersCount: number;
}

export type StreamOverlay = 'normal' | 'avant-match' | 'mi-temps' | 'erreur';

export interface ChatMessage {
  id: string;
  diffusionId: string;
  user: string;
  isAdmin: boolean;
  text: string;
  timestamp: string;
  avatarColor?: string;
  isDeleted?: boolean;
}

export interface BroadcastState {
  streamId: string;
  title: string;
  isLive: boolean;
  hasAudio?: boolean;
  quality?: string;
  viewerCount?: number;
}

export type CompetitionCategory =
  | 'Tous'
  | 'Champions League'
  | 'Ligue 1'
  | 'Ligue 2'
  | 'La Liga'
  | 'Premier League'
  | 'Serie A'
  | 'Bundesliga'
  | 'Europa League';

export const COMPETITIONS_LIST = [
  'UEFA Champions League',
  'Ligue 1 McDonald\'s',
  'Ligue 2 BKT',
  'LaLiga EA Sports',
  'Premier League',
  'Serie A',
  'Bundesliga',
  'UEFA Europa League',
  'UEFA Conference League',
  'Coupe de France'
];
