import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PublicPageShell } from './components/layout/PageTransition';

// Layouts
import SurveyorLayout from './components/layout/SurveyorLayout';
import MunicipalityLayout from './components/layout/MunicipalityLayout';
import UtilityLayout from './components/layout/UtilityLayout';
import CitizenLayout from './components/layout/CitizenLayout';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PrivacyPolicyPage } from './pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/legal/TermsOfServicePage';

import { DashboardPage as SurveyorDashboard } from './pages/surveyor/DashboardPage';
import { ProjectsPage } from './pages/surveyor/ProjectsPage';
import { AreaSelectionPage } from './pages/surveyor/AreaSelectionPage';
import { DataUploadPage } from './pages/surveyor/DataUploadPage';
import { ProcessingPage } from './pages/surveyor/ProcessingPage';
import { MapPage } from './pages/surveyor/MapPage';
import { EditorPage } from './pages/surveyor/EditorPage';
import { Full3DWorldPage } from './pages/surveyor/Full3DWorldPage';
import { RegistryPage } from './pages/surveyor/RegistryPage';
import { ViolationsPage } from './pages/shared/ViolationsPage';
import { AuditPage } from './pages/shared/AuditPage';

import { MunicipalDashboard } from './pages/municipality/MunicipalDashboard';
import { ExcavationPage } from './pages/utility/ExcavationPage';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route element={<PublicPageShell />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<LandingPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        {/* Full-screen 3D Mini-City Digital Twin routes (No layout chrome/sidebars) */}
        <Route path="/3d-space/:areaId" element={<Full3DWorldPage />} />
        <Route path="/3d-space" element={<Full3DWorldPage />} />

        {/* Surveyor & Admin Routes */}
        <Route path="/surveyor" element={<SurveyorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SurveyorDashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="area" element={<AreaSelectionPage />} />
          <Route path="upload" element={<DataUploadPage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="3d-viewer" element={<Full3DWorldPage />} />
          <Route path="3d-space/:areaId" element={<Full3DWorldPage />} />
          <Route path="3d-space" element={<Full3DWorldPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        {/* Global 3D Viewer Route */}
        <Route path="/3d-viewer" element={<Full3DWorldPage />} />

        {/* Municipality Routes */}
        <Route path="/municipality" element={<MunicipalityLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MunicipalDashboard />} />
          <Route path="map" element={<MapPage />} />
          <Route path="3d-viewer" element={<Full3DWorldPage />} />
          <Route path="3d-space" element={<Full3DWorldPage />} />
          <Route path="properties" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="compliance" element={<ViolationsPage />} />
          <Route path="tax" element={<MunicipalDashboard />} />
          <Route path="infrastructure" element={<MapPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        {/* Utility Operator Routes */}
        <Route path="/utility" element={<UtilityLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ExcavationPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="3d-viewer" element={<Full3DWorldPage />} />
          <Route path="3d-space" element={<Full3DWorldPage />} />
          <Route path="excavation" element={<ExcavationPage />} />
          <Route path="assets" element={<MapPage />} />
        </Route>

        {/* Citizen Portal Routes */}
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CitizenDashboard />} />
          <Route path="3d-viewer" element={<Full3DWorldPage />} />
          <Route path="3d-space" element={<Full3DWorldPage />} />
          <Route path="tax" element={<CitizenDashboard />} />
          <Route path="documents" element={<CitizenDashboard />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
