# 🚀 Railway Deployment Guide - NOTAM Dashboard V2

This guide will help you deploy your NOTAM Dashboard V2 to Railway with your FAA API credentials.

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **FAA API Credentials**: Get your credentials from [FAA API Portal](https://www.faa.gov/air_traffic/publications/notices/)
3. **GitHub Repository**: Your code should be in a GitHub repository

## 🔧 Setup Instructions

### Method 1: Environment Variables (Recommended)

1. **Connect Repository to Railway**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your NOTAM Dashboard repository

2. **Set Environment Variables**
   - In your Railway project dashboard, go to **Variables** tab
   - Add these environment variables:
   ```
   FAA_CLIENT_ID=your_actual_faa_client_id_here
   FAA_CLIENT_SECRET=your_actual_faa_client_secret_here
   NODE_ENV=production
   ```

3. **Deploy**
   - Railway will automatically deploy using the Dockerfile
   - Check the deployment logs for any issues
   - Your app will be available at `https://your-app-name.up.railway.app`

### Method 2: Config File (Alternative)

1. **Create config.json**
   ```bash
   cp config.json.template config.json
   ```

2. **Add Your Credentials**
   ```json
   {
     "faa_client_id": "your_actual_faa_client_id_here",
     "faa_client_secret": "your_actual_faa_client_secret_here"
   }
   ```

3. **Deploy to Railway**
   - Commit the config.json file to your repository
   - Railway will deploy automatically

## 🔑 Getting FAA API Credentials

1. Visit the [FAA Developer Portal](https://www.faa.gov/air_traffic/publications/notices/)
2. Register for an account
3. Create a new application
4. Note down your `client_id` and `client_secret`

> ⚠️ **Security Note**: For production, always use environment variables instead of committing credentials to your repository.

## 🔍 Verification

After deployment, verify your app is working:

1. **Health Check**: Visit `https://your-app.up.railway.app/health`
   - Should return: `{"status":"healthy","service":"NOTAM Dashboard V2",...}`

2. **Status Check**: Visit `https://your-app.up.railway.app/api/status`
   - Should show: `"faaCredentialsConfigured": true`

3. **Test NOTAM API**: Visit `https://your-app.up.railway.app/api/notams?icao=KJFK`
   - Should return NOTAM data for JFK airport

## 📁 File Structure for Railway

```
notam-react-v2/
├── Dockerfile              # Railway deployment configuration
├── server.js               # Production server with FAA API integration
├── railway.json            # Railway-specific configuration
├── config.json.template    # Template for local development
├── package.json            # Dependencies and scripts
├── build/                  # React production build (created by npm run build)
│   ├── static/
│   └── index.html
├── src/                    # React source code
│   ├── components/
│   ├── services/
│   ├── utils/
│   └── App.js
└── public/
    └── index.html
```

## 🛠️ Troubleshooting

### Common Issues:

1. **"FAA API credentials not found"**
   - Ensure environment variables are set correctly in Railway
   - Check variable names: `FAA_CLIENT_ID` and `FAA_CLIENT_SECRET`

2. **Build fails**
   - Check that all dependencies are in `package.json`
   - Ensure `npm run build` works locally

3. **Health check fails**
   - Check server logs in Railway dashboard
   - Verify PORT environment variable is being used

4. **API returns errors**
   - Verify FAA credentials are valid
   - Check FAA API rate limits
   - Review server logs for detailed error messages

### Debugging Steps:

1. **Check Railway Logs**
   - Go to your Railway project dashboard
   - Click on "Deployments" tab
   - View the latest deployment logs

2. **Test Locally**
   ```bash
   # Install dependencies
   npm install
   
   # Build React app
   npm run build
   
   # Test server
   FAA_CLIENT_ID=your_id FAA_CLIENT_SECRET=your_secret npm start
   ```

3. **Health Check Endpoints**
   ```bash
   # Basic health
   curl https://your-app.up.railway.app/health
   
   # Detailed status
   curl https://your-app.up.railway.app/api/status
   
   # Test NOTAM API
   curl https://your-app.up.railway.app/api/notams?icao=KJFK
   ```

## 🔄 Updating Your Deployment

1. **Push changes to GitHub**
   ```bash
   git add .
   git commit -m "Update NOTAM Dashboard"
   git push origin main
   ```

2. **Railway auto-deploys**
   - Railway automatically deploys when you push to your connected branch
   - Monitor the deployment in the Railway dashboard

## 📊 Monitoring

- **Health Checks**: Railway automatically monitors `/health` endpoint
- **Logs**: Available in Railway dashboard under "Deployments"
- **Metrics**: CPU, memory, and network usage in Railway dashboard

## 🔒 Security Best Practices

1. **Never commit credentials**: Use environment variables
2. **Secure headers**: Already configured in server.js
3. **Rate limiting**: Implemented for FAA API calls
4. **Error handling**: Prevents credential leakage in error messages

## 📞 Support

If you encounter issues:

1. Check the [Railway Documentation](https://docs.railway.app/)
2. Review server logs in Railway dashboard
3. Test locally with the same environment variables
4. Check FAA API status and documentation

## 🎉 Success!

Once deployed successfully, your NOTAM Dashboard V2 will be available at:
`https://your-app-name.up.railway.app`

The dashboard will automatically fetch real-time NOTAM data from the FAA API and provide a modern, responsive interface for aviation professionals.



# NOTAM Dashboard - React Version

A real-time NOTAM (Notice to Airmen) dashboard built with React and Node.js, designed for aviation dispatchers and pilots.

## Features

- Real-time NOTAM fetching from FAA API
- Multiple ICAO code support with batching
- Advanced filtering (runway closures, RSC, CRFI, ILS, fuel, etc.)
- Auto-refresh every 5 minutes
- Session management (single active session per browser)
- Notification system for new NOTAMs
- Responsive design with glass morphism UI
- Card scaling and keyword search

## Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Set environment variables if needed
3. Deploy automatically

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode (concurrent server and client)
npm run dev

# Or run production build
npm run build
npm start
```

## Environment Variables

The app uses the FAA API credentials from `config.json`. Make sure this file exists with your FAA API credentials:

```json
{
  "faa_client_id": "your_faa_client_id",
  "faa_client_secret": "your_faa_client_secret"
}
```

## API Endpoints

- `GET /api/notams?icao=XXXX` - Fetch NOTAMs for a specific ICAO code

## Technical Stack

- **Frontend**: React 18, Tailwind CSS, Font Awesome
- **Backend**: Node.js, Express
- **API**: FAA NOTAM API v1
- **Deployment**: Railway (Docker)

## Features Detail

### Session Management
- Only one active session per browser using BroadcastChannel API
- Automatic session takeover with graceful shutdown

### Batching System
- Intelligent ICAO batching with rate limiting
- Respects FAA API limits (30 calls per 65 seconds)
- Background processing with queue management

### Auto-refresh
- 5-minute interval auto-refresh
- Visual countdown timer
- Maintains user interactions and filters

### Filtering System
- Runway/Taxiway closures
- RSC (Runway Surface Condition)
- CRFI (Canadian Runway Friction Index)
- ILS, Fuel, and other categories
- Time-based filters (Current/Future)
- Keyword search

## Browser Support

- Chrome 80+
- Firefox 76+
- Safari 13.1+
- Edge 80+

## License

MIT License
