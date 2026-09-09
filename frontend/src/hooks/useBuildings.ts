import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { Building, Floor } from '../types';

export const useBuildings = (projectId?: string) => {
  return useQuery({
    queryKey: ['buildings', projectId],
    queryFn: async () => {
      const response = await api.get<Building[]>('/buildings', {
        params: { project_id: projectId },
      });
      return response.data;
    },
    enabled: !!projectId,
  });
};

export const useBuilding = (buildingId?: string) => {
  return useQuery({
    queryKey: ['building', buildingId],
    queryFn: async () => {
      if (!buildingId) return null;
      const response = await api.get<Building>(`/buildings/${buildingId}`);
      return response.data;
    },
    enabled: !!buildingId,
  });
};

export const useBuildingFloors = (buildingId?: string) => {
  return useQuery({
    queryKey: ['building-floors', buildingId],
    queryFn: async () => {
      if (!buildingId) return [];
      const response = await api.get<Floor[]>(`/buildings/${buildingId}/floors`);
      return response.data;
    },
    enabled: !!buildingId,
  });
};
