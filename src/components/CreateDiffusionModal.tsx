import React, { useState, useRef } from 'react';
import { X, Calendar, Clock, Trophy, Image, Sparkles, Upload, Link2, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COMPETITIONS_LIST, Diffusion } from '../types';
import { getTodayIsoString, getOffsetIsoDate, getUpcomingInfo } from '../utils/dateUtils';

interface CreateDiffusionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (diffusion: Diffusion) => void;
}

export const CreateDiffusionModal: React.FC<CreateDiffusionModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  const todayIso = getTodayIsoString();
  const [title, setTitle] = useState('');
  const [competition, setCompetition] = useState(COMPETITIONS_LIST[0]);
  const [dateIso, setDateIso] = useState<string>(todayIso);
  const [time, setTime] = useState('21:00');
  const [coverSource, setCoverSource] = useState<'url' | 'upload'>('url');
  const [coverUrl, setCoverUrl] = useState('');
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upcomingInfo = getUpcomingInfo('', dateIso);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUploadedImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const finalCover = coverSource === 'upload' && uploadedImagePreview ? uploadedImagePreview : coverUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !time.trim()) return;

    const chosenCover = finalCover || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80';

    const formattedDate = dateIso === todayIso
      ? "Aujourd'hui"
      : (dateIso === getOffsetIsoDate(1)
          ? "Demain"
          : new Date(dateIso + 'T12:00:00').toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            }));

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/diffusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'NOVA498632',
          title: title.trim(),
          competition,
          date: formattedDate,
          dateValue: dateIso,
          time: time.trim(),
          coverUrl: chosenCover
        })
      });

      const data = await res.json();
      if (data.success && data.diffusion) {
        onCreated(data.diffusion);
        onClose();
        // Reset form
        setTitle('');
        setDateIso(getTodayIsoString());
        setTime('21:00');
        setCoverUrl('');
        setUploadedImagePreview(null);
      }
    } catch (err) {
      console.error('Failed to create diffusion:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        <div className="relative w-full max-w-xl my-8">
          {/* Petite croix au-dessus */}
          <div className="flex justify-end mb-2">
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="group flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900/90 border border-white/10 text-neutral-300 transition-all hover:bg-neutral-800 hover:text-white hover:scale-105 active:scale-95 shadow-lg"
            >
              <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="overflow-hidden rounded-3xl border border-white/10 bg-[#0c0e12] p-6 sm:p-8 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-white">
                  Créer une diffusion
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configurez la rencontre et personnalisez l'affiche
                </p>
              </div>
              <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Titre du match */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2">
                  Titre de la rencontre
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Paris Saint-Germain vs Olympique de Marseille"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              {/* Championnat / Compétition */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Championnat / Compétition</span>
                </label>
                <select
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                >
                  {COMPETITIONS_LIST.map((comp) => (
                    <option key={comp} value={comp} className="bg-neutral-900 text-white">
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date et Heure avec vrai Calendrier */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Calendrier interactif */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Date de la rencontre (Calendrier)</span>
                      </span>
                      {upcomingInfo?.isUpcoming ? (
                        <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Dans {upcomingInfo.daysUntil}j
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          Aujourd'hui
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        min={todayIso}
                        value={dateIso}
                        onChange={(e) => setDateIso(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Heure */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Heure du coup d'envoi</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="21:00"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                {/* Raccourcis calendrier rapides */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-neutral-400 mr-1 font-medium">Raccourcis :</span>
                  <button
                    type="button"
                    onClick={() => setDateIso(getOffsetIsoDate(0))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dateIso === getOffsetIsoDate(0)
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    Aujourd'hui
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateIso(getOffsetIsoDate(1))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dateIso === getOffsetIsoDate(1)
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:border-amber-500/30'
                    }`}
                  >
                    Demain (+1j)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateIso(getOffsetIsoDate(2))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dateIso === getOffsetIsoDate(2)
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:border-amber-500/30'
                    }`}
                  >
                    +2 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateIso(getOffsetIsoDate(3))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dateIso === getOffsetIsoDate(3)
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:border-amber-500/30'
                    }`}
                  >
                    +3 jours
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateIso(getOffsetIsoDate(7))}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      dateIso === getOffsetIsoDate(7)
                        ? 'bg-amber-500 text-black shadow-sm'
                        : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10 hover:border-amber-500/30'
                    }`}
                  >
                    +1 semaine
                  </button>
                </div>

                {/* Indicateur en direct du badge cover */}
                {upcomingInfo?.isUpcoming ? (
                  <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-black">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-300">
                        Badge cover activé : « Match à venir dans {upcomingInfo.daysUntil} {upcomingInfo.daysUntil === 1 ? 'jour' : 'jours'} »
                      </p>
                      <p className="text-[11px] text-amber-400/80 mt-0.5">
                        Cet icône et ce texte apparaîtront directement sur l'affiche du match sur la page d'accueil.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>Match programmé pour aujourd'hui (diffusion normale sans décompte de jours)</span>
                  </div>
                )}
              </div>

              {/* Cover - Format Paysage (Lien d'image OU Télécharger une image) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Cover (Format paysage)</span>
                  </label>

                  {/* Switch URL vs Upload */}
                  <div className="flex items-center rounded-lg bg-black/60 p-0.5 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setCoverSource('url')}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        coverSource === 'url'
                          ? 'bg-emerald-500 text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Link2 className="h-3 w-3" />
                      <span>Lien d'image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCoverSource('upload')}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        coverSource === 'upload'
                          ? 'bg-emerald-500 text-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Upload className="h-3 w-3" />
                      <span>Télécharger</span>
                    </button>
                  </div>
                </div>

                {coverSource === 'url' ? (
                  <div>
                    <input
                      type="url"
                      placeholder="Collez le lien URL de votre image (ex: https://...)"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none transition-all focus:border-emerald-500"
                    />
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-black/40 p-6 cursor-pointer hover:border-emerald-500/50 hover:bg-black/60 transition-all text-center"
                    >
                      <Upload className="h-7 w-7 text-neutral-400 group-hover:text-emerald-400 mb-2 transition-colors" />
                      <p className="text-xs font-semibold text-neutral-200">
                        Cliquez pour sélectionner une image depuis votre appareil
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        PNG, JPG, WebP (format paysage recommandé)
                      </p>
                    </div>
                  </div>
                )}

                {/* Preview of the chosen cover */}
                {finalCover && (
                  <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 aspect-video bg-black">
                    <img
                      src={finalCover}
                      alt="Aperçu cover"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCoverUrl('');
                          setUploadedImagePreview(null);
                        }}
                        className="rounded-full bg-black/70 p-1.5 text-neutral-300 hover:text-red-400 transition-colors"
                        title="Effacer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-medium">
                      Aperçu paysage 16:9
                    </div>
                  </div>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim()}
                  className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-bold text-black transition-all hover:bg-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:pointer-events-none active:scale-98"
                >
                  {isSubmitting ? 'Publication en cours...' : 'Publier la diffusion'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
