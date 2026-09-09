import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { ProcessingJob } from '../types';

export const useProcessingJob = (jobId?: string) => {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const response = await api.get<ProcessingJob>(`/jobs/${jobId}`);
      return response.data;
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'COMPLETE' || data.status === 'FAILED')) {
        return false;
      }
      return 1500;
    },
  });
};

export const useStartProcessing = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.post<{ job_id: string; status: string }>(`/projects/${projectId}/process`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    },
  });
};
