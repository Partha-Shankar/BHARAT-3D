import {
  LayoutDashboard,
  Map as MapIcon,
  Building2,
  AlertOctagon,
  Receipt,
  History,
} from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { to: '/municipality/dashboard', icon: LayoutDashboard, label: 'Compliance Overview' },
  { to: '/municipality/map', icon: MapIcon, label: 'Municipal GIS Map' },
  { to: '/municipality/properties', icon: Building2, label: '3D Property Registry' },
  { to: '/municipality/violations', icon: AlertOctagon, label: 'Bylaw Violations (G+N)' },
  { to: '/municipality/tax', icon: Receipt, label: 'Property Tax Roll' },
  { to: '/municipality/audit', icon: History, label: 'Governance Audit' },
];

export default function MunicipalityLayout() {
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
