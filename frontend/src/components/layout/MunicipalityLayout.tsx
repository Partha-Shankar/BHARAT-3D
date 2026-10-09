import { LayoutDashboard, Map as MapIcon, ShieldAlert, Fingerprint, FolderKanban, History } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';
import { useScenes } from '../../survey/ui';

export default function MunicipalityLayout() {
  const { data: scenes } = useScenes();
  const findings = scenes?.reduce((a, s) => a + (s.violations || 0), 0);
  const navItems = [
    { group: 'Overview', to: '/municipality/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { group: 'Overview', to: '/municipality/map', icon: MapIcon, label: 'Survey atlas' },
    { group: 'Enforcement', to: '/municipality/violations', icon: ShieldAlert, label: 'Findings', also: ['/municipality/compliance'], badge: findings || undefined },
    { group: 'Enforcement', to: '/municipality/registry', icon: Fingerprint, label: '3D ULPIN registry', also: ['/municipality/properties'] },
    { group: 'Enforcement', to: '/municipality/projects', icon: FolderKanban, label: 'Surveyed areas' },
    { group: 'Governance', to: '/municipality/audit', icon: History, label: 'Activity log' },
  ];
  return (
    <WorkspaceShell
      portalSubtitle="Municipal compliance portal"
      sectionLabel="Municipality workspace"
      navItems={navItems}
      defaultUserName="Municipal Officer"
      defaultRoleLabel="MUNICIPALITY"
    />
  );
}
