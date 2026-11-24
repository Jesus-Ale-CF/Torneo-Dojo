import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type { AgeGroup, Category, Mat, Registration, Sport, Tournament, WeightDivision, AdminUser } from '@/lib/types';

export const useTournament = (id: string) => useQuery({ queryKey: ['tournament', id], queryFn: () => get<Tournament>(`/tournaments/${id}`) });
export const useSport = (sportId?: string) => useQuery({ queryKey: ['sport', sportId], queryFn: () => get<Sport>(`/sports/${sportId}`), enabled: !!sportId });
export const useCategories = (id: string) => useQuery({ queryKey: ['categories', id], queryFn: () => get<Category[]>(`/tournaments/${id}/categories`) });
export const useDivisions = (id: string) => useQuery({ queryKey: ['divisions', id], queryFn: () => get<WeightDivision[]>(`/tournaments/${id}/weight-divisions`) });
export const useAgeGroups = (id: string) => useQuery({ queryKey: ['ageGroups', id], queryFn: () => get<AgeGroup[]>(`/tournaments/${id}/age-groups`) });
export const useRegistrations = (id: string) => useQuery({ queryKey: ['registrations', id], queryFn: () => get<Registration[]>(`/tournaments/${id}/registrations`) });
export const useMats = (id: string) => useQuery({ queryKey: ['mats', id], queryFn: () => get<Mat[]>(`/tournaments/${id}/mats`) });
export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => get<AdminUser[]>('/users') });
export const invalidateAll = (id: string) => [['tournament', id], ['tournaments'], ['categories', id], ['registrations', id], ['mats', id], ['divisions', id], ['ageGroups', id], ['bracket'], ['public'], ['live'], ['medals']];
