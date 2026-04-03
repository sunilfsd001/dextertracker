# Dexter Coding Tracker (GitHub Pages + Database Backend)

Frontend is static and can be hosted on GitHub Pages.  
Data is stored in MySQL through the backend API (`backend/`), so it works with Clever Cloud DB.

## Project Structure
```text
dexter/
  assets/
    css/
    js/
      runtime-config.js   # frontend API URL
      api.js
      auth.js
      user-dashboard.js
      admin-dashboard.js
  index.html
  dashboard.html
  admin.html
  backend/
    src/
      app.js
      server.js
      config/
      middleware/
      routes/
      services/
      utils/
    package.json
    .env.example
  database/
    schema.sql
    seed.sql
```

## 1) Setup Database (MySQL)
Run:
```sql
SOURCE /absolute/path/to/dexter/database/schema.sql;
SOURCE /absolute/path/to/dexter/database/seed.sql;
```

Seed logins:
- Admin: `admin@tracker.dev` / `password`
- Users: `ava@tracker.dev`, `liam@tracker.dev`, `mia@tracker.dev`, `noah@tracker.dev` / `password`

## 2) Configure Backend
```bash
cd backend
cp .env.example .env
```

Update `.env` (you can fill Clever Cloud DB values later):
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SSL` (`true` usually for managed cloud DB)
- `JWT_SECRET`
- `CORS_ORIGIN` (include your GitHub Pages URL)

Install and run:
```bash
cd backend
npm install
npm run dev
```

Default local API URL:
- `http://localhost:5000/api`

## 3) Point Frontend to Backend
Edit:
- `assets/js/runtime-config.js`

Set:
```js
window.__DEXTER_API_BASE_URL = "https://your-backend-domain/api";
```

For local backend keep:
```js
window.__DEXTER_API_BASE_URL = "http://localhost:5000/api";
```

## 4) Deploy
1. Deploy backend to Clever Cloud (Node.js app).
2. Set backend env vars in Clever Cloud dashboard (same keys as `.env.example`).
3. Deploy/import MySQL and use Clever Cloud DB credentials in backend env.
4. Set `assets/js/runtime-config.js` to deployed backend URL.
5. Deploy frontend to GitHub Pages (root folder).

## Important
- GitHub Pages cannot run Node or MySQL directly.
- Database connection happens only in backend (Clever Cloud), never from browser directly.
