function determineClassificationEnhanced(parsedContent, qLine) {
  // Check Q-Line first for most accurate classification
  if (qLine) {
    const qLineParts = qLine.split('/');
    if (qLineParts.length >= 2) {
      const code = qLineParts[1];
      if (code.length >= 2) {
        const classCode = code.substr(0, 2);
        const qCodeMap = {
          'QA': 'AA',  // Aerodrome
          'QF': 'SVC', // Fuel/Services 
          'QM': 'RW',  // Runway
          'QT': 'TW',  // Taxiway
          'QI': 'AD',  // ILS/Navigation
          'QR': 'AD',  // Radio/Navigation
          'QC': 'AC',  // Communication
          'QS': 'SVC', // Services
          'QL': 'AD',  // Lighting
          'QN': 'AD',  // Navigation
          'QO': 'AO'   // Other
        };
        if (qCodeMap[classCode]) {
          return qCodeMap[classCode];
        }
      }
    }
  }
  
  // Content-based classification as fallback
  const content = (parsedContent.summary + ' ' + parsedContent.body).toUpperCase();
  
  if (/\b(RUNWAY|RWY)\b.*\b(CLSD|CLOSED|CLOSURE)\b/i.test(content)) return 'RW';
  if (/\b(TAXIWAY|TWY)\b.*\b(CLSD|CLOSED|CLOSURE)\b/i.test(content)) return 'TW';
  if (/\b(RSC|RUNWAY\s+SURFACE\s+CONDITION)\b/i.test(content)) return 'RW';
  if (/\b(CRFI|CANADIAN\s+RUNWAY\s+FRICTION)\b/i.test(content)) return 'RW';
  if (/\b(ILS|INSTRUMENT\s+LANDING|LOCALIZER|GLIDESLOPE)\b/i.test(content)) return 'AD';
  if (/\b(FUEL|REFUEL|AVGAS|JET\s*A)\b/i.test(content)) return 'SVC';
  if (/\b(DOMESTIC\s+(ONLY|FLIGHTS?|OPERATIONS?))\b/i.test(content)) return 'DOM';
  if (/\b(APRON|RAMP|GATE|TERMINAL)\b/i.test(content)) return 'AA';
  if (/\b(NAV|NAVIGATION|VOR|DME|NDB)\b/i.test(content)) return 'AD';
  if (/\b(COM|COMMUNICATION|RADIO|FREQ|FREQUENCY)\b/i.test(content)) return 'AC';
  if (/\b(CAPACITY|DELAY|DEPARTURE|ARRIVAL)\b/i.test(content)) return 'AO';
  
  return 'AO'; // Other
}// server.js
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

// Enhanced CFPS Parser Functions
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

function parseNotamStructure(notamText) {
  const lines = notamText.split(/[\r\n]+/).map(line => line.trim()).filter(line => line);
  
  let qLine = '';
  let number = '';
  let validFrom = '';
  let validTo = '';
  let mainContent = '';
  let additionalLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Extract NOTAM number (e.g., H4435/25, A1234/25)
    if (!number) {
      const numberMatch = line.match(/\(([A-Z]\d+\/\d+)\s+NOTAMN?/);
      if (numberMatch) {
        number = numberMatch[1];
        continue;
      }
    }
    
    // Extract Q-Line
    if (line.startsWith('Q)')) {
      qLine = line;
      continue;
    }
    
    // Extract validity dates from A) and B) C) lines
    if (line.match(/^A\)\s*[A-Z]{4}/)) {
      // A) line contains location
      continue;
    }
    
    if (line.match(/^B\)\s*(\d{10})/)) {
      const dateMatch = line.match(/^B\)\s*(\d{10})/);
      if (dateMatch) {
        validFrom = dateMatch[1];
      }
      continue;
    }
    
    if (line.match(/^C\)\s*(\d{10})/)) {
      const dateMatch = line.match(/^C\)\s*(\d{10})/);
      if (dateMatch) {
        validTo = dateMatch[1];
      }
      continue;
    }
    
    // Extract main content from E) line
    if (line.startsWith('E)')) {
      mainContent = line.substring(2).trim();
      // Continue reading subsequent lines that are part of the E) section
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.match(/^[A-Z]\)/)) {
          // New section started
          break;
        }
        if (nextLine && !nextLine.includes('FR:') && !nextLine.includes('FRENCH:')) {
          mainContent += ' ' + nextLine;
        } else {
          break;
        }
      }
      continue;
    }
    
    // Collect other content that's not structural
    if (!line.match(/^[A-Z]\)/) && !line.includes('FR:') && !line.includes('FRENCH:') && line.length > 10) {
      additionalLines.push(line);
    }
  }

  // Clean up the main content
  const cleanContent = cleanNotamContent(mainContent);
  
  // Create summary (first sentence or up to 200 chars)
  const summary = createSummary(cleanContent);
  
  // Create body with additional context
  let body = cleanContent;
  if (additionalLines.length > 0) {
    body += '\n\n' + additionalLines.join('\n');
  }

  return {
    summary,
    body: body || cleanContent || 'NOTAM content not available',
    qLine,
    validFrom,
    validTo,
    number
  };
}

function cleanNotamContent(content) {
  if (!content) return '';
  
  return content
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Expand common abbreviations
    .replace(/\bDEP\b/g, 'DEPARTURE')
    .replace(/\bEXP\b/g, 'EXPECT')
    .replace(/\bDLA\b/g, 'DELAY')
    .replace(/\bCTC\b/g, 'CONTACT')
    .replace(/\bFIR\b/g, 'FLIGHT INFORMATION REGION')
    .replace(/\bIFR\b/g, 'INSTRUMENT FLIGHT RULES')
    .replace(/\bU\/S\b/g, 'UNSERVICEABLE')
    .replace(/\bCLSD\b/g, 'CLOSED')
    .replace(/\bRWY\b/g, 'RUNWAY')
    .replace(/\bTWY\b/g, 'TAXIWAY')
    // Clean up formatting
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s*\.\s*/g, '. ')
    .trim();
}

function createSummary(content) {
  if (!content) return 'NOTAM information not available';
  
  // Try to get first sentence
  const firstSentence = content.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 20 && firstSentence.length < 150) {
    return firstSentence.trim();
  }
  
  // Otherwise, take first 180 characters
  if (content.length > 180) {
    return content.substring(0, 177).trim() + '...';
  }
  
  return content.trim();
}

function extractQLineFromText(text) {
  const qLineMatch = text.match(/Q\)[^\r\n]+/);
  return qLineMatch ? qLineMatch[0] : '';
}

function parseNotamText(item) {
  // Handle different data structures from NAVCAN
  let rawText = '';
  let englishText = '';
  let frenchText = '';

  // Check if item has nested JSON structure
  if (item.raw && typeof item.raw === 'string') {
    try {
      const parsedRaw = JSON.parse(item.raw);
      rawText = parsedRaw.raw || parsedRaw.english || item.raw;
      englishText = parsedRaw.english || '';
      frenchText = parsedRaw.french || '';
    } catch (e) {
      rawText = item.raw;
    }
  } else if (item.text && typeof item.text === 'string') {
    try {
      const parsedText = JSON.parse(item.text);
      rawText = parsedText.raw || parsedText.english || item.text;
      englishText = parsedText.english || '';
      frenchText = parsedText.french || '';
    } catch (e) {
      rawText = item.text;
    }
  } else {
    // Try other fields
    rawText = item.raw || item.text || item.message || item.fullText || item.summary || '';
  }

  // If we still don't have content, return default
  if (!rawText) {
    return {
      summary: 'NOTAM information not available',
      body: '',
      qLine: '',
      validFrom: '',
      validTo: '',
      number: ''
    };
  }

  // Use English version if available, otherwise use raw
  const contentToProcess = englishText || rawText;
  
  // Parse the NOTAM structure
  const parsedNotam = parseNotamStructure(contentToProcess);
  
  return {
    summary: parsedNotam.summary,
    body: parsedNotam.body,
    qLine: parsedNotam.qLine,
    validFrom: parsedNotam.validFrom,
    validTo: parsedNotam.validTo,
    number: parsedNotam.number
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
    }
    
    const date = new Date(normalizedDate);
    return isNaN(date) ? '' : date.toISOString();
    
  } catch (error) {
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

function normalizeCFPSNotam(item, icao, index) {
  try {
    // Enhanced content parsing
    const parsedContent = parseNotamText(item);
    
    // Extract dates - try from parsed content first, then item fields
    const validFrom = normalizeDateString(
      parsedContent.validFrom || 
      item.start || 
      item.validFrom || 
      item.effectiveStart || 
      item.issued || 
      ''
    );
    
    const validTo = normalizeDateString(
      parsedContent.validTo || 
      item.end || 
      item.validTo || 
      item.effectiveEnd || 
      ''
    );
    
    const issued = normalizeDateString(
      item.issued || 
      item.issuedDate || 
      parsedContent.validFrom ||
      item.start || 
      ''
    );
    
    // Get NOTAM number from parsed content or item
    const number = parsedContent.number || item.id || item.notamId || item.number || '';
    
    // Generate ID
    const id = `${icao}-${number || index}`;
    
    // Determine classification using enhanced logic
    const classification = determineClassificationEnhanced(parsedContent, parsedContent.qLine);
    
    // Determine type
    const type = (item.type && /^[A-Z]$/.test(item.type)) ? item.type : 'A';

    return {
      id,
      number: number || '',
      type,
      classification,
      icao: icao.toUpperCase(),
      location: item.site || item.icao || icao.toUpperCase(),
      validFrom,
      validTo,
      summary: parsedContent.summary,
      body: parsedContent.body,
      qLine: parsedContent.qLine,
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

// Enhanced NAV CANADA CFPS helper with proper parsing
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

// NOTAM API endpoint with FAA primary and NAV CANADA server-side fallback
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

    // Verify response structure
    if (!notamRes.data) {
      console.error(`[${new Date().toISOString()}] Empty response data for ${icao}`);
      // Try NAVCAN fallback for Canadian ICAOs
      if (icao.startsWith('C')) {
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        return res.json({
          data: navNotams,
          metadata: {
            icao,
            total: navNotams.length,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            source: 'NAVCAN'
          }
        });
      }
      return res.status(500).json({ error: "Empty response from FAA API" });
    }
    
    // If FAA returned items array or equivalent
    if (!notamRes.data.items) {
      console.warn(`[${new Date().toISOString()}] FAA payload missing items array for ${icao}`, 
        JSON.stringify(notamRes.data).substring(0, 200));
      // If FAA returned a valid but empty payload, consider NAVCAN fallback for Canadian ICAOs
      if (icao.startsWith('C')) {
        const navNotams = await fetchNavCanadaNotamsServerSide(icao);
        if (navNotams && navNotams.length > 0) {
          return res.json({
            data: navNotams,
            metadata: {
              icao,
              total: navNotams.length,
              processingTime: Date.now() - startTime,
              timestamp: new Date().toISOString(),
              source: 'NAVCAN'
            }
          });
        }
      }
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
            source: 'NAVCAN'
          }
        });
      }
      console.log(`[${new Date().toISOString()}] NAV CANADA fallback returned no results for ${icao}`);
      // Continue to return FAA empty payload below (consistent behaviour)
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
