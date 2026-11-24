import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import type { Bracket, Category, LiveMat, Match, Medals, PublicTournament } from './types';

const LIVE = 5000;
export const usePublicTournaments = () => useQuery({ queryKey: ['public', 'tournaments'], queryFn: () => get<PublicTournament[]>('/public/tournaments') });
export const usePublicTournament = (id?: string) => useQuery({ queryKey: ['public', 'tournament', id], queryFn: () => get<PublicTournament>(`/public/tournaments/${id}`), enabled: !!id });
export const usePublicCategories = (id?: string, live = false) => useQuery({ queryKey: ['public', 'categories', id], queryFn: () => get<Category[]>(`/public/tournaments/${id}/categories`), enabled: !!id, refetchInterval: live ? LIVE * 3 : false });
export const usePublicBracket = (cid?: string, live = true) => useQuery({ queryKey: ['public', 'bracket', cid], queryFn: () => get<Bracket>(`/public/categories/${cid}/bracket`), enabled: !!cid, refetchInterval: live ? LIVE : false });
export const useLiveMats = (id?: string, live = true) => useQuery({ queryKey: ['live', id], queryFn: () => get<LiveMat[]>(`/tournaments/${id}/mats/live`), enabled: !!id, refetchInterval: live ? LIVE : false });
export const useMedals = (id?: string, live = true) => useQuery({ queryKey: ['medals', id], queryFn: () => get<Medals>(`/tournaments/${id}/medals`), enabled: !!id, refetchInterval: live ? LIVE * 3 : false });
export const usePublicMatches = (id?: string, matId?: string) => useQuery({ queryKey: ['public', 'matches', id, matId], queryFn: () => get<Match[]>(`/public/tournaments/${id}/matches${matId ? `?matId=${matId}` : ''}`), enabled: !!id, refetchInterval: LIVE });
