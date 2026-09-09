$files = @{
    'src/components/map/Map3D.tsx' = @'
import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    Cesium: any;
  }
}

interface Map3DProps {
  mapMode: string;
}

export default function Map3D({ mapMode }: Map3DProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const viewer = useRef<any>(null);

  useEffect(() => {
    if (viewer.current || !mapContainer.current || !window.Cesium) return;

    window.Cesium.Ion.defaultAccessToken = ''; // Empty string for offline/no token

    viewer.current = new window.Cesium.Viewer(mapContainer.current, {
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      timeline: false,
      navigationHelpButton: false,
      infoBox: false,
      imageryProvider: new window.Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/'
      })
    });

    // Fly to Central Urban Zone
    viewer.current.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(77.2090, 28.6139, 1000.0),
      orientation: {
        heading: window.Cesium.Math.toRadians(0.0),
        pitch: window.Cesium.Math.toRadians(-45.0),
      }
    });

    return () => {
      if (viewer.current) {
        viewer.current.destroy();
        viewer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (viewer.current) {
      viewer.current.scene.globe.translucency.enabled = mapMode === 'underground';
      if (mapMode === 'underground') {
        viewer.current.scene.globe.translucency.frontFaceAlpha = 0.5;
        viewer.current.scene.screenSpaceCameraController.enableCollisionDetection = false;
      } else {
        viewer.current.scene.globe.translucency.frontFaceAlpha = 1.0;
        viewer.current.scene.screenSpaceCameraController.enableCollisionDetection = true;
      }
    }
  }, [mapMode]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
'@

    'src/pages/surveyor/ProcessingPage.tsx' = @'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { CheckCircle2, Clock } from 'lucide-react';

const STAGES = [
  "Upload Validation",
  "File Integrity Verification",
  "Coordinate Reference Detection",
  "CRS Normalization",
  "GIS Parcel Alignment",
  "LiDAR Point Cloud Analysis",
  "Building Extraction",
  "Building Height Estimation",
  "Floor Segmentation",
  "Vertical Space Generation",
  "Infrastructure Extraction",
  "Topology Validation",
  "AI-Assisted Bylaw Analysis",
  "Property Data Linking",
  "3D Map Preparation",
  "Final Quality Check"
];

export default function ProcessingPage() {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage(prev => (prev < STAGES.length ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">Geospatial Analysis In Progress</h1>
      <Card>
        <CardHeader>
          <CardTitle>Processing Stages</CardTitle>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full transition-all duration-1000" style={{ width: `${(currentStage / STAGES.length) * 100}%` }}></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {STAGES.map((stage, idx) => (
              <div key={idx} className="flex items-center">
                {idx < currentStage ? (
                  <CheckCircle2 className="w-5 h-5 text-success mr-3" />
                ) : idx === currentStage ? (
                  <Spinner className="w-5 h-5 text-primary mr-3" />
                ) : (
                  <Clock className="w-5 h-5 text-gray-300 mr-3" />
                )}
                <span className={idx <= currentStage ? 'text-text-primary' : 'text-gray-400'}>{stage}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
'@
}

foreach ($key in $files.Keys) {
    $path = "d:\Bharat 3d\frontend\$key"
    $dir = Split-Path $path -Parent
    if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Set-Content -Path $path -Value $files[$key] -Force
}
