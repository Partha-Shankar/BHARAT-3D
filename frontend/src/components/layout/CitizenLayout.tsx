import { Home, Map as MapIcon } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { to: '/citizen/dashboard', icon: Home, label: 'My property in 3D', also: ['/citizen/tax', '/citizen/documents'] },
  { to: '/citizen/map', icon: MapIcon, label: 'Survey atlas' },
];

export default function CitizenLayout() {
  return (
    <WorkspaceShell
      portalSubtitle="Citizen self-service portal"
      sectionLabel="Citizen workspace"
      navItems={navItems}
      defaultUserName="Priya Mehta"
      defaultRoleLabel="CITIZEN"
    />
  );
}
