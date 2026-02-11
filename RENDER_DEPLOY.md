# Deploying to Render

This guide will help you deploy the College Event Tracker to Render and set up a cron job to prevent cold starts.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. A MongoDB database (MongoDB Atlas recommended)
3. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Deploy the Web Service

### Option A: Using render.yaml (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. In Render dashboard, go to **New** → **Blueprint**
3. Connect your repository
4. Render will automatically detect `render.yaml` and create the services
5. Set the `MONGODB_URI` environment variable in the web service settings

### Option B: Manual Setup

1. In Render dashboard, go to **New** → **Web Service**
2. Connect your repository
3. Configure:
   - **Name**: `college-event-tracker`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Starter (or higher for better performance)
4. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `NODE_ENV`: `production`
   - `NEXT_PUBLIC_STREAM_URL`: `/api/stream`
5. Click **Create Web Service**

## Step 2: Set Up Keep-Alive Cron Job

### Option A: Using Render's Cron Job Service

If you used `render.yaml`, the cron job service is already configured. Just make sure:
- The `KEEPALIVE_URL` environment variable is set correctly
- The cron service is running

### Option B: External Cron Service (Recommended for Free Tier)

Since Render's cron jobs require a paid plan, use a free external service:

#### Using cron-job.org (Free)

1. Go to https://cron-job.org and create an account
2. Create a new cron job:
   - **Title**: `Keep Render App Alive`
   - **Address**: `https://your-app-name.onrender.com/api/keepalive`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)
   - **Request Method**: GET
   - **Activate**: Yes
3. Save the cron job

#### Using EasyCron (Free Tier Available)

1. Go to https://www.easycron.com
2. Create a new cron job:
   - **URL**: `https://your-app-name.onrender.com/api/keepalive`
   - **Schedule**: Every 5 minutes
   - **HTTP Method**: GET
3. Save and activate

#### Using UptimeRobot (Free - 50 monitors)

1. Go to https://uptimerobot.com
2. Add a new monitor:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `Render Keep-Alive`
   - **URL**: `https://your-app-name.onrender.com/api/keepalive`
   - **Monitoring Interval**: 5 minutes
3. Save the monitor

### Option C: GitHub Actions (Free - Recommended)

The workflow file is already created at `.github/workflows/keepalive.yml`.

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - **Name**: `RENDER_URL`
   - **Value**: `https://your-app-name.onrender.com` (your Render app URL)
5. The workflow will automatically run every 5 minutes
6. You can also manually trigger it from the **Actions** tab

**Note**: GitHub Actions has a limit of 2000 minutes/month for free accounts, which is plenty for a 5-minute cron job (about 2880 requests/month).

## Step 3: Verify Deployment

1. Check your app URL: `https://your-app-name.onrender.com`
2. Test the keep-alive endpoint: `https://your-app-name.onrender.com/api/keepalive`
3. Check Render logs to ensure the cron job is pinging successfully

## Environment Variables

Make sure these are set in Render dashboard:

- `MONGODB_URI`: Your MongoDB connection string
- `NODE_ENV`: `production`
- `NEXT_PUBLIC_STREAM_URL`: `/api/stream` (for SSE)

## Tips to Reduce Cold Starts

1. **Upgrade Plan**: Render's free tier spins down after 15 minutes of inactivity. Consider upgrading to Starter ($7/month) for always-on service.

2. **Optimize Build**: The app is already optimized, but you can:
   - Use `NEXT_TELEMETRY_DISABLED=1` to reduce build time
   - Enable build caching in Render settings

3. **Health Checks**: The `/api/keepalive` endpoint also serves as a health check, keeping the service active.

4. **Cron Frequency**: Pinging every 5 minutes is a good balance. More frequent = less cold starts but more requests.

## Troubleshooting

### App goes to sleep despite cron job
- Check cron job is actually running (check logs)
- Verify the URL is correct
- Consider upgrading to a paid plan for always-on service

### Build fails
- Check Node.js version (Render should auto-detect, but verify it's 18+)
- Check build logs for specific errors
- Ensure all dependencies are in `package.json`

### Database connection issues
- Verify `MONGODB_URI` is set correctly
- Check MongoDB Atlas IP whitelist (add `0.0.0.0/0` for Render)
- Verify network access in MongoDB Atlas

## Cost Estimate

- **Free Tier**: $0/month (with 15min spin-down)
- **Starter Plan**: $7/month (always-on, no cold starts)
- **External Cron**: Free (cron-job.org, EasyCron, UptimeRobot, GitHub Actions)

## Next Steps

1. Deploy to Render
2. Set up cron job (choose one of the options above)
3. Test the application
4. Monitor logs for any issues
5. Consider upgrading if cold starts are problematic

