import { LayoutDashboard, Map as MapIcon, HardHat, Network } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { to: '/utility/dashboard', icon: LayoutDashboard, label: 'Utility Dashboard' },
  { to: '/utility/excavation', icon: HardHat, label: 'Excavation Risk Safety' },
  { to: '/utility/map', icon: MapIcon, label: 'Underground Infrastructure' },
  { to: '/utility/assets', icon: Network, label: 'Subsurface Assets' },
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
