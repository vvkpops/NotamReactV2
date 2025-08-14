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