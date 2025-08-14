// Constants for configuration
export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const NEW_NOTAM_HIGHLIGHT_DURATION_MS = 180 * 1000; // 3 minutes
export const ICAO_BATCH_SIZE = 3;
export const ICAO_BATCH_INTERVAL_MS = 65 * 1000; // 65 seconds
export const ICAO_BATCH_CALL_LIMIT = 30;

// Parse date from string and handle invalid formats
export const parseDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr);
  } catch (e) {
    return null;
  }
};

// Get classification title from code
export const getClassificationTitle = (code) => {
  const map = {
    'N': 'Normal',
    'B': 'NOTAMB',
    'O': 'Operational',
    'V': 'NOTAMV',
    'D': 'Draft'
  };
  return map[code] || code || 'Unknown';
};

// Check if NOTAM is currently active
export const isNotamCurrent = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return !validFrom || validFrom <= now;
};

// Check if NOTAM is future (not yet active)
export const isNotamFuture = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return validFrom && validFrom > now;
};

// Extract NOTAM flags for filtering
export const getNotamFlags = (notam) => {
  const text = (notam.summary + ' ' + (notam.body || '')).toLowerCase();
  
  return {
    isRunwayClosure: /rwy|runway|rw[0-9]{2}/i.test(text) && /clsd|closed|closure/i.test(text),
    isTaxiwayClosure: /twy|taxiway/i.test(text) && /clsd|closed|closure/i.test(text),
    isRSC: /rsc|runway\s+surface\s+condition/i.test(text),
    isCRFI: /crfi|canadian\s+runway\s+friction\s+index/i.test(text),
    isILS: /ils|localizer|loc\/|glideslope|gs\/|vor|approach/i.test(text),
    isFuel: /fuel|refuel|avgas|jeta/i.test(text),
    isCancelled: /cancel|cnl/i.test(text),
    isDom: /dom|domestic/i.test(text)
  };
};

// Get NOTAM type based on content
export const getNotamType = (notam) => {
  const flags = getNotamFlags(notam);
  
  if (flags.isRunwayClosure) return "rwy";
  if (flags.isTaxiwayClosure) return "twy";
  if (flags.isRSC) return "rsc";
  if (flags.isCRFI) return "crfi";
  if (flags.isILS) return "ils";
  if (flags.isFuel) return "fuel";
  if (flags.isCancelled) return "cancelled";
  return "other";
};

// Get header class for styling
export const getHeadClass = (notam) => {
  const type = getNotamType(notam);
  return `head-${type}`;
};

// Get readable header title
export const getHeadTitle = (notam) => {
  const type = getNotamType(notam);
  const titles = {
    "rwy": "Runway Closure",
    "twy": "Taxiway Closure",
    "rsc": "Runway Surface Condition",
    "crfi": "CRFI",
    "ils": "ILS/NAV",
    "fuel": "Fuel",
    "cancelled": "Cancelled",
    "other": "Other"
  };
  
  return titles[type] || "NOTAM";
};

// Extract runways from NOTAM text
export const extractRunways = (text) => {
  // Common runway patterns
  const patterns = [
    /RW?Y\s*(\d{2}[LCR]?\/\d{2}[LCR]?)/ig,  // RWY 07/25
    /RW?Y\s*(\d{2}[LCR]?)/ig,                // RWY 07
    /RUNWAY\s*(\d{2}[LCR]?\/\d{2}[LCR]?)/ig, // RUNWAY 07/25
    /RUNWAY\s*(\d{2}[LCR]?)/ig               // RUNWAY 07
  ];
  
  const runways = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      runways.push(match[1]);
    }
  }
  
  return runways.join(', ');
};

// Determine if NOTAM needs expansion button
export const needsExpansion = (text) => {
  if (!text) return false;
  return text.length > 150 || text.split('\n').length > 3;
};

// Setup timers for new NOTAMs
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
  // Set expiration time for each NOTAM
  const updatedExpirationTimes = { ...notamExpirationTimes };
  const now = Date.now();
  
  // Set timers for each NOTAM
  const newTimers = { ...notamTimers };
  
  notamKeys.forEach(key => {
    // Skip if timer already exists
    if (newTimers[key]) return;
    
    // Set expiration time (3 minutes from now)
    updatedExpirationTimes[key] = now + NEW_NOTAM_HIGHLIGHT_DURATION_MS;
    
    // Set a timer to remove the NOTAM from the new set after duration
    const timer = setInterval(() => {
      const currentTime = Date.now();
      const expirationTime = updatedExpirationTimes[key];
      
      if (currentTime >= expirationTime) {
        // Clear this timer
        clearInterval(newTimers[key]);
        
        // Remove from timers
        setNotamTimers(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        
        // Remove from expiration times
        setNotamExpirationTimes(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        
        // Remove from new NOTAMs
        setNewNotams(prev => {
          const updated = { ...prev };
          if (updated[icao]) {
            updated[icao].delete(key);
            if (updated[icao].size === 0) {
              delete updated[icao];
              
              // Remove from flashing ICAOs if this was the last new NOTAM
              setFlashingIcaos(prev => {
                const newSet = new Set(prev);
                newSet.delete(icao);
                return newSet;
              });
            }
          }
          return updated;
        });
      } else {
        // Update remaining time (for display) by forcing a state update
        setNotamExpirationTimes(prev => ({ ...prev }));
      }
    }, 1000); // Check every second
    
    newTimers[key] = timer;
  });
  
  // Update states
  setNotamExpirationTimes(updatedExpirationTimes);
  setNotamTimers(newTimers);
  
  // Remove these notams from pending
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (updated[icao]) {
      notamKeys.forEach(key => {
        updated[icao].delete(key);
      });
      if (updated[icao].size === 0) {
        delete updated[icao];
      }
    }
    return updated;
  });
};

// Track new NOTAMs without starting timers
export const trackNewNotams = (
  icao, 
  notamKeys, 
  setNewNotams, 
  setFlashingIcaos, 
  setPendingNewNotams
) => {
  // Add to new NOTAMs tracking
  setNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) {
      updated[icao] = new Set();
    }
    
    notamKeys.forEach(key => {
      updated[icao].add(key);
    });
    
    return updated;
  });
  
  // Add to flashing ICAOs
  setFlashingIcaos(prev => {
    const newSet = new Set(prev);
    newSet.add(icao);
    return newSet;
  });
  
  // Add to pending new NOTAMs (for timer setup when tab changes)
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) {
      updated[icao] = new Set();
    }
    
    notamKeys.forEach(key => {
      updated[icao].add(key);
    });
    
    return updated;
  });
};

// Get remaining time for display
export const getNotamRemainingTime = (notam, notamExpirationTimes) => {
  const key = notam.id || notam.number || notam.qLine || notam.summary;
  const expirationTime = notamExpirationTimes[key];
  
  if (!expirationTime) return 0;
  
  const remainingMs = Math.max(0, expirationTime - Date.now());
  return Math.floor(remainingMs / 1000);
};

// Check if NOTAM should be shown despite filters (e.g., for new NOTAMs)
export const shouldShowDespiteFilters = (notam, newNotams) => {
  const icao = notam.icao;
  const key = notam.id || notam.number || notam.qLine || notam.summary;
  
  return newNotams[icao] && newNotams[icao].has(key);
};