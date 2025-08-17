import { 
  ICAO_CLASSIFICATION_MAP, 
  NOTAM_TYPES,
  NEW_NOTAM_HIGHLIGHT_DURATION_MS 
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
    isDom: /\bDOM\b/.test(s)
  };
};

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

export const getHeadClass = (notam) => {
  const type = getNotamType(notam);
  return `head-${type}`;
};

export const getHeadTitle = (notam) => {
  const type = getNotamType(notam);
  return NOTAM_TYPES[type] || 'GENERAL NOTAM';
};

export const extractRunways = (text) => {
  const rwyMatches = [];
  const regex = /\bRWY\s*(\d{2,3}(?:[LRC])?(?:\/\d{2,3}(?:[LRC])?)*)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    rwyMatches.push(match[1]);
  }
  return [...new Set(rwyMatches)].join(', ');
};

export const needsExpansion = (summary) => {
  return summary && summary.length > 250;
};

export const shouldShowDespiteFilters = (notam, newNotams) => {
  const key = notam.id || notam.number || notam.qLine || notam.summary;
  return newNotams[notam.icao] && newNotams[notam.icao].has(key);
};

// New NOTAM tracking and management
export const trackNewNotams = (
  icao, 
  newNotamKeys, 
  setNewNotams, 
  setFlashingIcaos, 
  setPendingNewNotams
) => {
  // Add to flashing ICAOs
  setFlashingIcaos(prev => {
    const newSet = new Set(prev);
    newSet.add(icao);
    return newSet;
  });
  
  // Track new NOTAMs
  setNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) {
      updated[icao] = new Set();
    }
    
    // Add all new keys
    for (const key of newNotamKeys) {
      updated[icao].add(key);
    }
    
    return updated;
  });
  
  // Add to pending new NOTAMs
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (!updated[icao]) {
      updated[icao] = new Set();
    }
    
    // Add all new keys
    for (const key of newNotamKeys) {
      updated[icao].add(key);
    }
    
    return updated;
  });
};

// Setup timers for NOTAMs - called when ICAO tab is selected or on explicit setup
export const setupNotamTimers = (
  icao, 
  pendingKeys,
  notamExpirationTimes, 
  notamTimers,
  setNewNotams, 
  setFlashingIcaos, 
  setNotamExpirationTimes, 
  setNotamTimers,
  setPendingNewNotams
) => {
  if (!pendingKeys || pendingKeys.size === 0) return;
  
  // Remove these keys from pending
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (updated[icao]) {
      for (const key of pendingKeys) {
        updated[icao].delete(key);
      }
      
      if (updated[icao].size === 0) {
        delete updated[icao];
      }
    }
    return updated;
  });
  
  // Setup timers for each key
  for (const key of pendingKeys) {
    // Set expiration time for this NOTAM
    const expirationTime = Date.now() + NEW_NOTAM_HIGHLIGHT_DURATION_MS;
    setNotamExpirationTimes(prev => ({
      ...prev,
      [key]: expirationTime
    }));
    
    // Clear any existing timer
    if (notamTimers[key]) {
      clearInterval(notamTimers[key]);
    }
    
    // Set up a timer for this NOTAM
    const timerId = setInterval(() => {
      const now = Date.now();
      if (now >= expirationTime) {
        // Time's up - clear new status
        clearInterval(timerId);
        
        // Remove from newNotams
        setNewNotams(prev => {
          const updated = { ...prev };
          if (updated[icao] && updated[icao].has(key)) {
            updated[icao].delete(key);
            if (updated[icao].size === 0) {
              delete updated[icao];
              
              // Check if this was the last new NOTAM for this ICAO
              setFlashingIcaos(prev => {
                const newSet = new Set(prev);
                // Only remove if there are no other new NOTAMs for this ICAO
                if (!updated[icao] || updated[icao].size === 0) {
                  newSet.delete(icao);
                }
                return newSet;
              });
            }
          }
          return updated;
        });
        
        // Remove from timers and expiration times
        setNotamTimers(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
        
        setNotamExpirationTimes(prev => {
          const updated = { ...prev };
          delete updated[key];
          return updated;
        });
      }
    }, 1000);
    
    // Store timer ID
    setNotamTimers(prev => ({
      ...prev,
      [key]: timerId
    }));
  }
};

// Get remaining time for a specific NOTAM
export const getNotamRemainingTime = (notam, notamExpirationTimes) => {
  const key = notam.id || notam.number || notam.qLine || notam.summary;
  const expirationTime = notamExpirationTimes[key];
  
  if (!expirationTime) return 0;
  
  const remainingMs = Math.max(0, expirationTime - Date.now());
  return Math.ceil(remainingMs / 1000);
};

// Mark a NOTAM as viewed/no longer new
export const markNotamAsViewed = (notam, context) => {
  const {
    newNotams,
    setNewNotams,
    setFlashingIcaos,
    notamTimers,
    setNotamTimers,
    setNotamExpirationTimes,
    setPendingNewNotams,
    setNotifications,
    updateNotificationCount
  } = context;

  const key = notam.id || notam.number || notam.qLine || notam.summary;
  
  // Check if NOTAM is actually new
  if (!newNotams[notam.icao] || !newNotams[notam.icao].has(key)) {
    return;
  }
  
  // Clear timer if exists
  if (notamTimers[key]) {
    clearInterval(notamTimers[key]);
    
    setNotamTimers(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    
    setNotamExpirationTimes(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  }
  
  // Remove from newNotams
  setNewNotams(prev => {
    const updated = { ...prev };
    if (updated[notam.icao]) {
      updated[notam.icao].delete(key);
      if (updated[notam.icao].size === 0) {
        delete updated[notam.icao];
        
        setFlashingIcaos(prev => {
          const newSet = new Set(prev);
          newSet.delete(notam.icao);
          return newSet;
        });
      }
    }
    return updated;
  });
  
  setPendingNewNotams(prev => {
    const updated = { ...prev };
    if (updated[notam.icao]) {
      updated[notam.icao].delete(key);
      if (updated[notam.icao].size === 0) {
        delete updated[notam.icao];
      }
    }
    return updated;
  });
  
  // Update notifications
  if (setNotifications) {
    setNotifications(prev => 
      prev.map(notif => {
        if (notif.icao === notam.icao && notif.latestNewNotamKey === key) {
          return { ...notif, read: true };
        }
        return notif;
      })
    );
  }
  
  if (updateNotificationCount) {
    updateNotificationCount();
  }
};

// Filtering utilities
export const applyNotamFilters = (notams, filters, keywordFilter, newNotams) => {
  return notams.filter(notam => {
    // Always show new NOTAMs regardless of filters
    if (shouldShowDespiteFilters(notam, newNotams)) {
      return true;
    }
    
    const flags = getNotamFlags(notam);
    const notamType = getNotamType(notam);
    const text = (notam.summary + ' ' + notam.body).toLowerCase();
    
    // Apply keyword filter
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
    if (flags.isDom && !filters.dom) return false;
    
    // Apply time filters
    const isCurrent = isNotamCurrent(notam);
    const isFuture = isNotamFuture(notam);
    
    if (isCurrent && !filters.current) return false;
    if (isFuture && !filters.future) return false;
    
    return true;
  });
};

// Sorting utilities
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
      
      // Secondary sort by effective date (newest first)
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

// NOTAM validation utilities
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

// NOTAM formatting utilities
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
    relative: null // Will use relative time
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

// NOTAM search utilities
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

// Export utilities for external use
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
      `"${(notam.summary || '').replace(/"/g, '""')}"` // Escape quotes
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
