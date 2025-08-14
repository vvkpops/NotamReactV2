// Constants
export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const NEW_NOTAM_HIGHLIGHT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Batching Constants
export const ICAO_BATCH_SIZE = 3; // Number of ICAOs to process in one batch
export const ICAO_BATCH_INTERVAL_MS = 65 * 1000; // 65 seconds window for rate limiting
export const ICAO_BATCH_CALL_LIMIT = 30; // Max 30 calls per interval (FAA API limit)

// Check if a NOTAM should be shown despite filter settings (e.g., for new NOTAMs)
export const shouldShowDespiteFilters = (notam, newNotams) => {
  if (!notam || !newNotams) return false;
  
  // If it's a header card, not a real NOTAM
  if (notam.isIcaoHeader) return false;
  
  const icao = notam.icao;
  if (!icao || !newNotams[icao]) return false;
  
  // Check if this NOTAM is in the new NOTAMs list
  const notamKey = notam.id || notam.number || notam.qLine || notam.summary;
  return newNotams[icao].has(notamKey); // Using .has() since it's a Set
};

// Get NOTAM type for styling and filtering
export const getNotamType = (notam) => {
  if (!notam) return 'other';
  
  const text = (notam.summary + ' ' + (notam.body || '')).toLowerCase();
  
  if (/\brwy\b|runway|rw[y]?\s*\d+|^\w+\s+\d+\s+closed/i.test(text)) return 'rwy';
  if (/\btwy\b|taxiway|taxilane/i.test(text)) return 'twy';
  if (/\brsc\b|runway\s+surface\s+condition|condition\s+of\s+rwy/i.test(text)) return 'rsc';
  if (/\bcrfi\b|friction|breaking\s+action/i.test(text)) return 'crfi';
  if (/\bils\b|localizer|glidepath|approach|apch/i.test(text)) return 'ils';
  if (/\bfuel\b|avgas|jet\s*a1|100ll/i.test(text)) return 'fuel';
  if (/\bcancelled\b|\bcnl\b/i.test(text)) return 'cancelled';
  return 'other';
};

// Get header class for styling based on NOTAM type
export const getHeadClass = (notam) => {
  const type = getNotamType(notam);
  return `head-${type}`;
};

// Get header title based on NOTAM type
export const getHeadTitle = (notam) => {
  const type = getNotamType(notam);
  const titles = {
    'rwy': 'RUNWAY CLOSURE',
    'twy': 'TAXIWAY CLOSURE',
    'rsc': 'RUNWAY SURFACE CONDITION',
    'crfi': 'CANADIAN RUNWAY FRICTION INDEX',
    'ils': 'ILS/APPROACH',
    'fuel': 'FUEL AVAILABILITY',
    'cancelled': 'CANCELLED NOTAM',
    'other': 'OTHER NOTAM'
  };
  return titles[type] || 'OTHER NOTAM';
};

// Extract runway numbers from NOTAM text
export const extractRunways = (text) => {
  if (!text) return '';
  
  // Try to find standard runway patterns like RWY 07/25, Runway 14L/32R, etc.
  const runwayMatch = text.match(/\b(?:RW|RWY|RUNWAY)\s*(\d{1,2}[LCR]?(?:\/\d{1,2}[LCR]?)?)\b/i);
  if (runwayMatch) return runwayMatch[1].toUpperCase();
  
  // Try to find patterns like "07/25 CLOSED"
  const closedMatch = text.match(/\b(\d{1,2}[LCR]?(?:\/\d{1,2}[LCR]?))\s+(?:CLSD|CLOSED)\b/i);
  if (closedMatch) return closedMatch[1].toUpperCase();
  
  return '';
};

// Check if NOTAM needs expansion button (too long for fixed card)
export const needsExpansion = (summary) => {
  if (!summary) return false;
  
  // If text is longer than ~250 chars or has more than 5 lines
  return summary.length > 250 || summary.split('\n').length > 5;
};

// Get remaining time for a new NOTAM highlight (in seconds)
export const getNotamRemainingTime = (notam, expirationTimes) => {
  const key = notam.id || notam.number || notam.qLine || notam.summary;
  const expirationTime = expirationTimes[key];
  
  if (!expirationTime) return 0;
  
  const now = Date.now();
  const remainingMs = Math.max(0, expirationTime - now);
  return Math.ceil(remainingMs / 1000);
};

// Get classification title for display
export const getClassificationTitle = (classification) => {
  if (!classification) return "Unknown";
  
  const classifications = {
    'NOTAMC': 'Cancellation',
    'NOTAMN': 'New',
    'NOTAMR': 'Replacement',
    'NORMAL': 'Normal',
    'PERM': 'Permanent',
    'TEMP': 'Temporary'
  };
  
  return classifications[classification.toUpperCase()] || classification;
};

// Get detailed flags for NOTAM categories
export const getNotamFlags = (notam) => {
  if (!notam) return {};
  
  const text = (notam.summary + ' ' + (notam.body || '')).toLowerCase();
  
  return {
    isRunwayClosure: /\brwy\b|runway|rw[y]?\s*\d+|^\w+\s+\d+\s+closed/i.test(text),
    isTaxiwayClosure: /\btwy\b|taxiway|taxilane/i.test(text),
    isRSC: /\brsc\b|runway\s+surface\s+condition|condition\s+of\s+rwy/i.test(text),
    isCRFI: /\bcrfi\b|friction|breaking\s+action/i.test(text),
    isILS: /\bils\b|localizer|glidepath|approach|apch/i.test(text),
    isFuel: /\bfuel\b|avgas|jet\s*a1|100ll/i.test(text),
    isCancelled: /\bcancelled\b|\bcnl\b/i.test(text),
    isDom: /\bdom\b/i.test(text),
  };
};

// Check if a NOTAM is currently active (validFrom <= now <= validTo)
export const isNotamCurrent = (notam) => {
  if (!notam) return false;
  
  const now = new Date();
  
  try {
    const validFrom = notam.validFrom ? new Date(notam.validFrom) : null;
    const validTo = notam.validTo ? new Date(notam.validTo) : null;
    
    // If validFrom is missing or invalid, assume it's not current
    if (!validFrom) return false;
    
    // If validTo is missing, assume it's indefinite (current)
    if (!validTo) return validFrom <= now;
    
    // Current if now is between validFrom and validTo
    return validFrom <= now && now <= validTo;
  } catch (err) {
    console.error("Error parsing NOTAM dates:", err);
    return false;
  }
};

// Check if a NOTAM is for future activation (validFrom > now)
export const isNotamFuture = (notam) => {
  if (!notam) return false;
  
  const now = new Date();
  
  try {
    const validFrom = notam.validFrom ? new Date(notam.validFrom) : null;
    
    // If validFrom is missing or invalid, assume it's not future
    if (!validFrom) return false;
    
    // Future if validFrom is after now
    return validFrom > now;
  } catch (err) {
    console.error("Error parsing NOTAM dates:", err);
    return false;
  }
};

// Format date for display
export const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch (err) {
    return dateString;
  }
};

// Track new NOTAMs in state
export const trackNewNotams = (
  icao,
  newNotamKeys,
  setNewNotams,
  setFlashingIcaos,
  setPendingNewNotams
) => {
  // Add to newNotams tracking
  setNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) updated[icao] = new Set();
    
    newNotamKeys.forEach(key => updated[icao].add(key));
    return updated;
  });
  
  // Add to flashing ICAOs set
  setFlashingIcaos(prev => {
    const newSet = new Set(prev);
    newSet.add(icao);
    return newSet;
  });
  
  // Add to pending NOTAMs (waiting for tab view)
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) updated[icao] = new Set();
    
    newNotamKeys.forEach(key => updated[icao].add(key));
    return updated;
  });
};

// Setup timers for new NOTAM highlights
export const setupNotamTimers = (
  icao,
  notamKeys,
  notamExpirationTimes,
  notamTimers,
  setNewNotams,
  setFlashingIcaos,
  setNotamExpirationTimes,
  setNotamTimers,
  setPendingNewNotams
) => {
  // Set expiration times for each NOTAM
  const now = Date.now();
  const expirationTime = now + NEW_NOTAM_HIGHLIGHT_DURATION_MS;
  
  // Update expiration times
  setNotamExpirationTimes(prev => {
    const updated = { ...prev };
    notamKeys.forEach(key => {
      updated[key] = expirationTime;
    });
    return updated;
  });
  
  // Start timers for each NOTAM
  setNotamTimers(prev => {
    const updated = { ...prev };
    
    notamKeys.forEach(key => {
      // Clear existing timer if any
      if (updated[key]) clearInterval(updated[key]);
      
      // Set new timer for auto-removal of highlight
      updated[key] = setInterval(() => {
        // Remove highlight when timer expires
        setNewNotams(prev => {
          const updated = { ...prev };
          if (updated[icao]) {
            updated[icao].delete(key);
            
            // If no more new NOTAMs for this ICAO, remove it
            if (updated[icao].size === 0) {
              delete updated[icao];
              
              // Also remove from flashing ICAOs
              setFlashingIcaos(prev => {
                const newSet = new Set(prev);
                newSet.delete(icao);
                return newSet;
              });
            }
          }
          return updated;
        });
        
        // Remove from pendingNewNotams if it's there
        setPendingNewNotams(prev => {
          const updated = { ...prev };
          if (updated[icao]) {
            updated[icao].delete(key);
            if (updated[icao].size === 0) {
              delete updated[icao];
            }
          }
          return updated;
        });
        
        // Remove from expirationTimes
        setNotamExpirationTimes(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        
        // Clear timer
        clearInterval(updated[key]);
        delete updated[key];
        
        // Update timers state
        setNotamTimers(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }, NEW_NOTAM_HIGHLIGHT_DURATION_MS);
      
      return updated;
    });
    
    return updated;
  });
  
  // Remove these keys from pendingNewNotams since we're setting up timers for them now
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (updated[icao]) {
      notamKeys.forEach(key => updated[icao].delete(key));
      if (updated[icao].size === 0) {
        delete updated[icao];
      }
    }
    return updated;
  });
};
