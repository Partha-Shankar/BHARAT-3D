$files = @{
    'src/App.tsx' = @'
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SurveyorLayout from './components/layout/SurveyorLayout';
import DashboardPage from './pages/surveyor/DashboardPage';

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/surveyor/*" element={<SurveyorLayout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
'@

    'src/pages/LoginPage.tsx' = @'
import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuthStore();

  if (isAuthenticated && user) {
    return <Navigate to={`/${user.role.toLowerCase()}/dashboard`} replace />;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-primary">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">BHARAT 3D</CardTitle>
          <p className="text-text-secondary">Government Spatial Information Platform</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button onClick={() => login('surveyor@gov.in', 'SURVEYOR')}>Login as Surveyor</Button>
            <Button variant="secondary" onClick={() => login('muni@gov.in', 'MUNICIPALITY')}>Login as Municipality</Button>
            <Button variant="secondary" onClick={() => login('util@gov.in', 'UTILITY_OPERATOR')}>Login as Utility</Button>
            <Button variant="ghost" onClick={() => login('citizen@gov.in', 'CITIZEN')}>Login as Citizen</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
'@

    'src/components/layout/SurveyorLayout.tsx' = @'
import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LogOut, LayoutDashboard } from 'lucide-react';

export default function SurveyorLayout() {
  const { user, logout } = useAuthStore();
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-text flex flex-col">
        <div className="p-4 flex items-center justify-center border-b border-sidebar-text/20">
          <h1 className="text-xl font-bold text-white tracking-widest">BHARAT 3D</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1">
            <li><Link to="/surveyor/dashboard" className="flex items-center px-4 py-2 hover:bg-sidebar-text/10 text-white"><LayoutDashboard className="w-5 h-5 mr-3" /> Dashboard</Link></li>
          </ul>
        </nav>
        <div className="p-4 border-t border-sidebar-text/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">{user?.full_name}</p>
              <p className="text-xs text-sidebar-text/70">{user?.role}</p>
            </div>
            <button onClick={logout} className="text-sidebar-text/70 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden text-text-primary">
        <Outlet />
      </main>
    </div>
  );
}
'@

    'src/pages/surveyor/DashboardPage.tsx' = @'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Map2D from '../../components/map/Map2D';

export default function DashboardPage() {
  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Surveyor Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle>Total Parcels</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">130</p></CardContent></Card>
        <Card><CardHeader><CardTitle>3D Buildings</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">64</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Vertical Units</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">884</p></CardContent></Card>
      </div>
      <div className="flex-1 min-h-[400px] border rounded-lg overflow-hidden relative">
         <Map2D mapMode="2d" />
      </div>
    </div>
  );
}
'@

    'src/components/map/Map2D.tsx' = @'
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface Map2DProps {
  mapMode: string;
}

export default function Map2D({ mapMode }: Map2DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          }
        ]
      },
      center: [77.2090, 28.6139], // Delhi
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

  }, []);

  return <div ref={mapContainer} className="w-full h-full" />;
}
'@
}

foreach ($key in $files.Keys) {
    $path = "d:\Bharat 3d\frontend\$key"
    $dir = Split-Path $path -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -Path $path -Value $files[$key] -Force
}
