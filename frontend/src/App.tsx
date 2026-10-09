import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PublicPageShell } from './components/layout/PageTransition';
import { useRoleBase } from './survey/ui';

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

import { DashboardPage } from './pages/surveyor/DashboardPage';
import { AreaSelectionPage } from './pages/surveyor/AreaSelectionPage';
import { GenerationPage } from './pages/surveyor/GenerationPage';
import { ScenesPage } from './pages/surveyor/ScenesPage';
import { WorldPage } from './pages/world/WorldPage';
import { DataUploadPage } from './pages/surveyor/DataUploadPage';
import { MapPage } from './pages/surveyor/MapPage';
import { EditorPage } from './pages/surveyor/EditorPage';
import { RegistryPage } from './pages/surveyor/RegistryPage';
import { ViolationsPage } from './pages/shared/ViolationsPage';
import { AuditPage } from './pages/shared/AuditPage';
import { DigSafePage } from './pages/utility/DigSafePage';
import { CitizenPortal } from './pages/citizen/CitizenPortal';

/** Old links (the prepared demo ward, the simulated processing page) land on the role's survey atlas. */
const ToRoleAtlas: React.FC = () => <Navigate to={`${useRoleBase()}/map`} replace />;

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
        {/* Full-screen 3D world generated from a surveyed polygon, and its editor */}
        <Route path="/3d-world/:key" element={<WorldPage />} />
        <Route path="/3d-editor/:key" element={<WorldPage editor />} />
        <Route path="/3d-space/*" element={<ToRoleAtlas />} />
        <Route path="/3d-viewer" element={<ToRoleAtlas />} />

        {/* Surveyor & Admin */}
        <Route path="/surveyor" element={<SurveyorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="area" element={<AreaSelectionPage />} />
          <Route path="upload" element={<DataUploadPage />} />
          <Route path="generate" element={<GenerationPage />} />
          <Route path="projects" element={<ScenesPage />} />
          <Route path="scenes" element={<ScenesPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="processing" element={<Navigate to="/surveyor/upload" replace />} />
          <Route path="3d-viewer" element={<Navigate to="/surveyor/map" replace />} />
          <Route path="3d-space/*" element={<Navigate to="/surveyor/map" replace />} />
        </Route>

        {/* Municipality */}
        <Route path="/municipality" element={<MunicipalityLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="compliance" element={<ViolationsPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="properties" element={<RegistryPage />} />
          <Route path="projects" element={<ScenesPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="/municipality/dashboard" replace />} />
        </Route>

        {/* Utility operator */}
        <Route path="/utility" element={<UtilityLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="assets" element={<MapPage />} />
          <Route path="excavation" element={<DigSafePage />} />
          <Route path="projects" element={<ScenesPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="*" element={<Navigate to="/utility/dashboard" replace />} />
        </Route>

        {/* Citizen */}
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CitizenPortal />} />
          <Route path="tax" element={<CitizenPortal />} />
          <Route path="documents" element={<CitizenPortal />} />
          <Route path="map" element={<MapPage />} />
          <Route path="projects" element={<ScenesPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="*" element={<Navigate to="/citizen/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
