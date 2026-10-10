# FoodBridge — Food Waste Redistribution Platform

A college mini-project built with React + Vite, Node.js + Express, and MySQL.

## Features
- Responsive dashboard with live statistics and food listings
- Add surplus-food listings with quantity, expiry, category, donor, pickup address and contact
- Search/filter available listings
- Request pickup with organization name, contact, and quantity
- Donor can update request status: confirmed, collected, completed, or cancelled
- MySQL schema and optional seed data
- Vercel frontend + Render backend deployment configuration

> Verification note: this project supports an `organization_name` field, but does not implement identity verification, login, or access control. For a production service, add authentication and an admin verification workflow before allowing sensitive actions.

## 1. Database setup
Create a MySQL database, then run `backend/schema.sql` in your MySQL console or GUI. It creates `food_listings` and `pickup_requests` and inserts sample listings.

## 2. Run the backend
```bash
cd backend
cp .env.example .env
# edit .env with your MySQL connection details
npm install
npm run dev
```
Backend default: `http://localhost:5000`

Required `.env` values:
- `PORT=5000`
- `FRONTEND_URL=http://localhost:5173`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SSL=false` locally; set `DB_SSL=true` for providers requiring TLS

Health check: `GET /api/health`

## 3. Run the frontend
Open a second terminal:
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```
Open the Vite URL printed in your terminal (usually `http://localhost:5173`). Set `VITE_API_URL=http://localhost:5000` in `frontend/.env`.

## 4. Deploy
### Database
Create a hosted MySQL-compatible database (for example, a MySQL service from your preferred cloud provider). Run `backend/schema.sql` against it. Copy its host, port, database, username, password and TLS requirements.

### Backend on Render
1. Push this project to a GitHub repository.
2. In Render, create **New → Web Service** and connect the repository.
3. Set **Root Directory** to `backend`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true` if required, and `FRONTEND_URL` set to your Vercel URL. `PORT` is provided automatically by Render.
7. Deploy and test `https://YOUR-BACKEND.onrender.com/api/health`.

### Frontend on Vercel
1. Import the same GitHub repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite.
4. Add environment variable `VITE_API_URL=https://YOUR-BACKEND.onrender.com` (no trailing slash).
5. Deploy. Then update backend `FRONTEND_URL` to the Vercel domain and redeploy the backend.

The public URL is assigned by Vercel after deployment. It cannot be pre-created from this project bundle; hosting accounts and database credentials are needed.

## API endpoints
- `GET /api/health`
- `GET /api/listings?search=&category=&status=`
- `POST /api/listings`
- `GET /api/listings/:id`
- `POST /api/listings/:id/requests`
- `GET /api/requests`
- `PATCH /api/requests/:id/status`

## Important production upgrades
Add authentication/roles, organization verification, rate limiting, audit logs, image upload moderation, expiry automation, and food safety policies before real-world use. Never commit `.env` or secrets to GitHub.

## Hosting dashboards
- Vercel: https://vercel.com/new
- Render: https://dashboard.render.com/
- TiDB Cloud (MySQL-compatible): https://tidbcloud.com/

Deploying requires signing in and supplying your own database credentials. The UI intentionally falls back to preview cards if the API is unreachable; form submissions require a live API and database and will show an error until connected.
