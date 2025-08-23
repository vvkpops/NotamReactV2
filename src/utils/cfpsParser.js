// Enhanced CFPS Parser - Clean and format NAV CANADA data properly

/**
 * Parse and clean NAV CANADA CFPS NOTAM data with proper formatting
 * @param {string} icao - ICAO code
 * @param {Object} rawData - Raw JSON response from CFPS
 * @returns {Array} Normalized and cleaned NOTAM array
 */
export function parseCFPSResponse(icao, rawData) {
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

/**
 * Extract NOTAM items from various CFPS response structures
 */
function extractCFPSItems(rawData, icao) {
  let items = [];

  // Try different response structures
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

/**
 * Enhanced NOTAM normalization with proper content parsing
 */
function normalizeCFPSNotam(item, icao, index) {
  try {
    // Extract basic identifiers
    const number = extractNotamNumber(item);
    const id = `${icao}-${number || index}`;
    
    // Parse the raw NOTAM text properly
    const parsedContent = parseNotamText(item);
    
    // Extract and format dates
    const dates = extractAndFormatDates(item);
    
    // Determine proper classification and type
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
 * Enhanced NOTAM text parsing - converts raw CFPS format to clean content
 */
function parseNotamText(item) {
  // Get the raw text from various possible fields
  const rawText = item.raw || 
                  item.text || 
                  item.message || 
                  item.fullText ||
                  item.summary ||
                  '';

  if (!rawText) {
    return {
      summary: 'NOTAM information not available',
      body: '',
      qLine: ''
    };
  }

  // Split the NOTAM into sections
  const sections = parseNotamSections(rawText);
  
  // Extract Q-Line
  const qLine = sections.qLine || extractQLineFromText(rawText);
  
  // Create clean summary from the main content
  const summary = createCleanSummary(sections.mainContent, sections.location);
  
  // Create body with additional details
  const body = createCleanBody(sections, rawText);

  return {
    summary: summary || 'NOTAM content not available',
    body: body || summary || 'NOTAM content not available',
    qLine: qLine || ''
  };
}

/**
 * Parse NOTAM into logical sections
 */
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
      // Likely location info
      location = trimmedLine;
    } else if (trimmedLine.match(/^\d{10,12}/)) {
      // Likely validity dates
      validityInfo = trimmedLine;
    } else if (trimmedLine.length > 10 && !trimmedLine.match(/^[A-Z]\)/)) {
      // Main content (not section headers)
      if (!mainContent && trimmedLine.length > 20) {
        mainContent = trimmedLine;
      } else {
        additionalInfo.push(trimmedLine);
      }
    }
  }

  return {
    qLine,
    mainContent,
    location,
    validityInfo,
    additionalInfo
  };
}

/**
 * Create a clean, readable summary from raw content
 */
function createCleanSummary(mainContent, location) {
  if (!mainContent) return '';

  let summary = mainContent;

  // Clean up common CFPS formatting issues
  summary = summary
    // Remove excessive periods and spaces
    .replace(/\.{2,}/g, '. ')
    .replace(/\s{2,}/g, ' ')
    // Fix common abbreviations
    .replace(/\bRWY\b/g, 'RUNWAY')
    .replace(/\bTWY\b/g, 'TAXIWAY')
    .replace(/\bCLSD\b/g, 'CLOSED')
    .replace(/\bU\/S\b/g, 'UNSERVICEABLE')
    .replace(/\bO\/S\b/g, 'OUT OF SERVICE')
    // Clean up technical codes
    .replace(/\s+\([^)]*\)\s*/g, ' ')
    .replace(/[{}[\]]/g, '')
    .trim();

  // Limit summary length
  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }

  return summary;
}

/**
 * Create detailed body content
 */
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

  // Clean up the body text
  body = body
    .replace(/[\r\n]{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return body || sections.mainContent || originalText.substring(0, 500);
}

/**
 * Extract Q-Line from text
 */
function extractQLineFromText(text) {
  const qLineMatch = text.match(/Q\)[^\r\n]+/);
  return qLineMatch ? qLineMatch[0] : '';
}

/**
 * Enhanced date extraction and formatting
 */
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

/**
 * Enhanced date normalization with multiple format support
 */
function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  
  try {
    let normalizedDate = dateStr.toString().trim();
    
    // Handle ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      const date = new Date(normalizedDate);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    // Handle NOTAM date format: YYMMDDHHMM or YYYYMMDDHHMM
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
    
    // Try standard date parsing
    const date = new Date(normalizedDate);
    return isNaN(date) ? '' : date.toISOString();
    
  } catch (error) {
    console.warn(`[CFPS] Failed to normalize date: ${dateStr}`);
    return '';
  }
}

/**
 * Determine proper NOTAM classification from content
 */
function determineClassification(parsedContent) {
  const content = (parsedContent.summary + ' ' + parsedContent.body + ' ' + parsedContent.qLine).toUpperCase();
  
  // Check Q-Line first for accurate classification
  if (parsedContent.qLine) {
    const qLineParts = parsedContent.qLine.split('/');
    if (qLineParts.length >= 2) {
      const code = qLineParts[1];
      if (code.length >= 2) {
        const classCode = code.substr(0, 2);
        // Map common Q-codes to classifications
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
  
  // Fallback to content-based classification
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
  
  return 'AO'; // Other
}

/**
 * Determine NOTAM type
 */
function determineNotamType(item, parsedContent) {
  // Check explicit type field
  if (item.type && /^[A-Z]$/.test(item.type)) {
    return item.type;
  }
  
  // Check content for cancellation indicators
  const content = (parsedContent.summary + ' ' + parsedContent.body).toUpperCase();
  if (/\b(CANCEL|CNL|CANCELLED)\b/i.test(content)) {
    return 'C';
  }
  
  // Default to 'A' for Active NOTAMs
  return 'A';
}

// Export the main parsing function
export { parseCFPSResponse };
