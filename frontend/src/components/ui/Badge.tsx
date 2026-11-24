import type { ReactNode } from 'react';
import { Check, CircleDashed, Play, Flag, Ban, Scale, AlertTriangle, Lock, FileEdit, ClipboardList } from 'lucide-react';
import type { CategoryStatus, MatchStatus, TournamentStatus, WeighInStatus } from '@/lib/types';
import { CATEGORY_STATUS, MATCH_STATUS, TOURNAMENT_STATUS, WEIGH } from '@/lib/format';

type Tone = 'neutral' | 'ai' | 'shu' | 'tatami' | 'gold' | 'warn';
const tones: Record<Tone, string> = {
  neutral: 'bg-elevated text-ink border-line',
  ai: 'bg-ai/10 text-ai border-ai/30',
  shu: 'bg-shu/10 text-shu border-shu/30',
  tatami: 'bg-tatami/10 text-tatami border-tatami/30',
  gold: 'bg-gold/15 text-gold border-gold/40',
  warn: 'bg-warn/10 text-warn border-warn/40',
};
export function Badge({ tone = 'neutral', children, icon, className = '' }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
const i = 'h-3.5 w-3.5';
export function TournamentBadge({ status }: { status: TournamentStatus }) {
  const m: Record<TournamentStatus, [Tone, ReactNode]> = { DRAFT: ['neutral', <FileEdit className={i} />], REGISTRATION: ['ai', <ClipboardList className={i} />], WEIGH_IN: ['warn', <Scale className={i} />], IN_PROGRESS: ['tatami', <Play className={i} />], FINISHED: ['gold', <Flag className={i} />] };
  return <Badge tone={m[status][0]} icon={m[status][1]}>{TOURNAMENT_STATUS[status]}</Badge>;
}
export function CategoryBadge({ status }: { status: CategoryStatus }) {
  const m: Record<CategoryStatus, [Tone, ReactNode]> = { OPEN: ['neutral', <ClipboardList className={i} />], BRACKET_READY: ['ai', <Lock className={i} />], IN_PROGRESS: ['tatami', <Play className={i} />], FINISHED: ['gold', <Flag className={i} />] };
  return <Badge tone={m[status][0]} icon={m[status][1]}>{CATEGORY_STATUS[status]}</Badge>;
}
export function WeighBadge({ status }: { status: WeighInStatus }) {
  const m: Record<WeighInStatus, [Tone, ReactNode]> = { PENDING: ['neutral', <CircleDashed className={i} />], OK: ['tatami', <Check className={i} />], OVERWEIGHT: ['warn', <AlertTriangle className={i} />], UNDERWEIGHT: ['warn', <AlertTriangle className={i} />], DISQUALIFIED: ['shu', <Ban className={i} />] };
  return <Badge tone={m[status][0]} icon={m[status][1]}>{WEIGH[status]}</Badge>;
}
export function MatchBadge({ status }: { status: MatchStatus }) {
  const m: Record<MatchStatus, [Tone, ReactNode]> = { PENDING: ['neutral', <CircleDashed className={i} />], IN_PROGRESS: ['tatami', <Play className={i} />], FINISHED: ['gold', <Check className={i} />], BYE: ['neutral', <CircleDashed className={i} />] };
  return <Badge tone={m[status][0]} icon={m[status][1]}>{MATCH_STATUS[status]}</Badge>;
}
