// Enhanced CFPS Parser V2 - Handle complex NAV CANADA JSON structure

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
      qLine: ''
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

function normalizeDateString(dateStr) {
  if (!dateStr) return '';
  
  try {
    let normalizedDate = dateStr.toString().trim();
    
    // Handle ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) {
      const date = new Date(normalizedDate);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    // Handle NOTAM date format: YYMMDDHHMM
    if (/^\d{10}$/.test(normalizedDate)) {
      const year = 2000 + parseInt(normalizedDate.substr(0, 2));
      const month = parseInt(normalizedDate.substr(2, 2)) - 1;
      const day = parseInt(normalizedDate.substr(4, 2));
      const hour = parseInt(normalizedDate.substr(6, 2));
      const minute = parseInt(normalizedDate.substr(8, 2));
      
      const date = new Date(year, month, day, hour, minute);
      return isNaN(date) ? '' : date.toISOString();
    }
    
    // Handle YYYYMMDDHHMM format
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

function determineClassification(parsedContent, qLine) {
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
    
    // Determine classification
    const classification = determineClassification(parsedContent, parsedContent.qLine);
    
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

// Export the functions for use in server
module.exports = {
  parseNotamText,
  normalizeCFPSNotam,
  normalizeDateString,
  determineClassification
};
