import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { Project } from '../types';

const MOCK_PROJECTS: Project[] = [
  { id: 'proj-001', name: 'Central Urban Zone - Ward 16 Survey', description: 'High-density urban cadastre survey with residential towers, commercial mall, and metro tunnel infrastructure.', ward_number: 'Ward 16', zone_name: 'Central Urban Zone', status: 'CONFIRMED', dataset_version: 3, created_at: new Date().toISOString() },
  { id: 'proj-002', name: 'North Suburbs Expansion', description: 'New residential mapping', ward_number: 'Ward 4', zone_name: 'North Zone', status: 'PROCESSING', dataset_version: 1, created_at: new Date().toISOString() },
];

export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/projects');
        return data as Project[];
      } catch (e) {
        return MOCK_PROJECTS;
      }
    },
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        return data as Project;
      } catch (e) {
        return MOCK_PROJECTS.find((p) => p.id === id) || MOCK_PROJECTS[0];
      }
    },
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProject: Partial<Project>) => {
      try {
        const { data } = await api.post('/projects', newProject);
        return data as Project;
      } catch (e) {
        const mock: Project = {
          ...newProject,
          id: 'proj-001',
          status: 'DRAFT',
          dataset_version: 1,
          created_at: new Date().toISOString(),
        } as Project;
        return mock;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const useUpdateProjectArea = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (polygon: any) => {
      const { data } = await api.post(`/projects/${projectId}/area`, { polygon_geojson: polygon });
      return data as { status: string; project_id: number; selected_area_id: string; scene_key: string; center: [number, number] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
};
