import { LayoutDashboard, Map as MapIcon, Pickaxe, FolderKanban } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { group: 'Overview', to: '/utility/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { group: 'Overview', to: '/utility/map', icon: MapIcon, label: 'Survey atlas', also: ['/utility/assets'] },
  { group: 'Works', to: '/utility/excavation', icon: Pickaxe, label: 'Dig-safe planning' },
  { group: 'Works', to: '/utility/projects', icon: FolderKanban, label: 'Surveyed areas' },
];

export default function UtilityLayout() {
  return (
    <WorkspaceShell
      portalSubtitle="Utility & excavation portal"
      sectionLabel="Utility operator workspace"
      navItems={navItems}
      defaultUserName="Utility Contractor"
      defaultRoleLabel="UTILITY_OPERATOR"
    />
  );
}
