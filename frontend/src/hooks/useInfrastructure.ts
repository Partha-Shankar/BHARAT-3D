import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { InfrastructureAsset } from '../types';

export const useInfrastructure = (projectId?: string) => {
  return useQuery({
    queryKey: ['infrastructure', projectId],
    queryFn: async () => {
      const response = await api.get<InfrastructureAsset[]>('/infrastructure', {
        params: { project_id: projectId },
      });
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useInfrastructureAsset = (id?: string) => {
  return useQuery({
    queryKey: ['infrastructure-asset', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<InfrastructureAsset>(`/infrastructure/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};
