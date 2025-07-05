# Justice-core-backend

This is the backend API for the justice-core-suite frontend, built with Express and MongoDB (using Mongoose).

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start MongoDB locally (default URI: `mongodb://localhost:27017/justice-core`).
   - You can change the MongoDB URI by setting the `MONGO_URI` environment variable.

3. Start the server:
   ```bash
   npm run dev
   # or
   npm start
   ```

The API will run on port 4000 by default.

## Endpoints

- `POST /api/login` — Dummy login
- `GET /api/cases` — List all cases (from MongoDB)
- `GET /api/people` — Placeholder
- `GET /api/tasks` — Placeholder
- `GET /api/invoices` — Placeholder
- `GET /api/files` — Placeholder
- `GET /api/chat` — Placeholder
- `GET /api/reports` — Placeholder
- `GET /api/calendar` — Placeholder

## Notes
- Only the `/api/cases` endpoint is connected to MongoDB. Others are placeholders for future implementation. 