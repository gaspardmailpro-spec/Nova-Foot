import React from 'react';
import { Play, Clock, Eye, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { Diffusion } from '../types';
import { getUpcomingInfo } from '../utils/dateUtils';

interface MatchCardProps {
  diffusion: Diffusion;
  onClick: () => void;
  isAdmin?: boolean;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  diffusion,
  onClick,
  isAdmin
}) => {
  const upcomingInfo = getUpcomingInfo(diffusion.date, diffusion.dateValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/8 bg-[#0c0d11] transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_12px_40px_-15px_rgba(16,185,129,0.2)]"
    >
      {/* Landscape 16:9 Cover Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
        <img
          src={diffusion.coverUrl}
          alt={diffusion.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Ambient Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d11] via-black/40 to-black/20" />

        {/* Top Badges / Indicators */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            {diffusion.isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                </span>
                DIRECT
              </span>
            ) : upcomingInfo?.isUpcoming ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/90 text-black px-2.5 py-1 text-[11px] font-bold shadow-lg backdrop-blur-md border border-amber-300/50">
                <Calendar className="h-3 w-3 fill-black/20 text-black" />
                <span>Dans {upcomingInfo.daysUntil} {upcomingInfo.daysUntil === 1 ? 'jour' : 'jours'}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-neutral-300 border border-white/10 backdrop-blur-md">
                <Clock className="h-3 w-3 text-emerald-400" />
                {diffusion.time}
              </span>
            )}
            {diffusion.isFeatured && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-md">
                ★ À la une
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {diffusion.isLive ? (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-neutral-300 border border-white/10 backdrop-blur-md">
                <Eye className="h-3 w-3 text-emerald-400" />
                {diffusion.viewersCount}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-neutral-300 border border-white/10 backdrop-blur-md">
                <Clock className="h-3 w-3 text-emerald-400" />
                {diffusion.time}
              </span>
            )}
          </div>
        </div>

        {/* Badge sur la cover : "Match à venir dans ... jours" si date future */}
        {upcomingInfo?.isUpcoming && !diffusion.isLive && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 px-3 py-1.5 text-xs font-black text-black shadow-[0_4px_25px_rgba(245,158,11,0.45)] backdrop-blur-md border border-amber-200/60 transition-transform group-hover:scale-105">
            <Calendar className="h-3.5 w-3.5 fill-black/20 text-black stroke-[2.4]" />
            <span>Match à venir dans {upcomingInfo.daysUntil} {upcomingInfo.daysUntil === 1 ? 'jour' : 'jours'}</span>
          </div>
        )}

        {/* Hover Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/90 text-black shadow-xl backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Content Details */}
      <div className="p-4 sm:p-5">
        {/* Unboxed clean metadata with subtle dot */}
        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1.5 font-medium">
          <span className="text-emerald-400">{diffusion.competition}</span>
          <span aria-hidden="true" className="text-neutral-600">·</span>
          <span className={upcomingInfo?.isUpcoming ? 'text-amber-400 font-semibold' : ''}>
            {upcomingInfo?.isUpcoming ? `Dans ${upcomingInfo.daysUntil}j (${diffusion.date})` : diffusion.date}
          </span>
        </div>

        {/* Match Title */}
        <h3 className="text-base font-bold text-white transition-colors group-hover:text-emerald-400 line-clamp-1">
          {diffusion.title}
        </h3>

        {/* Subtle Match info / time */}
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-white/5 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${upcomingInfo?.isUpcoming ? 'bg-amber-400' : 'bg-emerald-500'}`}></span>
            <span>Flux Haute Définition</span>
          </div>
          <span className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
            {isAdmin 
              ? 'Lancer le live →' 
              : diffusion.isLive 
                ? 'Rejoindre →' 
                : upcomingInfo?.isUpcoming 
                  ? `Dans ${upcomingInfo.daysUntil}j à ${diffusion.time} →` 
                  : `Coup d'envoi ${diffusion.time} →`}
          </span>
        </div>
      </div>
    </motion.div>
  );
};
