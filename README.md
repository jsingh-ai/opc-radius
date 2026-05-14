# Press Radius OPC Dashboard

React + Vite frontend with an Express API layer for secure machine-status polling.

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `SHOPFLOOR_API_KEY`
3. Set `DATABASE_URL` to your PostgreSQL instance
4. Install dependencies with `npm install`
5. Run the app with `npm run dev`

## Scripts

- `npm run dev` starts the React client and Express server
- `npm run build` builds the frontend bundle
- `npm run start` serves the built frontend and API server

## PostgreSQL

- The server creates its tables automatically on startup when `DATABASE_URL` is set
- SQL is also available at `server/scripts/init.sql`
- Each API fetch stores a full response snapshot plus an upserted current row per machine

## Architecture

- `server/` contains backend proxy routes and environment config
- `server/db/` contains database bootstrap and schema management
- `server/repositories/` contains persistence logic
- `src/pages/` contains routed screens
- `src/components/` contains reusable UI building blocks
- `src/services/` contains API integration and normalization logic
- `src/hooks/` contains page-level state orchestration
