# Family Appointment Planner

This project is a colorful family appointment planner built with [Vite](https://vitejs.dev/) + React and ready to deploy on Netlify.

## Prerequisites
- Node.js 18+
- A Netlify account

## Local development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the dev server:
   ```bash
   npm run dev
   ```
   The app will be available at the URL shown in the terminal (typically `http://localhost:5173`).

## Build locally
To create an optimized production bundle:
```bash
npm run build
```
Netlify will run this command automatically when you deploy.

## Deploy to Netlify
### Option 1 – Import from GitHub
1. Push this repository to GitHub (or fork it).
2. In Netlify, click **Add new site → Import an existing project**.
3. Connect your Git provider and pick the repository.
4. Use the following settings (Netlify usually detects them automatically):
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **Deploy site**. Netlify will install dependencies, build the app, and host it.
6. After the first deploy, enable **Continuous Deployment** so that each git push triggers a new deploy.

### Option 2 – Netlify CLI
1. Install the CLI (once):
   ```bash
   npm install -g netlify-cli
   ```
2. Authenticate and pick a site:
   ```bash
   netlify login
   netlify init
   ```
3. Deploy:
   - For a draft deploy (preview URL):
     ```bash
     npm run build
     netlify deploy --dir=dist
     ```
   - For production:
     ```bash
     netlify deploy --prod --dir=dist
     ```

## Environment variables
No environment variables are required. If you customize the app with secrets, add them in **Site settings → Build & deploy → Environment** inside Netlify.

## Sharing
Once deployed, share the Netlify URL with family members (e.g., Prisha). Everyone sees the same data because the planner reads and writes appointments from the shareable URL parameters exported by the app.

