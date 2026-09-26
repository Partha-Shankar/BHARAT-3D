import {
  LayoutDashboard,
  FolderKanban,
  Map as MapIcon,
  UploadCloud,
  Box,
  FileCheck2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { WorkspaceShell } from './WorkspaceShell';

const navItems = [
  { to: '/surveyor/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/surveyor/projects', icon: FolderKanban, label: 'Projects & Survey' },
  { to: '/surveyor/map', icon: MapIcon, label: '2D/3D Cadastre Map' },
  { to: '/surveyor/upload', icon: UploadCloud, label: 'Data Ingestion' },
  { to: '/surveyor/editor', icon: Box, label: '3D Cadastre Editor' },
  { to: '/surveyor/registry', icon: FileCheck2, label: '3D Property Registry' },
  { to: '/surveyor/violations', icon: AlertTriangle, label: 'Bylaw Violations' },
  { to: '/surveyor/audit', icon: History, label: 'Audit Trail' },
];

export default function SurveyorLayout() {
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
