const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware for parsing JSON and serving static files
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS configuration for Railway
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://*.railway.app',
    'https://*.up.railway.app',
    'http://localhost:3000',
    'http://localhost:3001'
  ];
  
  const origin = req.headers.origin;
  if (allowedOrigins.some(allowed => 
    allowed.includes('*') ? origin?.includes(allowed.replace('*', '')) : allowed === origin
  )) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Get FAA API credentials from environment variables or config file
let CLIENT_ID, CLIENT_SECRET;

try {
  // First, try environment variables (Railway preferred method)
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
  // If not in environment variables, try config file (fallback)
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log("⚠️  Credentials not found in environment variables, trying config.json");
    
    if (fs.existsSync('./config.json')) {
      const config = require('./config.json');
      CLIENT_ID = config.faa_client_id;
      CLIENT_SECRET = config.faa_client_secret;
      console.log("✅ Credentials loaded from config.json");
    } else {
      console.log("⚠️  config.json not found");
    }
  } else {
    console.log("✅ Credentials loaded from environment variables");
  }
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("FAA API credentials not found");
  }
  
} catch (err) {
  console.error("❌ ERROR LOADING CREDENTIALS:", err.message);
  console.error("📝 Please set FAA_CLIENT_ID and FAA_CLIENT_SECRET environment variables in Railway");
  console.error("   Or ensure config.json exists with faa_client_id and faa_client_secret");
  process.exit(1);
}

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'NOTAM Dashboard V2',
    version: process.env.npm_package_version || '2.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'production',
    credentials: {
      clientIdConfigured: !!CLIENT_ID,
      clientSecretConfigured: !!CLIENT_SECRET
    }
  });
});

// Status endpoint with more detailed information
app.get('/api/status', (req, res) => {
  res.status(200).json({
    service: 'NOTAM Dashboard V2',
    version: process.env.npm_package_version || '2.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      readable: formatUptime(process.uptime())
    },
    environment: process.env.NODE_ENV || 'production',
    nodeVersion: process.version,
    platform: process.platform,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    },
    api: {
      faaCredentialsConfigured: !!(CLIENT_ID && CLIENT_SECRET),
      baseUrl: 'https://external-api.faa.gov/notamapi/v1'
    }
  });
});

// NOTAM API endpoint
app.get('/api/notams', async (req, res) => {
  const startTime = Date.now();
  const icao = (req.query.icao || '').toUpperCase().trim();
  
  console.log(`[${new Date().toISOString()}] NOTAM request for ICAO: ${icao}`);
  
  // Validate ICAO code
  if (!icao || icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) {
    console.log(`[${new Date().toISOString()}] Invalid ICAO: ${icao}`);
    return res.status(400).json({ 
      error: "Invalid ICAO code",
      message: "ICAO code must be exactly 4 uppercase letters",
      example: "KJFK"
    });
  }

  try {
    const url = `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}&responseFormat=geoJson&pageSize=1000`;
    console.log(`[${new Date().toISOString()}] Fetching from FAA API: ${url}`);

    const notamRes = await axios.get(url, {
      headers: {
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'User-Agent': 'NOTAM-Dashboard-V2/2.0.0',
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    console.log(`[${new Date().toISOString()}] FAA API response status: ${notamRes.status}`);
    
    // Handle rate limiting
    if (notamRes.status === 429) {
      console.log(`[${new Date().toISOString()}] Rate limited for ${icao}`);
      return res.status(429).json({ 
        error: "Rate limited",
        message: "Too many requests to FAA API. Please try again later.",
        retryAfter: notamRes.headers['retry-after'] || 60
      });
    }
    
    // Handle other client errors
    if (notamRes.status >= 400) {
      console.log(`[${new Date().toISOString()}] FAA API error ${notamRes.status} for ${icao}`);
      return res.status(notamRes.status).json({ 
        error: "FAA API error",
        status: notamRes.status,
        message: notamRes.data?.message || "Error from FAA API"
      });
    }

    // Verify response structure
    if (!notamRes.data) {
      console.error(`[${new Date().toISOString()}] Empty response data for ${icao}`);
      return res.status(500).json({ error: "Empty response from FAA API" });
    }
    
    if (!notamRes.data.items) {
      console.error(`[${new Date().toISOString()}] Missing items array for ${icao}`, 
        JSON.stringify(notamRes.data).substring(0, 200));
      return res.status(500).json({ error: "Unexpected response format from FAA API" });
    }

    // Parse and process NOTAMs
    const items = notamRes.data.items || [];
    console.log(`[${new Date().toISOString()}] Processing ${items.length} raw NOTAMs for ${icao}`);
    
    let parsed = [];
    
    try {
      parsed = items.map((item, index) => {
        try {
          const core = item.properties?.coreNOTAMData?.notam || {};
          const translation = (item.properties?.coreNOTAMData?.notamTranslation || [])[0] || {};
          
          return {
            id: `${icao}-${core.number || index}`,
            number: core.number || '',
            type: core.type || '',
            classification: core.classification || '',
            icao: core.icaoLocation || core.location || icao,
            location: core.location || '',
            validFrom: core.effectiveStart || core.issued || '',
            validTo: core.effectiveEnd || '',
            summary: translation.simpleText || translation.formattedText || core.text || '',
            body: core.text || '',
            qLine: translation.formattedText?.split('\n')[0] || '',
            issued: core.issued || '',
            source: 'FAA',
            processedAt: new Date().toISOString()
          };
        } catch (itemError) {
          console.error(`[${new Date().toISOString()}] Error parsing NOTAM item ${index}:`, itemError);
          return null;
        }
      }).filter(Boolean); // Remove null items
      
    } catch (parseErr) {
      console.error(`[${new Date().toISOString()}] Failed to parse NOTAM data for ${icao}:`, parseErr);
      return res.status(500).json({ 
        error: "Failed to parse NOTAM data", 
        details: parseErr.message 
      });
    }

    console.log(`[${new Date().toISOString()}] Successfully parsed ${parsed.length} NOTAMs for ${icao}`);

    // Filter for currently valid or future NOTAMs only
    const now = new Date();
    const validNotams = parsed.filter(notam => {
      if (!notam.validTo) return true; // Keep if end time missing
      try {
        return new Date(notam.validTo) >= now;
      } catch {
        return true; // Keep if date parsing fails
      }
    });

    // Sort by dispatcher priority
    validNotams.sort((a, b) => {
      const isClosureA = /clsd|closed/i.test(a.summary);
      const isRscA = /rsc/i.test(a.summary);
      const isCrfiA = /crfi/i.test(a.summary);

      const isClosureB = /clsd|closed/i.test(b.summary);
      const isRscB = /rsc/i.test(b.summary);
      const isCrfiB = /crfi/i.test(b.summary);

      // Priority 1: Runway/Taxiway closures
      if (isClosureA && !isClosureB) return -1;
      if (!isClosureA && isClosureB) return 1;

      // Priority 2: RSC (Runway Surface Conditions)
      if (isRscA && !isRscB) return -1;
      if (!isRscA && isRscB) return 1;

      // Priority 3: CRFI (Canadian Runway Friction Index)
      if (isCrfiA && !isCrfiB) return -1;
      if (!isCrfiA && isCrfiB) return 1;

      // Default: Most recent first
      try {
        const dateA = new Date(a.validFrom || a.issued);
        const dateB = new Date(b.validFrom || b.issued);
        return dateB - dateA;
      } catch {
        return 0;
      }
    });

    // Limit to first 50 for performance
    const limitedNotams = validNotams.slice(0, 50);
    
    const processingTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Sending ${limitedNotams.length} NOTAMs for ${icao} (${processingTime}ms)`);

    // Send response with metadata
    res.json({
      data: limitedNotams,
      metadata: {
        icao,
        total: limitedNotams.length,
        filtered: parsed.length - validNotams.length,
        processingTime,
        timestamp: new Date().toISOString(),
        source: 'FAA API v1'
      }
    });

  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error fetching NOTAMs for ${icao} (${processingTime}ms):`, err.message);
    
    if (err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND') {
      return res.status(503).json({ 
        error: "Service temporarily unavailable", 
        message: "Unable to connect to FAA API",
        details: err.message
      });
    }
    
    if (err.response) {
      return res.status(err.response.status || 500).json({ 
        error: "FAA API error", 
        status: err.response.status,
        message: err.response.data?.message || err.message
      });
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      message: "An unexpected error occurred",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Catch all handler for React Router (must be last)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  res.status(500).json({
    error: "Internal server error",
    message: "An unexpected error occurred"
  });
});

// Utility function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 NOTAM Dashboard V2 running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`🔑 FAA API Credentials: ${CLIENT_ID && CLIENT_SECRET ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
