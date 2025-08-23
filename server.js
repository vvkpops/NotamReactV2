// server.js - Updated with enhanced CFPS parser
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
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

// CORS configuration
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

// Load FAA API credentials
let CLIENT_ID, CLIENT_SECRET;

try {
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    if (fs.existsSync('./config.json')) {
      const config = require('./config.json');
      CLIENT_ID = config.faa_client_id;
      CLIENT_SECRET = config.faa_client_secret;
      console.log("✅ Credentials loaded from config.json");
    }
  } else {
    console.log("✅ Credentials loaded from environment variables");
  }
  
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("FAA API credentials not found");
  }
  
} catch (err) {
  console.error("❌ ERROR LOADING CREDENTIALS:", err.message);
  process.exit(1);
}

// Serve static files
app.use(express.static(path.join(__dirname, 'build'), {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Health check endpoint
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

// ENHANCED CFPS Parser Functions
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
    const keys = Object.keys(rawData);
    for (const key of keys) {
      if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
        const firstItem = rawData[key][0];
        if (typeof firstItem === 'object' && firstItem !== null && hasNotamCharacteristics(firstItem)) {
          items = rawData[key];
          console.log(`[CFPS] Found NOTAM data in key: ${key}`);
          break;
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
    const number = extractNotamNumber(item);
    const id = `${icao}-${number || index}`;
    
    // Enhanced content parsing
    const parsedContent = parseNotamText(item);
    const dates = extractAndFormatDates(item);
    const classification = determineClassification(parsedContent);
    const type = determineNotamType(item, parsedContent);

    return {
      id,
      number: number || '',
      type,
      classification,
      icao: icao.toUpperCase(),
      location: item.site || item.icao || icao.toUpperCase(),
      validFrom: dates.validFrom,
      validTo: dates.validTo,
      summary: parsedContent.summary,
      body: parsedContent.body,
      qLine: parsedContent.qLine,
      issued: dates.issued,
      source: 'NAVCAN',
      rawOriginal: item,
      processedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error(`[CFPS] Error normalizing NOTAM item ${index}:`, error);
    return null;
  }
}

function extractNotamNumber(item) {
  return item.id || item.notamId || item.number || item.notam_id || '';
}

function parseNotamText(item) {
  const rawText = item.raw || item.text || item.message || item.fullText || item.summary || '';

  if (!rawText) {
    return {
      summary: 'NOTAM information not available',
      body: '',
      qLine: ''
    };
  }

  const sections = parseNotamSections(rawText);
  const qLine = sections.qLine || extractQLineFromText(rawText);
  const summary = createCleanSummary(sections.mainContent, sections.location);
  const body = createCleanBody(sections, rawText);

  return {
    summary: summary || 'NOTAM content not available',
    body: body || summary || 'NOTAM content not available',
    qLine: qLine || ''
  };
}

function parseNotamSections(rawText) {
  const lines = rawText.split(/[\r\n]+/).filter(line => line.trim());
  
  let qLine = '';
  let mainContent = '';
  let location = '';
  let validityInfo = '';
  let additionalInfo = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('Q)')) {
      qLine = trimmedLine;
    } else if (trimmedLine.match(/^[A-Z]{4}\s+/)) {
      location = trimmedLine;
    } else if (trimmedLine.match(/^\d{10,12}/)) {
      validityInfo = trimmedLine;
    } else if (trimmedLine.length > 10 && !trimmedLine.match(/^[A-Z]\)/)) {
      if (!mainContent && trimmedLine.length > 20) {
        mainContent = trimmedLine;
      } else {
        additionalInfo.push(trimmedLine);
      }
    }
  }

  return { qLine, mainContent, location, validityInfo, additionalInfo };
}

function createCleanSummary(mainContent, location) {
  if (!mainContent) return '';

  let summary = mainContent;

  // Clean up common CFPS formatting issues
  summary = summary
    .replace(/\.{2,}/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\bRWY\b/g, 'RUNWAY')
    .replace(/\bTWY\b/g, 'TAXIWAY')
    .replace(/\bCLSD\b/g, 'CLOSED')
    .replace(/\bU\/S\b/g, 'UNSERVICEABLE')
    .replace(/\bO\/S\b/g, 'OUT OF SERVICE')
    .replace(/\s+\([^)]*\)\s*/g, ' ')
    .replace(/[{}[\]]/g, '')
    .trim();

  // Limit summary length
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }

  return summary;
}

function createCleanBody(sections, originalText) {
  let body = '';

  if (sections.mainContent) {
    body += sections.mainContent;
  }

  if (sections.additionalInfo.length > 0) {
    body += (body ? '\n\n' : '') + sections.additionalInfo.join('\n');
  }

  if (sections.validityInfo) {
    body += (body ? '\n\n' : '') + 'Validity: ' + sections.validityInfo;
  }

  body = body
    .replace(/[\r\n]{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return body || sections.mainContent || originalText.substring(0, 500);
}

function extractQLineFromText(text) {
  const qLineMatch = text.match(/Q\)[^\r\n]+/);
  return qLineMatch ? qLineMatch[0] : '';
}

function extractAndFormatDates(item) {
  const validFrom = item.start || item.validFrom || item.effectiveStart || item.issued || '';
  const validTo = item.end || item.validTo || item.effectiveEnd || '';
  const issued = item.issued || item.issuedDate || item.start || '';

  return {
    validFrom: normalizeDateString(validFrom),
    validTo: normalizeDateString(validTo),
    issued: normalizeDateString(issued)
  };
}

function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  
  try {
    let normalizedDate = dateStr.toString().trim();
    
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      const date = new Date(normalizedDate);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    const date = new Date(normalizedDate);
    return isNaN(date) ? '' : date.toISOString();
    
  } catch (error) {
    console.warn(`[CFPS] Failed to normalize date: ${dateStr}`);
    return '';
  }
}

function determineClassification(parsedContent) {
  const content = (parsedContent.summary + ' ' + parsedContent.body + ' ' + parsedContent.qLine).toUpperCase();
  
  // Check Q-Line first for accurate classification
  if (parsedContent.qLine) {
    const qLineParts = parsedContent.qLine.split('/');
    if (qLineParts.length >= 2) {
      const code = qLineParts[1];
      if (code.length >= 2) {
        const classCode = code.substr(0, 2);
        const qCodeMap = {
          'QM': 'RW', // Runway
          'QT': 'TW', // Taxiway  
          'QI': 'AD', // ILS/Navigation
          'QF': 'SVC', // Fuel/Services
          'QA': 'AA', // Aerodrome
          'QR': 'AD', // Radio/Navigation
          'QC': 'AC'  // Communication
        };
        if (qCodeMap[classCode]) {
          return qCodeMap[classCode];
        }
      }
    }
  }
  
  // Content-based classification
  if (/\b(RUNWAY|RWY)\b.*\b(CLSD|CLOSED|CLOSURE)\b/i.test(content)) return 'RW';
  if (/\b(TAXIWAY|TWY)\b.*\b(CLSD|CLOSED|CLOSURE)\b/i.test(content)) return 'TW';
  if (/\b(RSC|RUNWAY\s+SURFACE\s+CONDITION)\b/i.test(content)) return 'RW';
  if (/\b(CRFI|CANADIAN\s+RUNWAY\s+FRICTION)\b/i.test(content)) return 'RW';
  if (/\b(ILS|INSTRUMENT\s+LANDING|LOCALIZER|GLIDESLOPE)\b/i.test(content)) return 'AD';
  if (/\b(FUEL|REFUEL|AVGAS|JET\s*A)/i.test(content)) return 'SVC';
  if (/\b(DOMESTIC\s+(ONLY|FLIGHTS?|OPERATIONS?))\b/i.test(content)) return 'DOM';
  if (/\b(APRON|RAMP|GATE|TERMINAL)\b/i.test(content)) return 'AA';
  if (/\b(NAV|NAVIGATION|VOR|DME|NDB)\b/i.test(content)) return 'AD';
  if (/\b(COM|COMMUNICATION|RADIO|FREQ|FREQUENCY)\b/i.test(content)) return 'AC';
  
  return 'AO';
}

function determineNotamType(item, parsedContent) {
  if (item.type && /^[A-Z]$/.test(item.type)) {
    return item.type;
  }
  
  const content = (parsedContent.summary + ' ' + parsedContent.body).toUpperCase();
  if (/\b(CANCEL|CNL|CANCELLED)\b/i.test(content)) {
    return 'C';
  }
  
  return 'A';
}

// Enhanced NAV CANADA CFPS helper
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

    // Use enhanced parsing
    return parseCFPSResponse(upperIcao, rawData);

  } catch (err) {
    console.error(`[NAVCAN] Error fetching ${upperIcao}:`, err.message || err);
    return [];
  }
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
      baseUrl: 'https://external-api.faa.gov/notamapi/v1',
      cfpsEnhanced: true
    }
  });
});

// Main NOTAM API endpoint
app.get('/api/notams', async (req, res) => {
  const startTime = Date.now();
  const icao = (req.query.icao || '').toUpperCase().trim();
  
  console.log(`[${new Date().toISOString()}] NOTAM request for ICAO: ${icao}`);
  
  if (!icao || icao.length !== 4 || !/^[A-Z]{4}$/.test(icao)) {
    return res.status(400).json({ 
      error: "Invalid ICAO code",
      message: "ICAO code must be exactly 4 uppercase letters",
      example: "KJFK"
    });
  }

  try {
    const url = `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}&responseFormat=geoJson&pageSize=1000`;
    
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
      return res.status(429).json({ 
        error: "Rate limited",
        message: "Too many requests to FAA API. Please try again later.",
        retryAfter: notamRes.headers['retry-after'] || 60
      });
    }
    
    if (notamRes.status >= 400) {
      console.log(`[${new Date().toISOString()}] FAA API error ${notamRes.status} for ${icao}`);
      
      // Try NAVCAN fallback for Canadian ICAOs
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
              source: 'NAVCAN (FAA fallback)',
              enhanced: true
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
              source: 'NAVCAN (FAA empty)',
              enhanced: true
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

    // Try NAVCAN fallback if no results from FAA for Canadian ICAOs
    if ((validNotams.length === 0 || parsed.length === 0) && icao.startsWith('C')) {
      console.log(`[${new Date().toISOString()}] FAA returned zero NOTAMs for ${icao}, trying NAV CANADA fallback`);
      const navNotams = await fetchNavCanadaNotamsServerSide(icao);
      if (navNotams && navNotams.length > 0) {
        return res.json({
          data: navNotams,
          metadata: {
            icao,
            total: navNotams.length,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            source: 'NAVCAN (FAA zero results)',
            enhanced: true
          }
        });
      }
    }

    // Sort by priority
    validNotams.sort((a, b) => {
      const isClosureA = /clsd|closed/i.test(a.summary);
      const isRscA = /rsc/i.test(a.summary);
      const isCrfiA = /crfi/i.test(a.summary);

      const isClosureB = /clsd|closed/i.test(b.summary);
      const isRscB = /rsc/i.test(b.summary);
      const isCrfiB = /crfi/i.test(b.summary);

      if (isClosureA && !isClosureB) return -1;
      if (!isClosureA && isClosureB) return 1;
      if (isRscA && !isRscB) return -1;
      if (!isRscA && isRscB) return 1;
      if (isCrfiA && !isCrfiB) return -1;
      if (!isCrfiA && isCrfiB) return 1;

      try {
        const dateA = new Date(a.validFrom || a.issued);
        const dateB = new Date(b.validFrom || b.issued);
        return dateB - dateA;
      } catch {
        return 0;
      }
    });

    const limitedNotams = validNotams.slice(0, 50);
    const processingTime = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] Sending ${limitedNotams.length} NOTAMs for ${icao} (${processingTime}ms)`);

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
    
    // Try NAV CANADA fallback on any error for Canadian ICAOs
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
              source: 'NAVCAN (Error fallback)',
              enhanced: true
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

// Catch all handler for React Router
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

// Utility function
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
  console.log(`✨ Enhanced CFPS Parser: Enabled`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
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

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
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
    
    if (/^\d{12}$/.test(normalizedDate)) {
      const year = parseInt(normalizedDate.substr(0, 4));
      const month = parseInt(normalizedDate.substr(4, 2)) - 1;
      const day = parseInt(normalizedDate.substr(6, 2));
      const hour = parseInt(normalizedDate.substr(8, 2));
      const minute = parseInt(normalizedDate.substr(10, 2));
      
      const date = new Date(year, month, day, hour, minute);
      return isNaN(date) ? '' : date.toISOString();
