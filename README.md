# pverseai
An AI-powered comic creation platform that transforms stories into immersive comics with intelligent storytelling, consistent character memory, automated panel composition, plot-hole detection, and AI-driven editing.

## Frontend

The React frontend lives in `frontend/`. From that directory, run `npm install` and `npm run dev`. The app provides the landing page and the Dashboard, Story Studio, Universe Explorer, Comic Editor, Community, and Marketplace routes.

The original HTML reference is preserved at `frontend/public/original/panelverse.html`; its embedded images and styles are reused by the React app.

The frontend is responsive and includes a centralized API client and service boundaries. See [frontend/API_INTEGRATION.md](./frontend/API_INTEGRATION.md) for environment setup, service usage, suggested data contracts, and the backend handoff. The current `backend/` directory is empty, so FastAPI CORS setup and backend tests remain pending until backend source is added.
