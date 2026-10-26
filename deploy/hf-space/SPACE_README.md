---
title: BHARAT 3D API
emoji: 🏙️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: other
short_description: API for BHARAT 3D, the 3D ULPIN land record for India
---

# BHARAT 3D API

Backend of [BHARAT 3D](https://bharat-3d.pages.dev): draw any area in India and get its 3D land record (buildings,
flyovers, metro tunnels and terrain become a volumetric registry with 3D ULPINs, compliance findings and dig-safe
planning). The web app is served from Cloudflare Pages and calls this API through its own domain.

Health check: `/health`. Interactive API docs: `/docs`. All data endpoints require signing in through the web app.
