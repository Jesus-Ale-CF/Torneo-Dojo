export type Role = 'ADMIN' | 'TABLE';
export type Gender = 'M' | 'F' | 'X';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'WEIGH_IN' | 'IN_PROGRESS' | 'FINISHED';
export type BracketFormat = 'SINGLE_ELIMINATION' | 'SINGLE_ELIMINATION_BRONZE' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN';
export type CategoryStatus = 'OPEN' | 'BRACKET_READY' | 'IN_PROGRESS' | 'FINISHED';
export type WeighInStatus = 'PENDING' | 'OK' | 'OVERWEIGHT' | 'UNDERWEIGHT' | 'DISQUALIFIED';
export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'FINISHED' | 'BYE';

export interface User { id: string; email: string; name: string; role: Role; mats: { id: string; name: string; tournamentId: string; tournamentName?: string }[] }
export interface AdminUser extends Omit<User, 'mats'> { active: boolean; createdAt: string; mats: { id: string; name: string; tournamentId: string; tournamentName: string }[] }
export interface Belt { id: string; name: string; color: string; secondary: string | null; order?: number }
export interface VictoryMethod { id: string; code: string; name: string; order?: number; points?: number }
export interface Sport { id: string; name: string; slug: string; defaultDurationSec: number; description: string | null; victoryMethods: VictoryMethod[]; beltLevels: Belt[]; _count?: { tournaments: number } }
export interface Tournament {
  id: string; name: string; venue: string; city: string | null; startDate: string; endDate: string; status: TournamentStatus; sportId: string;
  sport: { id: string; name: string; slug: string }; pointsGold: number; pointsSilver: number; pointsBronze: number; description: string | null;
  _count: { categories: number; registrations: number; mats: number };
}
export interface PublicTournament extends Omit<Tournament, 'sport' | '_count' | 'sportId' | 'pointsGold' | 'pointsSilver' | 'pointsBronze'> {
  sport: { id: string; name: string; slug: string; victoryMethods: VictoryMethod[]; beltLevels: Belt[] };
  mats: Mat[]; _count: { categories: number; registrations: number };
}
export interface WeightDivision { id: string; name: string; minKg: number | null; maxKg: number | null; gender: Gender | null; order: number }
export interface AgeGroup { id: string; name: string; minAge: number; maxAge: number; order: number }
export interface Category {
  id: string; tournamentId: string; name: string; gender: Gender; weightDivision: Pick<WeightDivision, 'id' | 'name' | 'minKg' | 'maxKg'> | null;
  ageGroup: Pick<AgeGroup, 'id' | 'name' | 'minAge' | 'maxAge'> | null; beltLevel: Belt | null; belts: { belt: Belt }[]; format: BracketFormat; status: CategoryStatus;
  avoidSameAcademy: boolean; tiebreakRules: string; matId: string | null; mat: { id: string; name: string } | null; scheduledAt: string | null; order: number; durationSec: number | null;
  _count: { registrations: number; matches: number };
}
export interface Academy { id: string; name: string; abbreviation: string | null; city: string | null; color: string | null; _count: { athletes: number } }
export interface Athlete {
  id: string; firstName: string; lastName: string; document: string; birthDate: string; gender: Gender; beltLevelId: string | null; beltLevel: Belt | null;
  academyId: string | null; academy: { id: string; name: string; abbreviation: string | null } | null; email: string | null; phone: string | null; _count?: { registrations: number };
}
export interface Registration {
  id: string; tournamentId: string; athleteId: string; categoryId: string | null; declaredWeight: number | null; weightKg: number | null; weighInStatus: WeighInStatus;
  weighedAt: string | null; seed: number | null; notes: string | null;
  athlete: { id: string; firstName: string; lastName: string; document: string; birthDate: string; gender: Gender; beltLevel: Belt | null; academy: { id: string; name: string; abbreviation: string | null } | null };
  category: { id: string; name: string; status: string; weightDivision: Pick<WeightDivision, 'id' | 'name' | 'minKg' | 'maxKg'> | null } | null;
}
export interface CategorySuggestion { id: string; name: string; status: string; weightDivision: Pick<WeightDivision, 'id' | 'name' | 'minKg' | 'maxKg'> | null; _count: { registrations: number } }
export interface Mat {
  id: string; tournamentId?: string; name: string; order: number; color: string | null;
  assignments?: { user: { id: string; name: string; email: string } }[];
  categories?: { id: string; name: string; status: string; scheduledAt: string | null; order: number; _count: { matches: number; registrations: number } }[];
  _count?: { matches: number };
}
export interface RegMini { id: string; seed: number | null; weighInStatus: string; athlete: { id: string; firstName: string; lastName: string; academy: { id: string; name: string; abbreviation: string | null } | null; beltLevel: Belt | null } }
export interface Match {
  id: string; categoryId: string; side: 'WINNERS' | 'LOSERS' | 'GRAND_FINAL' | 'THIRD_PLACE' | 'ROUND_ROBIN'; round: number; position: number; label: string | null; order: number;
  redId: string | null; blueId: string | null; winnerId: string | null; victoryMethodId: string | null; red: RegMini | null; blue: RegMini | null;
  victoryMethod: { id: string; code: string; name: string } | null; status: MatchStatus; nextMatchId: string | null; nextSlot: string | null; loserNextId: string | null; loserNextSlot: string | null;
  matId: string | null; mat: { id: string; name: string } | null; matOrder: number | null; scheduledAt: string | null; startedAt: string | null; finishedAt: string | null;
  category: { id: string; name: string; tournamentId: string; format: BracketFormat; durationSec: number | null };
}
export interface Podium { gold: string | null; silver: string | null; bronze: string[]; complete: boolean }
export interface Standing { participantId: string; played: number; wins: number; losses: number; methodPoints: number; rank: number }
export interface Bracket {
  category: {
    id: string; name: string; gender: Gender; format: BracketFormat; status: string; tiebreakRules: string; durationSec: number | null;
    weightDivision: Pick<WeightDivision, 'id' | 'name' | 'minKg' | 'maxKg'> | null; ageGroup: { id: string; name: string } | null; beltLevel: Belt | null; mat: { id: string; name: string } | null;
    tournament: { id: string; name: string; sport: { id: string; name: string; victoryMethods: VictoryMethod[] } }; registrations: RegMini[];
  };
  matches: Match[]; podium: Podium; standings: Standing[] | null;
}
export interface LiveMat { mat: { id: string; name: string; color: string | null; order: number }; current: Match | null; upcoming: Match[]; remaining: number; finished: number }
export interface MedalEntry { registrationId: string; athlete: { id: string; firstName: string; lastName: string; academy: { id: string; name: string; abbreviation: string | null } | null; beltLevel: Belt | null } }
export interface Medals {
  tournament: { id: string; name: string; pointsGold: number; pointsSilver: number; pointsBronze: number };
  byCategory: { category: { id: string; name: string; status: string; format: string }; complete: boolean; gold: MedalEntry | null; silver: MedalEntry | null; bronze: MedalEntry[] }[];
  academies: { academyId: string; academyName: string; gold: number; silver: number; bronze: number; points: number; rank: number }[];
}
export interface Audit { id: string; matchId: string; createdAt: string; reason: string | null; user: { id: string; name: string } | null; previousWinnerId: string | null; previousMethodId: string | null; previousStatus: string | null; newWinnerId: string | null; newMethodId: string | null; newStatus: string | null; match?: { id: string; label: string | null; category: { id: string; name: string } } }
