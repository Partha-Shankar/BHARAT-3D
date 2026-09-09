import { create } from 'zustand';
import { Project } from '../types';

export type MapMode = '2d' | '3d' | 'underground' | 'hybrid';

interface AppState {
  activeProject: Project | null;
  setActiveProject: (project: Project | null) => void;
  selectedAreaId: string;
  setSelectedAreaId: (areaId: string) => void;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  selectedFeature: any | null;
  setSelectedFeature: (feature: any | null) => void;
  editorMode: string | null;
  setEditorMode: (mode: string | null) => void;
  selectedFloor: number | null;
  setSelectedFloor: (floor: number | null) => void;
  selectedUnit: string | null;
  setSelectedUnit: (unit: string | null) => void;
  editorActive: boolean;
  setEditorActive: (active: boolean) => void;
  activeDatasetVersion: number;
  setActiveDatasetVersion: (version: number) => void;
  customSurveyPolygon: any | null;
  setCustomSurveyPolygon: (polygon: any | null) => void;
}

const getInitialPolygon = () => {
  try {
    const saved = localStorage.getItem('bharat3d_custom_polygon');
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

export const useAppStore = create<AppState>((set) => ({
  activeProject: null,
  setActiveProject: (project) => set({ activeProject: project }),
  selectedAreaId: 'area_01',
  setSelectedAreaId: (areaId) => set({ selectedAreaId: areaId }),
  mapMode: '3d',
  setMapMode: (mode) => set({ mapMode: mode }),
  selectedFeature: null,
  setSelectedFeature: (feature) => set({ selectedFeature: feature }),
  editorMode: null,
  setEditorMode: (mode) => set({ editorMode: mode }),
  selectedFloor: 8,
  setSelectedFloor: (floor) => set({ selectedFloor: floor }),
  selectedUnit: 'VPR-BLD0101-F08-U04',
  setSelectedUnit: (unit) => set({ selectedUnit: unit }),
  editorActive: false,
  setEditorActive: (active) => set({ editorActive: active }),
  activeDatasetVersion: 1,
  setActiveDatasetVersion: (version) => set({ activeDatasetVersion: version }),
  customSurveyPolygon: getInitialPolygon(),
  setCustomSurveyPolygon: (polygon) => {
    try {
      if (polygon) {
        localStorage.setItem('bharat3d_custom_polygon', JSON.stringify(polygon));
      } else {
        localStorage.removeItem('bharat3d_custom_polygon');
      }
    } catch (e) {}
    set({ customSurveyPolygon: polygon });
  },
}));

