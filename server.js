// server.js
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
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
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

// ENHANCED: NAV CANADA CFPS helper with proper parsing
async function fetchNavCanadaNotamsServerSide(icao) {
  const upperIcao = (icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(upperIcao)) {
    return [];
  }

  const navUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
  try {
    console.log(`[NAVCAN] Fetching ${upperIcao} from: ${navUrl}`);
    
    const resp = await axios.get(navUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'NOTAM-Dashboard-V2/Server',
        'Accept': 'application/json'
      },
      validateStatus: (s) => s < 500
    });

    if (resp.status >= 400) {
      console.warn(`[NAVCAN] HTTP ${resp.status} for ${upperIcao}`);
      return [];
    }

    const rawData = resp.data;
    if (!rawData) {
      console.log(`[NAVCAN] Empty payload for ${upperIcao}`);
      return [];
    }

    // Use the new parsing logic
    return parseCFPSResponse(upperIcao, rawData);

  } catch (err) {
    console.error(`[NAVCAN] Error fetching ${upperIcao}:`, err.message || err);
    return [];
  }
}

// CFPS Parser Functions (extracted from utility)
function parseCFPSResponse(icao, rawData) {
  if (!rawData || typeof rawData !== 'object') {
    console.log(`[CFPS] Empty or invalid payload for ${icao}`);
    return [];
  }

  const rawItems = extractCFPSItems(rawData, icao);
  
  if (!rawItems || rawItems.length === 0) {
    console.log(`[CFPS] No NOTAM items found for ${icao}`);
    return [];
  }

  const normalizedNotams = rawItems.map((item, index) => {
    return normalizeCFPSNotam(item, icao, index);
  }).filter(Boolean);

  console.log(`[CFPS] Successfully parsed ${normalizedNotams.length} NOTAMs for ${icao}`);
  return normalizedNotams;
}

function extractCFPSItems(rawData, icao) {
  let items = [];

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (Array.isArray(rawData.alpha)) {
    items = rawData.alpha;
  } else if (Array.isArray(rawData.notams)) {
    items = rawData.notams;
  } else if (Array.isArray(rawData.data)) {
    items = rawData.data;
  } else if (rawData.report) {
    if (Array.isArray(rawData.report.notams)) {
      items = rawData.report.notams;
    } else if (Array.isArray(rawData.report.alpha)) {
      items = rawData.report.alpha;
    } else if (typeof rawData.report === 'object') {
      items = [rawData.report];
    }
  } else if (rawData[icao]) {
    const icaoData = rawData[icao];
    if (Array.isArray(icaoData)) {
      items = icaoData;
    } else if (Array.isArray(icaoData.notams)) {
      items = icaoData.notams;
    }
  } else {
    // Look for any array of objects that might contain NOTAMs
    const keys = Object.keys(rawData);
    for (const key of keys) {
      if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
        const firstItem = rawData[key][0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          if (hasNotamCharacteristics(firstItem)) {
            items = rawData[key];
            console.log(`[CFPS] Found NOTAM data in key: ${key}`);
            break;
          }
        }
      }
    }
  }

  return items;
}

function hasNotamCharacteristics(obj) {
  const notamFields = ['id', 'notamId', 'number', 'text', 'raw', 'message', 'summary', 'start', 'end', 'issued', 'site', 'icao'];
  return notamFields.some(field => obj.hasOwnProperty(field));
}

function normalizeCFPSNotam(item, icao, index) {
  try {
    const number = item.id || item.notamId || item.number || '';
    const id = `${icao}-${number || index}`;
    
    // Extract and clean content
    const rawText = item.raw || item.text || item.message || item.summary || '';
    const summary = cleanNotamText(item.summary || item.simpleText || rawText);
    const body = cleanNotamText(item.fullText || item.text || rawText);
    
    // Extract dates
    const validFrom = normalizeDateString(item.start || item.validFrom || item.issued || '');
    const validTo = normalizeDateString(item.end || item.validTo || '');
    const issued = normalizeDateString(item.issued || item.start || '');
    
    // Determine classification
    let classification = 'AO'; // Default to Other
    if (item.classification) {
      classification = normalizeClassification(item.classification);
    } else {
      // Derive from content
      const upperSummary = summary.toUpperCase();
      if (upperSummary.includes('RUNWAY') || upperSummary.includes('RWY')) classification = 'RW';
      else if (upperSummary.includes('TAXIWAY') || upperSummary.includes('TWY')) classification = 'TW';
      else if (upperSummary.includes('ILS') || upperSummary.includes('INSTRUMENT')) classification = 'AD';
      else if (upperSummary.includes('FUEL')) classification = 'SVC';
      else if (upperSummary.includes('DOMESTIC')) classification = 'DOM';
    }

    return {
      id,
      number: number || '',
      type: item.type || 'A',
      classification,
      icao: icao.toUpperCase(),
      location: item.site || item.icao || icao.toUpperCase(),
      validFrom,
      validTo,
      summary,
      body: body !== summary ? body : summary,
      qLine: item.qLine || extractQLineFromText(rawText) || '',
      issued,
      source: 'NAVCAN',
      rawOriginal: item,
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[CFPS] Error normalizing NOTAM item ${index}:`, error);
    return null;
  }
}

function cleanNotamText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  
  try {
    let normalizedDate = dateStr.toString().trim();
    
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      const date = new Date(normalizedDate);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    if (/^\d{10}$/.test(normalizedDate)) {
      const year = 2000 + parseInt(normalizedDate.substr(0, 2));
      const month = parseInt(normalizedDate.substr(2, 2)) - 1;
      const day = parseInt(normalizedDate.substr(4, 2));
      const hour = parseInt(normalizedDate.substr(6, 2));
      const minute = parseInt(normalizedDate.substr(8, 2));
      
      const date = new Date(year, month, day, hour, minute);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    const date = new Date(normalizedDate);
    return isNaN(date) ? '' : date.toISOString();
    
  } catch (error) {
    return '';
  }
}

function normalizeClassification(classification) {
  if (!classification) return 'AO';
  
  const code = classification.toString().trim().toUpperCase();
  const classificationMap = {
    'RUNWAY': 'RW',
    'TAXIWAY': 'TW', 
    'INSTRUMENT': 'AD',
    'NAVIGATION': 'AD',
    'COMMUNICATION': 'AC',
    'SERVICE': 'SVC',
    'DOMESTIC': 'DOM',
    'INTERNATIONAL': 'INTL',
    'AERODROME': 'AA'
  };
  
  return classificationMap[code] || code.substr(0, 3);
}

function extractQLineFromText(text) {
  if (!text) return '';
  const qLineMatch = text.match(/Q\)[^\r\n]+/);
  return qLineMatch ? qLineMatch[0] : '';
}

// Status endpoint
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

// ENHANCED: NOTAM API endpoint with improved CFPS fallback
app.get('/api/notams', async (req, res) => {
  const startTime = Date.now();
  const icao = (req.query.icao || '').toUpperCase().trim();
  
  console.log(`[${new Date().toISOString()}] NOTAM request for ICAO: ${icao}`);
  
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
      validateStatus: (status) => status < 500
    });

    console.log(`[${new Date().toISOString()}] FAA API response status: ${notamRes.status}`);
    
    if (notamRes.status === 429) {
      console.log(`[${new Date().toISOString()}] Rate limited for ${icao}`);
      return res.status(429).json({ 
        error: "Rate limited",
        message: "Too many requests to FAA API. Please try again later.",
        retryAfter: notamRes.headers['retry-after'] || 60
      });
    }
    
    if (notamRes.status >= 400) {
      console.log(`[${new Date().toISOString()}] FAA API error ${notamRes.status} for ${icao}`);
      // Try NAVCAN fallback for Canadian ICAOs immediately on FAA errors
      if (icao.startsWith('C')) {
        console.log(`[${new Date().toISOString()}] Trying NAV CANADA fallback after FAA error for ${icao}`);
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN (FAA fallback)'
            }
          });
        }
      }
      return res.status(notamRes.status).json({ 
        error: "FAA API error",
        status: notamRes.status,
        message: notamRes.data?.message || "Error from FAA API"
      });
    }

    if (!notamRes.data || !notamRes.data.items) {
      console.warn(`[${new Date().toISOString()}] FAA payload missing data/items for ${icao}`);
      
      // Try NAVCAN fallback for Canadian ICAOs
      if (icao.startsWith('C')) {
        console.log(`[${new Date().toISOString()}] Trying NAV CANADA fallback for ${icao}`);
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN (FAA empty)'
            }
          });
        }
      }
      return res.status(500).json({ error: "Unexpected response format from FAA API" });
    }

    // Parse FAA NOTAMs
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
      }).filter(Boolean);
      
    } catch (parseErr) {
      console.error(`[${new Date().toISOString()}] Failed to parse NOTAM data for ${icao}:`, parseErr);
      return res.status(500).json({ 
        error: "Failed to parse NOTAM data", 
        details: parseErr.message 
      });
    }

    console.log(`[${new Date().toISOString()}] Successfully parsed ${parsed.length} NOTAMs for ${icao}`);

    // Filter for valid NOTAMs
    const now = new Date();
    const validNotams = parsed.filter(notam => {
      if (!notam.validTo) return true;
      try {
        return new Date(notam.validTo) >= now;
      } catch {
        return true;
      }
    });

    // If FAA returned zero valid notams AND ICAO is Canadian, attempt NAV CANADA fallback
    if ((validNotams.length === 0 || parsed.length === 0) && icao.startsWith('C')) {
      console.log(`[${new Date().toISOString()}] FAA returned zero NOTAMs for ${icao}, trying NAV CANADA fallback`);
      const navNotams = await fetchNavCanadaNotamsServerSide(icao);
      if (navNotams && navNotams.length > 0) {
        const processingTime = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] Returning ${navNotams.length} NAVCAN NOTAMs for ${icao} (${processingTime}ms)`);
        return res.json({
          data: navNotams,
          metadata: {
            icao,
            total: navNotams.length,
            processingTime,
            timestamp: new Date().toISOString(),
            source: 'NAVCAN (FAA zero results)'
          }
        });
      }
      console.log(`[${new Date().toISOString()}] NAV CANADA fallback returned no results for ${icao}`);
    }

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
    
    // Try NAV CANADA fallback for Canadian ICAOs on any error
    if (icao.startsWith('C')) {
      try {
        console.log(`[${new Date().toISOString()}] Attempting NAV CANADA fallback after error for ${icao}`);
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN (Error fallback)'
            }
          });
        }
      } catch (navErr) {
        console.error(`[${new Date().toISOString()}] NAV CANADA fallback failed for ${icao}:`, navErr);
      }
    }
    
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
