import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Violation } from '../types';

export const useViolations = (projectId?: string) => {
  return useQuery({
    queryKey: ['violations', projectId],
    queryFn: async () => {
      const response = await api.get<Violation[]>('/violations', {
        params: { project_id: projectId },
      });
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useViolation = (id?: string) => {
  return useQuery({
    queryKey: ['violation', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<Violation>(`/violations/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useBylawAnalysis = (buildingId?: string) => {
  return useQuery({
    queryKey: ['bylaws', buildingId],
    queryFn: async () => {
      if (!buildingId) return null;
      const response = await api.get(`/bylaws/analyze/${buildingId}`);
      return response.data;
    },
    enabled: !!buildingId,
  });
};
