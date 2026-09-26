import { Home, Receipt, FileText } from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { to: '/citizen/dashboard', icon: Home, label: 'My Registered Property' },
  { to: '/citizen/tax', icon: Receipt, label: 'Property Tax & Dues' },
  { to: '/citizen/documents', icon: FileText, label: 'Title Deeds & Records' },
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
