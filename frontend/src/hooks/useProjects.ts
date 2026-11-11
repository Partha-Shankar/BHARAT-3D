import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

/** Records the drawn survey polygon on the project (surveyors and admins; the 3D scene comes from /realgen/generate). */
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
