# PropGroup - Coolify Deployment Guide

This guide explains how to deploy PropGroup on Coolify using Docker.

## Architecture

- **Frontend**: Next.js 15 (Port 3000)
- **Backend**: Express.js API (Port 3001)
- **Database**: PostgreSQL
- **Deployment**: Docker Compose on Coolify (Hetzner)

## Prerequisites

1. Coolify instance running on Hetzner server
2. PostgreSQL database (Coolify managed or external)
3. Domain names configured (e.g., propgroup.com, api.propgroup.com)

## Environment Variables for Coolify

Configure these environment variables in Coolify's environment settings:

### Required Variables

#### Database
```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
```
- Get this from your Coolify PostgreSQL service or external database
- Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

#### URLs
```bash
FRONTEND_URL=https://propgroup.com
BACKEND_URL=https://api.propgroup.com
NEXT_PUBLIC_API_URL=https://api.propgroup.com/api
```
- `FRONTEND_URL`: Your frontend domain (used for CORS)
- `BACKEND_URL`: Your backend API domain (used for OAuth callbacks)
- `NEXT_PUBLIC_API_URL`: Backend API URL (exposed to browser)

#### Authentication
```bash
JWT_SECRET=<generate-with-crypto-randomBytes-64>
SESSION_SECRET=<generate-with-crypto-randomBytes-64>
JWT_EXPIRES_IN=7d
```
- Generate secrets with: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- Use strong random strings in production

### Optional Variables

#### Google OAuth (for "Sign in with Google")
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_CALLBACK_URL=https://api.propgroup.com/api/auth/google/callback
```
- Get from Google Cloud Console
- Enable Google+ API and create OAuth 2.0 Client ID
- Add authorized redirect URI: `https://api.propgroup.com/api/auth/google/callback`

#### Google Gemini AI (for AI-powered property search)
```bash
GOOGLE_GEMINI_API_KEY=your-google-gemini-api-key
```
- Get from Google AI Studio: https://makersuite.google.com/app/apikey
- Required for AI features to work

#### Email Services (for notifications, password resets)
```bash
# Option 1: Resend (recommended)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Option 2: SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx

# Email configuration
FROM_EMAIL=noreply@propgroup.com
ADMIN_EMAIL=admin@propgroup.com
```

#### Google Maps (for property location maps)
```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

#### Google Analytics (optional)
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Complete Environment Variables List for Coolify

Copy and paste this into Coolify's environment section, then fill in your values:

```bash
# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/propgroup

# URLs (REQUIRED)
FRONTEND_URL=https://propgroup.com
BACKEND_URL=https://api.propgroup.com
NEXT_PUBLIC_API_URL=https://api.propgroup.com/api

# Authentication (REQUIRED)
JWT_SECRET=your-generated-secret-here
SESSION_SECRET=your-generated-secret-here
JWT_EXPIRES_IN=7d

# Google OAuth (OPTIONAL)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://api.propgroup.com/api/auth/google/callback

# Google Gemini AI (OPTIONAL - needed for AI features)
GOOGLE_GEMINI_API_KEY=

# Email Services (OPTIONAL)
RESEND_API_KEY=
SENDGRID_API_KEY=
FROM_EMAIL=noreply@propgroup.com
ADMIN_EMAIL=admin@propgroup.com

# Google Maps (OPTIONAL)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

# Google Analytics (OPTIONAL)
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository has:
- `docker-compose.yml` (root)
- `apps/backend/Dockerfile`
- `apps/web/Dockerfile`

### 2. Create a New Service in Coolify

1. Go to your Coolify dashboard
2. Click "New Service" → "Docker Compose"
3. Connect your Git repository
4. Select the branch (usually `master` or `main`)

### 3. Configure Environment Variables

1. In Coolify, go to your service settings
2. Navigate to "Environment Variables"
3. Add all required variables (see list above)
4. Generate secure values for `JWT_SECRET` and `SESSION_SECRET`

### 4. Configure Database

**Option A: Use Coolify's PostgreSQL**
1. Create a PostgreSQL service in Coolify
2. Copy the internal connection string
3. Use it as your `DATABASE_URL`

**Option B: Use External Database**
1. Use your existing PostgreSQL database
2. Ensure it's accessible from your Coolify server
3. Use the connection string as `DATABASE_URL`

### 5. Configure Domains

1. In Coolify, go to your service settings
2. Add two domains:
   - Frontend: `propgroup.com` → Port 3000
   - Backend: `api.propgroup.com` → Port 3001
3. Enable SSL/HTTPS for both domains
4. Update DNS records to point to your Coolify server

### 6. Deploy

1. Click "Deploy" in Coolify
2. Monitor the build logs
3. First deployment will:
   - Install dependencies
   - Build shared packages
   - Build backend and frontend
   - Run database migrations
   - Start both services

### 7. Verify Deployment

Check these endpoints:
- Frontend: `https://propgroup.com`
- Backend health: `https://api.propgroup.com/api/health`
- Backend API: `https://api.propgroup.com/api`

## Database Migrations

Migrations run automatically on backend startup via the docker-compose command:
```bash
pnpm --filter @propgroup/db exec prisma migrate deploy || echo 'Migrations skipped'
```

If you need to run migrations manually:
```bash
# SSH into your backend container
docker exec -it <backend-container-id> sh

# Run migrations
pnpm --filter @propgroup/db exec prisma migrate deploy
```

## Troubleshooting

### Build Fails

1. Check Coolify build logs
2. Verify all required environment variables are set
3. Ensure `DATABASE_URL` is accessible during build

### Backend Not Starting

1. Check backend container logs in Coolify
2. Verify `DATABASE_URL` is correct
3. Check if database migrations ran successfully
4. Ensure `PORT=3001` is not already in use

### Frontend Can't Connect to Backend

1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Check CORS settings in backend
3. Ensure `FRONTEND_URL` matches your frontend domain
4. Verify both services are healthy in Coolify

### Database Connection Issues

1. Check `DATABASE_URL` format
2. Verify database is accessible from Coolify server
3. Check database credentials
4. Ensure database accepts connections from Coolify's IP

## Health Checks

Both services have health checks configured:

**Backend** (`/api/health`):
- Interval: 10s
- Timeout: 10s
- Retries: 10
- Start period: 120s

**Web**:
- Interval: 10s
- Timeout: 10s
- Retries: 10
- Start period: 60s

## Updating the Application

1. Push changes to your Git repository
2. In Coolify, click "Deploy" to trigger a new build
3. Or enable auto-deploy on Git push in Coolify settings

## Rollback

If deployment fails or has issues:
1. Go to Coolify deployments history
2. Select a previous successful deployment
3. Click "Redeploy"

## Security Checklist

- [ ] Strong random values for `JWT_SECRET` and `SESSION_SECRET`
- [ ] HTTPS enabled for both frontend and backend
- [ ] Database password is secure
- [ ] `DATABASE_URL` not exposed in frontend
- [ ] CORS configured with proper `FRONTEND_URL`
- [ ] API keys secured in Coolify environment variables
- [ ] Regular backups of database configured

## Support

For issues:
1. Check Coolify logs
2. Check container logs in Docker
3. Review this deployment guide
4. Check the PropGroup repository for updates
