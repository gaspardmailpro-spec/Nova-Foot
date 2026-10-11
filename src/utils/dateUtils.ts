/**
 * Utilitaires de gestion des dates et calcul des jours restants pour les matchs
 */

export function getTodayIsoString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetIsoDate(daysOffset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcule le nombre de jours exact entre aujourd'hui (à minuit) et la date du match
 * > 0 : Match futur dans X jours
 * = 0 : Match aujourd'hui
 * < 0 : Match passé
 */
export function getDaysUntil(dateInput?: string, dateValue?: string): number | null {
  if (!dateInput && !dateValue) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Priorité au format ISO strict YYYY-MM-DD
  const isoCandidate = dateValue || dateInput;
  if (isoCandidate && /^\d{4}-\d{2}-\d{2}$/.test(isoCandidate.trim())) {
    const [y, m, d] = isoCandidate.trim().split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  const str = (dateInput || '').trim();

  // 2. Termes français courants
  if (/^aujourd'?hui/i.test(str)) {
    return 0;
  }
  if (/^demain/i.test(str)) {
    return 1;
  }

  // 3. Format DD/MM/YYYY ou DD-MM-YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const d = Number(ddmmyyyyMatch[1]);
    const m = Number(ddmmyyyyMatch[2]);
    const y = Number(ddmmyyyyMatch[3]);
    const target = new Date(y, m - 1, d);
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  // 4. Chaînes "dans X jour(s)"
  const dansMatch = str.match(/dans\s+(\d+)\s+jour/i);
  if (dansMatch) {
    return Number(dansMatch[1]);
  }

  // 5. Tentative de Date.parse standard
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const dObj = new Date(parsed);
    const target = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
    const diffTime = target.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  return null;
}

export interface UpcomingMatchInfo {
  isUpcoming: boolean;
  daysUntil: number;
  badgeLabel: string; // Ex: "Match à venir dans 2 jours"
  shortBadgeLabel: string; // Ex: "Dans 2 jours"
  displayDate: string; // Ex: "Demain" ou "Ven. 16 oct."
}

export function getUpcomingInfo(dateInput?: string, dateValue?: string): UpcomingMatchInfo | null {
  const days = getDaysUntil(dateInput, dateValue);
  if (days === null) return null;

  if (days > 0) {
    const dayWord = days === 1 ? 'jour' : 'jours';
    return {
      isUpcoming: true,
      daysUntil: days,
      badgeLabel: `Match à venir dans ${days} ${dayWord}`,
      shortBadgeLabel: `Dans ${days} ${dayWord}`,
      displayDate: days === 1 ? 'Demain' : `Dans ${days} jours`
    };
  }

  if (days === 0) {
    return {
      isUpcoming: false,
      daysUntil: 0,
      badgeLabel: "Aujourd'hui",
      shortBadgeLabel: "Aujourd'hui",
      displayDate: "Aujourd'hui"
    };
  }

  return {
    isUpcoming: false,
    daysUntil: days,
    badgeLabel: "Terminé",
    shortBadgeLabel: "Terminé",
    displayDate: dateInput || "Terminé"
  };
}

export function formatFrenchDateLong(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const days = getDaysUntil('', isoDate);
  
  const formatted = dateObj.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (days === 0) return `Aujourd'hui (${formatted})`;
  if (days === 1) return `Demain (${formatted})`;
  if (days && days > 1) return `${formatted} (dans ${days} jours)`;
  return formatted;
}
