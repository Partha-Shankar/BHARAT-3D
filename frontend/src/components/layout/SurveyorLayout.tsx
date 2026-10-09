import {
  LayoutDashboard, Map as MapIcon, MapPinned, FolderUp, FolderKanban, PencilRuler, Fingerprint, ShieldAlert, History,
} from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';
import { useSurveyDraft, readyCount } from '../../survey/draft';
import { DATASET_SLOTS } from '../../survey/datasets';
import { useScenes } from '../../survey/ui';

export default function SurveyorLayout() {
  const draft = useSurveyDraft((s) => s.draft);
  const { data: scenes } = useScenes();
  const findings = scenes?.reduce((a, s) => a + (s.violations || 0), 0);
  const navItems = [
    { group: 'Overview', to: '/surveyor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { group: 'Overview', to: '/surveyor/map', icon: MapIcon, label: 'Survey atlas' },
    { group: 'Survey', to: '/surveyor/area', icon: MapPinned, label: 'New survey' },
    { group: 'Survey', to: '/surveyor/upload', icon: FolderUp, label: 'Data ingestion', also: ['/surveyor/generate'],
      badge: draft ? `${readyCount(draft, DATASET_SLOTS.length)}/${DATASET_SLOTS.length}` : undefined },
    { group: 'Survey', to: '/surveyor/projects', icon: FolderKanban, label: 'Surveyed areas', also: ['/surveyor/scenes'], badge: scenes?.length },
    { group: 'Survey', to: '/surveyor/editor', icon: PencilRuler, label: '3D editor' },
    { group: 'Land record', to: '/surveyor/registry', icon: Fingerprint, label: '3D ULPIN registry' },
    { group: 'Land record', to: '/surveyor/violations', icon: ShieldAlert, label: 'Findings', badge: findings || undefined },
    { group: 'Land record', to: '/surveyor/audit', icon: History, label: 'Activity log' },
  ];
  return (
    <WorkspaceShell
      portalSubtitle="Surveyor cadastre studio"
      sectionLabel="Surveyor workspace"
      navItems={navItems}
      defaultUserName="Demo Surveyor"
      defaultRoleLabel="SURVEYOR"
    />
  );
}
