// cfpsParser.js - Dedicated NAV CANADA CFPS parsing utility

/**
 * Parse and clean NAV CANADA CFPS NOTAM data
 * @param {string} icao - ICAO code
 * @param {Object} rawData - Raw JSON response from CFPS
 * @returns {Array} Normalized NOTAM array
 */
export function parseCFPSResponse(icao, rawData) {
  if (!rawData || typeof rawData !== 'object') {
    console.log(`[CFPS] Empty or invalid payload for ${icao}`);
    return [];
  }

  // Step 1: Extract raw NOTAM items from various possible response structures
  const rawItems = extractCFPSItems(rawData, icao);
  
  if (!rawItems || rawItems.length === 0) {
    console.log(`[CFPS] No NOTAM items found for ${icao}`);
    return [];
  }

  // Step 2: Clean and normalize each item
  const normalizedNotams = rawItems.map((item, index) => {
    return normalizeCFPSNotam(item, icao, index);
  }).filter(Boolean); // Remove null items

  console.log(`[CFPS] Successfully parsed ${normalizedNotams.length} NOTAMs for ${icao}`);
  return normalizedNotams;
}

/**
 * Extract NOTAM items from various CFPS response structures
 */
function extractCFPSItems(rawData, icao) {
  let items = [];

  // Try different common response structures
  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (Array.isArray(rawData.alpha)) {
    items = rawData.alpha;
  } else if (Array.isArray(rawData.notams)) {
    items = rawData.notams;
  } else if (Array.isArray(rawData.data)) {
    items = rawData.data;
  } else if (rawData.report) {
    // Single report structure
    if (Array.isArray(rawData.report.notams)) {
      items = rawData.report.notams;
    } else if (Array.isArray(rawData.report.alpha)) {
      items = rawData.report.alpha;
    } else if (typeof rawData.report === 'object') {
      items = [rawData.report];
    }
  } else if (rawData[icao]) {
    // ICAO-keyed response
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
          // Check if this looks like NOTAM data
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

/**
 * Check if an object has characteristics of a NOTAM
 */
function hasNotamCharacteristics(obj) {
  const notamFields = ['id', 'notamId', 'number', 'text', 'raw', 'message', 'summary', 'start', 'end', 'issued', 'site', 'icao'];
  return notamFields.some(field => obj.hasOwnProperty(field));
}

/**
 * Normalize a single CFPS NOTAM item to match FAA structure
 */
function normalizeCFPSNotam(item, icao, index) {
  try {
    // Step 1: Extract basic identifiers
    const number = extractNotamNumber(item);
    const id = `${icao}-${number || index}`;
    
    // Step 2: Extract content
    const content = extractNotamContent(item);
    
    // Step 3: Extract dates
    const dates = extractNotamDates(item);
    
    // Step 4: Extract classification and type
    const classification = extractClassification(item, content);
    const type = extractNotamType(item, content);
    
    // Step 5: Extract Q-Line
    const qLine = extractQLine(item, content);

    return {
      id,
      number: number || '',
      type,
      classification,
      icao: icao.toUpperCase(),
      location: item.site || item.icao || icao.toUpperCase(),
      validFrom: dates.validFrom,
      validTo: dates.validTo,
      summary: content.summary,
      body: content.body,
      qLine,
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

/**
 * Extract NOTAM number/identifier
 */
function extractNotamNumber(item) {
  return item.id || 
         item.notamId || 
         item.notamNumber || 
         item.number || 
         item.notam_id ||
         '';
}

/**
 * Extract NOTAM content (summary and body)
 */
function extractNotamContent(item) {
  // Try different content fields
  const rawText = item.raw || 
                  item.text || 
                  item.message || 
                  item.fullText ||
                  item.summary ||
                  item.simpleText ||
                  '';

  const summaryText = item.summary || 
                      item.simpleText ||
                      item.text ||
                      rawText ||
                      '';

  const bodyText = item.fullText ||
                   item.text ||
                   item.raw ||
                   summaryText ||
                   '';

  // Clean up the text - remove excessive whitespace and newlines
  const cleanSummary = cleanNotamText(summaryText);
  const cleanBody = cleanNotamText(bodyText);

  return {
    summary: cleanSummary,
    body: cleanBody !== cleanSummary ? cleanBody : cleanSummary
  };
}

/**
 * Clean NOTAM text - normalize whitespace, remove control characters
 */
function cleanNotamText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable characters
    .trim();
}

/**
 * Extract NOTAM dates
 */
function extractNotamDates(item) {
  const validFrom = item.start || 
                    item.validFrom || 
                    item.effectiveStart ||
                    item.issued ||
                    item.startDate ||
                    '';

  const validTo = item.end || 
                  item.validTo || 
                  item.effectiveEnd ||
                  item.endDate ||
                  '';

  const issued = item.issued || 
                 item.issuedDate ||
                 item.start ||
                 '';

  return {
    validFrom: normalizeDateString(validFrom),
    validTo: normalizeDateString(validTo),
    issued: normalizeDateString(issued)
  };
}

/**
 * Normalize date strings to ISO format
 */
function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  
  try {
    // Handle various date formats from CFPS
    let normalizedDate = dateStr.toString().trim();
    
    // If it's already ISO-ish, try to parse it
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      const date = new Date(normalizedDate);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    // Handle NOTAM date format: YYMMDDHHMM
    if (/^\d{10}$/.test(normalizedDate)) {
      const year = 2000 + parseInt(normalizedDate.substr(0, 2));
      const month = parseInt(normalizedDate.substr(2, 2)) - 1; // JS months are 0-based
      const day = parseInt(normalizedDate.substr(4, 2));
      const hour = parseInt(normalizedDate.substr(6, 2));
      const minute = parseInt(normalizedDate.substr(8, 2));
      
      const date = new Date(year, month, day, hour, minute);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    // Try to parse as regular date
    const date = new Date(normalizedDate);
    return isNaN(date) ? '' : date.toISOString();
    
  } catch (error) {
    console.warn(`[CFPS] Failed to normalize date: ${dateStr}`);
    return '';
  }
}

/**
 * Extract NOTAM classification
 */
function extractClassification(item, content) {
  // Check explicit classification field
  if (item.classification) {
    return normalizeClassification(item.classification);
  }
  
  // Try to derive from Q-Line
  const qLine = item.qLine || item.qline || '';
  if (qLine) {
    // Q-Line format: Q) AREA/CODE/TRAFFIC/PURPOSE/SCOPE/LOWER/UPPER/COORDINATES
    const qLineParts = qLine.split('/');
    if (qLineParts.length >= 2) {
      const code = qLineParts[1];
      // Extract the first 2 characters for classification
      if (code.length >= 2) {
        return normalizeClassification(code.substr(0, 2));
      }
    }
  }
  
  // Try to derive from content
  const summary = content.summary.toUpperCase();
  if (summary.includes('RUNWAY') || summary.includes('RWY')) return 'RW';
  if (summary.includes('TAXIWAY') || summary.includes('TWY')) return 'TW';
  if (summary.includes('ILS') || summary.includes('INSTRUMENT')) return 'AD';
  if (summary.includes('FUEL')) return 'SVC';
  if (summary.includes('DOMESTIC')) return 'DOM';
  
  return 'AO'; // Other
}

/**
 * Normalize classification codes
 */
function normalizeClassification(classification) {
  if (!classification) return 'AO';
  
  const code = classification.toString().trim().toUpperCase();
  
  // Map common variations
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
  
  return classificationMap[code] || code.substr(0, 3); // Take first 3 chars as fallback
}

/**
 * Extract NOTAM type
 */
function extractNotamType(item, content) {
  // Check explicit type field
  if (item.type && /^[A-Z]$/.test(item.type)) {
    return item.type;
  }
  
  // Default to 'A' for Active NOTAMs (most common)
  return 'A';
}

/**
 * Extract Q-Line information
 */
function extractQLine(item, content) {
  // Check for explicit Q-Line
  if (item.qLine) return item.qLine;
  if (item.qline) return item.qline;
  
  // Try to find Q-Line in the raw text
  const rawText = item.raw || item.text || content.body || '';
  const qLineMatch = rawText.match(/Q\)[^\r\n]+/);
  if (qLineMatch) {
    return qLineMatch[0];
  }
  
  // Generate a basic Q-Line for Canadian NOTAMs
  const icao = item.site || item.icao || '';
  const classification = extractClassification(item, content);
  
  if (icao) {
    return `Q) ${icao}/${classification}XX/IV/NBO/A/000/999/`;
  }
  
  return '';
}

/**
 * Utility function to fetch and parse NAV CANADA CFPS data
 * This replaces the server-side fetchNavCanadaNotamsServerSide function
 */
export async function fetchNavCanadaNotams(icao) {
  const upperIcao = (icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(upperIcao)) {
    return [];
  }

  try {
    const navUrl = `https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
    console.log(`[CFPS] Fetching NAV CANADA data for ${upperIcao}`);

    const response = await fetch(navUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NOTAM-Dashboard-V2/Client'
      },
      timeout: 15000
    });

    if (!response.ok) {
      console.warn(`[CFPS] HTTP ${response.status} for ${upperIcao}`);
      return [];
    }

    const rawData = await response.json();
    return parseCFPSResponse(upperIcao, rawData);

  } catch (error) {
    console.error(`[CFPS] Error fetching/parsing data for ${upperIcao}:`, error);
    return [];
  }
}

/**
 * Enhanced fallback function for Canadian ICAOs that handles CORS via proxy
 */
export async function fetchNavCanadaNotamsWithProxy(icao) {
  const upperIcao = (icao || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(upperIcao)) {
    return [];
  }

  try {
    // Use CORS proxy for browser requests
    const proxyUrl = `https://corsproxy.io/?https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
    console.log(`[CFPS] Fetching via proxy for ${upperIcao}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[CFPS] Proxy request failed for ${upperIcao}: ${response.status}`);
      return [];
    }

    const rawData = await response.json();
    return parseCFPSResponse(upperIcao, rawData);

  } catch (error) {
    console.error(`[CFPS] Proxy request failed for ${upperIcao}:`, error);
    return [];
  }
}

// Export validation function for testing
export function validateParsedNotam(notam) {
  const required = ['id', 'icao', 'source'];
  const missing = required.filter(field => !notam[field]);
  
  if (missing.length > 0) {
    console.warn(`[CFPS] Missing required fields: ${missing.join(', ')}`);
    return false;
  }
  
  if (!notam.summary && !notam.body) {
    console.warn(`[CFPS] NOTAM has no content`);
    return false;
  }
  
  return true;
}
