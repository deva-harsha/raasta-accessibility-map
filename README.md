# Raasta

Raasta is a local feasibility prototype for checking accessibility before travelling to an entrance or short footpath. People can explore verified community reports, or photograph a place, receive a cautious local vision-model suggestion, verify it, and publish it to the shared access map.

Raasta does **not** certify accessibility or legal compliance. Reports are community guidance and can be wrong or outdated. Verify uncertain conditions before travelling or proceeding.

## Community flow

1. **Explore map** shows genuine reports created through this Raasta instance. Reports can be searched locally by place name, filtered by mobility profile and verdict, inspected in detail, and confirmed by another visitor.
2. **Report access** retains the original scan flow. The user selects a mobility profile and photo, then the local CLIP model suggests a visible condition.
3. The user can add optional **user-confirmed details**—facts they personally observed, such as a missing lift or narrow entrance. These stay visibly separate from the AI finding.
4. The user chooses **Add this to the access map**, enters a clear location label, clicks a small map or explicitly requests browser geolocation to place the pin, reviews a preview, and verifies the report before publishing.
5. An existing report can be turned into a copyable **civic report** summary for sending manually to a college, mall, municipality, or community group. Raasta does not file a complaint or contact an organisation automatically.

The **AI finding** is the local CLIP model's suggestion from the photo. **User-confirmed details** are selected and written by the person who visited the location. Neither is an official accessibility certification.

No account is required. This is a local-only prototype: report metadata persists in `backend/data/reports.json`, and safely re-encoded images are stored in `backend/uploads/` on the machine running the backend. It does not synchronize reports between different computers. New installations contain no sample reports or fabricated markers.

## Themes and map tiles

Raasta includes deliberately designed light and dark themes. The first visit follows the operating-system colour preference; the header toggle then saves the user's choice in browser `localStorage`. Both themes use OpenStreetMap's reliable no-key raster tiles; the surrounding map interface remains matched to the selected theme. OpenStreetMap attribution stays visible and the tiles require an internet connection. Vision inference remains local on the configured backend after the CLIP model files are available.

## Architecture

- `frontend/`: React, Vite, Axios, React Leaflet, and Leaflet. The five most recent personal scans, theme preference, and feedback stay in browser `localStorage`.
- `backend/`: FastAPI and Pillow, with Hugging Face `openai/clip-vit-base-patch32` for local zero-shot image classification. Community data uses local JSON and image files rather than a database.
- Map tiles come from OpenStreetMap in both themes. Vision inference runs on the configured Raasta backend; no cloud AI or LLM API is called.

## Setup

From the project root in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
cd frontend
npm install
```

## Run

Open two terminals in the project root.

Terminal 1 — backend:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`. Vite proxies both `/api` and `/uploads` to the local backend.

For Vercel, `VITE_API_URL` is required and must be available when Vercel builds the frontend. Add it in the Vercel project's environment variables for Production (and Preview if needed), then redeploy:

```text
VITE_API_URL=https://raasta-api-ik0i.onrender.com
```

If the variable is absent, production builds fall back to `https://raasta-api-ik0i.onrender.com`, while local development falls back to `http://127.0.0.1:8000`. Vite environment variables are compiled into the production bundle, so changing the value requires a new deployment.

On Render, set the backend's allowed frontend origin before redeploying. Multiple origins can be supplied as a comma-separated list; the two local Vite origins are always retained automatically:

```text
ALLOWED_ORIGINS=https://raasta-accessibility-map.vercel.app
```

Use the exact Vercel origin without a path. Preview deployments can be added as additional comma-separated origins when needed.

## Limitations

CLIP is a general-purpose vision-language model, not an accessibility inspection system. Its confidence is only a relative estimate across six supplied descriptions. A photo cannot reliably establish slope, clear width, surface condition, kerb height, structural safety, legal compliance, or anything outside the frame.

Community reports depend on user verification. A correct report can become outdated as vehicles move, construction changes, entrances close, or surfaces deteriorate. Confirmation counts indicate agreement, not certification or current safety.

The JSON file and uploads folder are prototype storage, not durable production storage. They have no database transactions, replication, backups, access control, moderation, or multi-server consistency. Do not treat this storage design as production-ready.
