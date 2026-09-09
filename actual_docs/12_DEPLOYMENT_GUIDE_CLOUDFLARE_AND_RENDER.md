# BHARAT 3D: Cloudflare & Render Production Deployment Guide

## 1. Architecture Overview
- **Frontend Hosting**: **Cloudflare Pages** (Ultra-fast global CDN, unlimited bandwidth for 3D Three.js assets & textures, instant build).
- **Backend API Hosting**: **Render Web Service** (Python 3.11 FastAPI with async SQLite/PostGIS database and REST endpoints).

---

## 2. Backend Deployment on Render

### Step 2.1: Create Web Service
1. Log into [Render Dashboard](https://dashboard.render.com/) and click **New + -> Web Service**.
2. Connect your GitHub repository: `Partha-Shankar/BHARAT-3D-CADASTRE`.
3. Configure the service settings:
   - **Name**: `bharat3d-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Region**: `Singapore` or `Frankfurt` (closest to India)
   - **Branch**: `main`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free or Starter

### Step 2.2: Copy Backend URL
- Once deployed, Render will provide a live URL like:  
  `https://bharat3d-backend.onrender.com`

---

## 3. Frontend Deployment on Cloudflare Pages

### Step 3.1: Create Cloudflare Pages Project
1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Compute (Workers & Pages)** -> **Pages** -> **Connect to Git**.
2. Select your repository (`Partha-Shankar/BHARAT-3D-CADASTRE`).
3. Set the build configuration:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Build Output Directory**: `dist`

### Step 3.2: Configure Environment Variables
In Cloudflare Pages -> **Settings** -> **Environment variables**:
- **Variable Name**: `VITE_API_URL`
- **Value**: `https://bharat3d-backend.onrender.com` (your Render URL from Step 2.2)

### Step 3.3: Deploy
- Click **Save and Deploy**.
- Cloudflare Pages will build the frontend in ~20 seconds and assign a live production URL:  
  `https://bharat-3d.pages.dev` (or your custom domain).

---

## 4. Pre-Configured Verification
- SPA Routing Fallback (`_redirects`) is pre-configured in `frontend/public/_redirects`.
- CORS is configured on FastAPI (`CORSMiddleware allow_origins=["*"]`).
- Axios client in `frontend/src/lib/api.ts` automatically reads `VITE_API_URL`.
