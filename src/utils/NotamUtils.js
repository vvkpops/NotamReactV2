// Constants
export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const NEW_NOTAM_HIGHLIGHT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Check if a NOTAM should be shown despite filter settings (e.g., for new NOTAMs)
export const shouldShowDespiteFilters = (notam, newNotams) => {
  if (!notam || !newNotams) return false;
  
  // If it's a header card, not a real NOTAM
  if (notam.isIcaoHeader) return false;
  
  const icao = notam.icao;
  if (!icao || !newNotams[icao]) return false;
  
  // Check if this NOTAM is in the new NOTAMs list
  const notamKey = notam.id || notam.number || notam.qLine || notam.summary;
  return newNotams[icao].includes(notamKey);
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
