import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject } from '../../hooks/useProjects';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FolderPlus, MapPin, ArrowRight, Layers, FileSpreadsheet } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: 'Central Urban Zone - Ward 16 Survey',
    ward_number: 'Ward 16',
    zone_name: 'Central Urban Zone',
    description: 'High-density urban cadastre survey with residential towers, commercial mall, and metro tunnel infrastructure.',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createProject.mutateAsync(formData);
      setIsModalOpen(false);
      navigate(`/surveyor/area?project_id=${created.id}`);
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            3D Cadastral Survey Projects
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage geospatial survey packages, coordinate systems, and 3D property registrations.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <FolderPlus className="w-4 h-4 mr-2" />
          <span>Create New Survey Project</span>
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Project Name & Description</th>
                <th className="py-3 px-4 text-left">Ward & Zone</th>
                <th className="py-3 px-4 text-left">Dataset Version</th>
                <th className="py-3 px-4 text-left">Status</th>
                <th className="py-3 px-4 text-left">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{project.description}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium">{project.ward_number}</div>
                      <div className="text-[10px] text-slate-400">{project.zone_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border text-[11px]">
                        v{project.dataset_version}.0
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          project.status === 'CONFIRMED' || project.status === 'PUBLISHED'
                            ? 'success'
                            : project.status === 'PROCESSING'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {project.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/surveyor/upload?project_id=${project.id}`)}
                      >
                        Upload
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/surveyor/map?project_id=${project.id}`)}
                      >
                        <span>Open 3D Cadastre</span>
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    {isLoading ? 'Loading survey projects...' : 'No survey projects created yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create 3D Cadastral Survey Project</h3>
            <p className="text-xs text-slate-500 mb-4">
              Initialize a spatial project container before delineating the survey boundary and uploading sensor data.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-navy-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Municipal Ward</label>
                  <input
                    type="text"
                    value={formData.ward_number}
                    onChange={(e) => setFormData({ ...formData, ward_number: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-navy-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Zone Name</label>
                  <input
                    type="text"
                    value={formData.zone_name}
                    onChange={(e) => setFormData({ ...formData, zone_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-navy-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Scope & Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs focus:ring-2 focus:ring-navy-700"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={createProject.isPending}>
                  Create & Select Area
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
