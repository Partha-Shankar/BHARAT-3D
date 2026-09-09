import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

// Layouts
import SurveyorLayout from './components/layout/SurveyorLayout';
import MunicipalityLayout from './components/layout/MunicipalityLayout';
import UtilityLayout from './components/layout/UtilityLayout';
import CitizenLayout from './components/layout/CitizenLayout';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage as SurveyorDashboard } from './pages/surveyor/DashboardPage';
import { ProjectsPage } from './pages/surveyor/ProjectsPage';
import { AreaSelectionPage } from './pages/surveyor/AreaSelectionPage';
import { DataUploadPage } from './pages/surveyor/DataUploadPage';
import { ProcessingPage } from './pages/surveyor/ProcessingPage';
import { MapPage } from './pages/surveyor/MapPage';
import { EditorPage } from './pages/surveyor/EditorPage';
import { RegistryPage } from './pages/surveyor/RegistryPage';
import { ViolationsPage } from './pages/shared/ViolationsPage';
import { AuditPage } from './pages/shared/AuditPage';

import { MunicipalDashboard } from './pages/municipality/MunicipalDashboard';
import { ExcavationPage } from './pages/utility/ExcavationPage';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Surveyor & Admin Routes */}
        <Route path="/surveyor" element={<SurveyorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SurveyorDashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="area" element={<AreaSelectionPage />} />
          <Route path="upload" element={<DataUploadPage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="editor" element={<EditorPage />} />
          <Route path="registry" element={<RegistryPage />} />
          <Route path="violations" element={<ViolationsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        {/* Municipality Routes */}
        <Route path="/municipality" element={<MunicipalityLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<MunicipalDashboard />} />
          <Route path="map" element={<MapPage />} />
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
          <Route path="excavation" element={<ExcavationPage />} />
          <Route path="assets" element={<MapPage />} />
        </Route>

        {/* Citizen Portal Routes */}
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CitizenDashboard />} />
          <Route path="tax" element={<CitizenDashboard />} />
          <Route path="documents" element={<CitizenDashboard />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
