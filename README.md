## Arts Event — Live Results (Red, Blue & Green)

Next.js (App Router) + Tailwind CSS + MongoDB. Three houses (Red, Blue, Green); admins submit event results (student name, house, points) and the display shows the live leaderboard.

### Local Setup

1. Install dependencies

   ```bash
   npm install
   ```

2. Create `.env.local` (this file is ignored by git)

   ```bash
   MONGODB_URI=mongodb+srv://<user>:<password>@your-cluster.mongodb.net/event_tracker?retryWrites=true&w=majority
   NEXT_PUBLIC_STREAM_URL=/api/stream
   ```

3. Seed the 3 houses (and optional example events)

   ```bash
   npm run seed
   ```

4. Run the dev server

   ```bash
   npm run dev
   ```

5. Visit the routes
   - `http://localhost:3000/` — landing
   - `http://localhost:3000/admin` — submit results (event, 1st/2nd/3rd: student name, house, points)
   - `http://localhost:3000/admin/manage` — add events, finalize expo
   - `http://localhost:3000/display` — auditorium leaderboard (High School / Higher Secondary)

### Deployment (Render)

- Build command: `npm run build`
- Start command: `npm run start`
- Environment variables: same as `.env.local`
- Optional cron/uptime ping hitting `/api/stream` every 10 minutes to prevent cold starts.

### Tech Decisions (current)

- Next.js App Router, TypeScript, Tailwind
- MongoDB via Mongoose with cached connection helper
- Server-Sent Events for live updates (`/api/stream`)
- Basic admin form and display screen shipped as React client components

Future todos live in `/src/components` and the admin form; see `package.json` scripts for linting (`npm run lint`).
