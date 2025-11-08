# Render Backend Deployment Setup

## Required Environment Variables

You need to set these environment variables in your Render dashboard:

### 1. Go to Render Dashboard
- Navigate to: https://dashboard.render.com/
- Select your backend service (propgroup-backend or similar)
- Go to: **Environment** tab

### 2. Add These Environment Variables

```bash
# Database
DATABASE_URL=your_postgres_database_url_here

# Environment
NODE_ENV=production

# Server URLs
FRONTEND_URL=https://propgroup-web.vercel.app
BACKEND_URL=https://propgroup.onrender.com

# Security
JWT_SECRET=your_very_secure_random_string_here
JWT_EXPIRES_IN=7d
SESSION_SECRET=another_very_secure_random_string_here

# Optional: Google OAuth (if you want to enable Google login)
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# GOOGLE_CALLBACK_URL=https://propgroup.onrender.com/api/auth/google/callback
```

## Important Notes

### DATABASE_URL
- **Option 1**: Use Render's PostgreSQL database
  - Create a new PostgreSQL database in Render
  - Copy the Internal Database URL
  - Use that as DATABASE_URL

- **Option 2**: Use external database (Supabase, Neon, etc.)
  - Get the connection string from your provider
  - Format: `postgresql://user:password@host:port/database`

### JWT_SECRET and SESSION_SECRET
Generate secure random strings:
```bash
# On Mac/Linux
openssl rand -base64 32

# Or use online generator
# https://www.random.org/strings/
```

### FRONTEND_URL
- **IMPORTANT**: Must include your Vercel deployment URL
- Can be comma-separated for multiple URLs:
  ```
  FRONTEND_URL=https://propgroup-web.vercel.app,http://localhost:3000
  ```

## After Setting Environment Variables

1. **Redeploy the service**:
   - Render > Your Service > Manual Deploy > Deploy latest commit

2. **Check the logs**:
   - Go to Render > Your Service > Logs
   - Look for these startup messages:
     ```
     🔌 Testing database connection...
     ✅ Database connection successful
     🚀 Server running on port 3001
     🔗 Frontend URL: https://propgroup-web.vercel.app
     ✅ Server is ready to accept connections
     ```

3. **Test the health endpoint**:
   - Visit: https://propgroup.onrender.com/health
   - Should return:
     ```json
     {
       "status": "ok",
       "database": "connected",
       "environment": "production"
     }
     ```

## Troubleshooting

### 502 Bad Gateway
**Causes**:
- DATABASE_URL not set or invalid
- Server failed to start
- Database connection failed

**Solutions**:
1. Check Render logs for error messages
2. Verify DATABASE_URL is correct
3. Make sure database is accessible from Render

### CORS Errors
**Causes**:
- FRONTEND_URL not set correctly
- Backend not responding (502)

**Solutions**:
1. Ensure FRONTEND_URL includes `https://propgroup-web.vercel.app`
2. Fix the 502 error first
3. Check logs for CORS messages

### Database Migration Issues
If you need to run migrations:
```bash
# In Render Shell
cd /opt/render/project/src/packages/db
npx prisma migrate deploy
```

Or run the seed script:
```bash
# In Render Shell
cd /opt/render/project/src/apps/backend
node src/seed.js
```

## Render Build Settings

Make sure your Render service has these settings:

- **Build Command**: `npm run render-build`
- **Start Command**: `npm run render-start`
- **Root Directory**: `apps/backend`

## Database Setup on Render

If using Render PostgreSQL:

1. Create a new PostgreSQL database
2. Copy the **Internal Database URL** (faster, free)
3. Set it as DATABASE_URL in your web service
4. After deploy, run migrations in the Shell:
   ```bash
   cd packages/db
   npx prisma migrate deploy
   node prisma/seed.ts
   ```
