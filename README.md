# Masjid Al Taubah – Vite + React + Tailwind (API + MySQL)

This frontend is wired to the Node.js API you provided (`/api`) and **stores all site content in MySQL** (no localStorage for site content).

## 1) Configure

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Set:

- `VITE_API_BASE=https://masjidaltaubah.co.za/api` (or your local API URL)

## 2) Install + run

```bash
npm install
npm run dev
```

## Backend (reference)

The `api/` folder contains the server + schema you uploaded for convenience.

**One-time setup** (creates the first super admin):

- Set `SETUP_KEY`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`, `SUPERADMIN_NAME` on the server
- Call `POST /api/setup/run` with header `x-setup-key: <SETUP_KEY>`

## Admin

- Go to the site → Admin tab
- Login using an admin account
- `super_admin` will also see **Users** management
