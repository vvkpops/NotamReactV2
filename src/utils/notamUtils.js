// src/utils/notamUtils.js - Complete file with all exports

import { 
  ICAO_CLASSIFICATION_MAP, 
  NOTAM_TYPES
} from '../constants';

// Classification and type utilities
export const getClassificationTitle = (classification) => {
  if (!classification) return "Other";
  const code = classification.trim().toUpperCase();
  return ICAO_CLASSIFICATION_MAP[code] || "Other";
};

export const parseDate = (s) => {
  if (!s) return null;
  let iso = s.trim().replace(' ', 'T');
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) iso += 'Z';
  let d = new Date(iso);
  return isNaN(d) ? null : d;
};

export const isNotamCurrent = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return !validFrom || validFrom <= now;
};

export const isNotamFuture = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return validFrom && validFrom > now;
};

export const getNotamFlags = (notam) => {
  const s = (notam.summary + ' ' + notam.body).toUpperCase();
  return {
    isRunwayClosure: /\b(RWY|RUNWAY)[^\n]*\b(CLSD|CLOSED)\b/.test(s),
    isTaxiwayClosure: /\b(TWY|TAXIWAY)[^\n]*\b(CLSD|CLOSED)\b/.test(s),
    isRSC: /\bRSC\b/.test(s),
    isCRFI: /\bCRFI\b/.test(s),
    isILS: /\bILS\b/.test(s) && !/\bCLOSED|CLSD\b/.test(s),
    isFuel: /\bFUEL\b/.test(s),
    isCancelled: notam.type === "C" || /\b(CANCELLED|CNL)\b/.test(s),
    isDom: isDomesticNotam(notam)
  };
};

// SEPARATE FUNCTION: More precise domestic NOTAM detection
export const isDomesticNotam = (notam) => {
  // 1. Check exact classification match for DOM
  if (notam.classification === 'DOM' || notam.classification === 'DOMESTIC') {
    return true;
  }
  
  // 2. Check if type is specifically DOM (less common but possible)
  if (notam.type === 'DOM') {
    return true;
  }
  
  // 3. For NAV CANADA, check for Canadian domestic patterns
  if (notam.source === 'NAVCAN') {
    // Canadian NOTAMs might use different domestic indicators
    if (notam.classification && /^(D|DOM|DOMESTIC)$/i.test(notam.classification.trim())) {
      return true;
    }
    // Check if the NOTAM specifically mentions domestic operations
    if (notam.summary && /\bDOMESTIC\s+(OPERATIONS?|FLIGHTS?|ONLY)\b/i.test(notam.summary)) {
      return true;
    }
  }
  
  // 4. Check Q-Line for domestic indicators (ICAO standard)
  if (notam.qLine) {
    // Q-Line format often contains scope information
    // Look for domestic scope indicators
    if (/\/IV\//.test(notam.qLine)) { // International/Domestic indicator
      return false; // IV typically means international
    }
    if (/\/NBO\//.test(notam.qLine)) { // National/Domestic operations
      return true;
    }
  }
  
  // 5. Last resort: Check content for explicit domestic restrictions
  const content = ((notam.summary || '') + ' ' + (notam.body || '')).toUpperCase();
  if (/\b(DOMESTIC\s+(ONLY|FLIGHTS?|OPERATIONS?)|FOR\s+DOMESTIC\s+USE)\b/.test(content)) {
    return true;
  }
  
  return false;
};

// MISSING EXPORT: getNotamType function
export const getNotamType = (notam) => {
  const flags = getNotamFlags(notam);
  if (flags.isRunwayClosure) return 'rwy';
  if (flags.isTaxiwayClosure) return 'twy';
  if (flags.isRSC) return 'rsc';
  if (flags.isCRFI) return 'crfi';
  if (flags.isILS) return 'ils';
  if (flags.isFuel) return 'fuel';
  if (flags.isCancelled) return 'cancelled';
  return 'other';
};

// MISSING EXPORT: getHeadClass function
export const getHeadClass = (notam) => {
  const type = getNotamType(notam);
  return `head-${type}`;
};

// MISSING EXPORT: getHeadTitle function
export const getHeadTitle = (notam) => {
  const type = getNotamType(notam);
  return NOTAM_TYPES[type] || 'GENERAL NOTAM';
};

// MISSING EXPORT: extractRunways function
export const extractRunways = (text) => {
  const rwyMatches = [];
  const regex = /\bRWY\s*(\d{2,3}(?:[LRC])?(?:\/\d{2,3}(?:[LRC])?)*)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    rwyMatches.push(match[1]);
  }
  return [...new Set(rwyMatches)].join(', ');
};

// MISSING EXPORT: needsExpansion function
export const needsExpansion = (summary, body, cardScale = 1.0) => {
  if (!summary) return false;
  
  const baseLength = 250;
  const adjustedThreshold = Math.round(baseLength * cardScale);
  const totalLength = (summary ? summary.length : 0) + (body ? body.length : 0);
  
  return totalLength > adjustedThreshold || (summary && summary.length > adjustedThreshold * 0.8);
};

// HYBRID SOLUTION: Simplified isNewNotam function (vanilla JS approach)
export const isNewNotam = (notam) => {
  // VANILLA JS APPROACH: Simple 60-minute window for "new" highlighting
  const issuedDate = parseDate(notam.issued || notam.validFrom);
  if (!issuedDate) return false;
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  return issuedDate > sixtyMinutesAgo;
};

// HYBRID SOLUTION: Simplified compareNotamSets function
export const compareNotamSets = (icao, previousNotams, newNotams) => {
  // VANILLA JS APPROACH: Simple key-based comparison without over-filtering
  const createNotamKey = (notam) => {
    // Use the same key format as vanilla JS
    return notam.id || notam.number || notam.qLine || notam.summary;
  };
  
  const prevKeys = new Set((previousNotams || []).map(createNotamKey));
  const newKeys = new Set((newNotams || []).map(createNotamKey));
  
  // Simple addition/removal detection - no complex time filtering
  const addedNotams = (newNotams || []).filter(notam => {
    const key = createNotamKey(notam);
    return !prevKeys.has(key);
  });
  
  const removedNotams = (previousNotams || []).filter(notam => {
    const key = createNotamKey(notam);
    return !newKeys.has(key);
  });
  
  return {
    added: addedNotams,  // Return ALL added NOTAMs, no filtering
    removed: removedNotams,
    total: newNotams ? newNotams.length : 0
  };
};

// Filter and sorting utilities
export const applyNotamFilters = (notams, filters, keywordFilter) => {
  return notams.filter(notam => {
    const flags = getNotamFlags(notam);
    const notamType = getNotamType(notam);
    const text = (notam.summary + ' ' + notam.body).toLowerCase();
    
    // Apply keyword filter first
    if (keywordFilter && !text.includes(keywordFilter.toLowerCase())) {
      return false;
    }
    
    // Apply type filters
    if (notamType === 'rwy' && !filters.rwy) return false;
    if (notamType === 'twy' && !filters.twy) return false;
    if (notamType === 'rsc' && !filters.rsc) return false;
    if (notamType === 'crfi' && !filters.crfi) return false;
    if (notamType === 'ils' && !filters.ils) return false;
    if (notamType === 'fuel' && !filters.fuel) return false;
    if (notamType === 'other' && !filters.other) return false;
    if (notamType === 'cancelled' && !filters.cancelled) return false;
    
    // Apply DOM filter - Only filter out DOM NOTAMs if DOM filter is OFF
    if (flags.isDom && !filters.dom) {
      return false;
    }
    
    // Apply time filters
    const isCurrent = isNotamCurrent(notam);
    const isFuture = isNotamFuture(notam);
    
    if (isCurrent && !filters.current) return false;
    if (isFuture && !filters.future) return false;
    
    return true;
  });
};

export const sortNotams = (notams, sortBy = 'priority') => {
  const sortFunctions = {
    priority: (a, b) => {
      const types = ["rwy", "twy", "rsc", "crfi", "ils", "fuel", "other", "cancelled"];
      const aType = getNotamType(a);
      const bType = getNotamType(b);
      const aIndex = types.indexOf(aType);
      const bIndex = types.indexOf(bType);
      
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      
      const aDate = parseDate(a.validFrom) || new Date(0);
      const bDate = parseDate(b.validFrom) || new Date(0);
      return bDate - aDate;
    },
    
    date: (a, b) => {
      const aDate = parseDate(a.validFrom) || new Date(0);
      const bDate = parseDate(b.validFrom) || new Date(0);
      return bDate - aDate;
    },
    
    icao: (a, b) => {
      if (a.icao !== b.icao) {
        return a.icao.localeCompare(b.icao);
      }
      return sortFunctions.priority(a, b);
    },
    
    type: (a, b) => {
      const aType = getNotamType(a);
      const bType = getNotamType(b);
      if (aType !== bType) {
        return aType.localeCompare(bType);
      }
      return sortFunctions.date(a, b);
    }
  };
  
  return [...notams].sort(sortFunctions[sortBy] || sortFunctions.priority);
};

// Validation utilities
export const validateNotam = (notam) => {
  const errors = [];
  
  if (!notam.icao || !/^[A-Z]{4}$/.test(notam.icao)) {
    errors.push('Invalid ICAO code');
  }
  
  if (!notam.summary && !notam.body) {
    errors.push('Missing NOTAM content');
  }
  
  if (notam.validFrom && !parseDate(notam.validFrom)) {
    errors.push('Invalid validFrom date');
  }
  
  if (notam.validTo && !parseDate(notam.validTo)) {
    errors.push('Invalid validTo date');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Date formatting utilities
export const formatNotamDate = (dateString, format = 'short') => {
  const date = parseDate(dateString);
  if (!date) return 'Invalid Date';
  
  const formats = {
    short: { 
      year: '2-digit', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    },
    long: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      timeZoneName: 'short'
    },
    relative: null
  };
  
  if (format === 'relative') {
    const now = new Date();
    const diffMs = date - now;
    const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      const diffMinutes = Math.abs(diffMs) / (1000 * 60);
      return `${Math.round(diffMinutes)} minutes ${diffMs > 0 ? 'from now' : 'ago'}`;
    } else if (diffHours < 24) {
      return `${Math.round(diffHours)} hours ${diffMs > 0 ? 'from now' : 'ago'}`;
    } else {
      const diffDays = diffHours / 24;
      return `${Math.round(diffDays)} days ${diffMs > 0 ? 'from now' : 'ago'}`;
    }
  }
  
  return date.toLocaleString('en-US', formats[format] || formats.short);
};

// Search and export utilities
export const searchNotams = (notams, searchTerm) => {
  if (!searchTerm.trim()) return notams;
  
  const term = searchTerm.toLowerCase().trim();
  const searchFields = ['summary', 'body', 'qLine', 'number', 'icao', 'location'];
  
  return notams.filter(notam => {
    return searchFields.some(field => {
      const value = notam[field];
      return value && value.toString().toLowerCase().includes(term);
    });
  });
};

export const exportNotamsToCSV = (notams) => {
  const headers = ['ICAO', 'Number', 'Type', 'Classification', 'Valid From', 'Valid To', 'Summary'];
  const csvContent = [
    headers.join(','),
    ...notams.map(notam => [
      notam.icao || '',
      notam.number || '',
      notam.type || '',
      notam.classification || '',
      notam.validFrom || '',
      notam.validTo || '',
      `"${(notam.summary || '').replace(/"/g, '""')}"`
    ].join(','))
  ].join('\n');
  
  return csvContent;
};

export const exportNotamsToJSON = (notams) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    count: notams.length,
    notams: notams.map(notam => ({
      ...notam,
      exportedAt: new Date().toISOString()
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
};
