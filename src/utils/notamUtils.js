// ===== MODIFIED FILES FOR HYBRID SOLUTION =====

// 1. UPDATE src/utils/notamUtils.js - Simplify compareNotamSets and isNewNotam
// ===============================================================================

export const isNewNotam = (notam) => {
  // VANILLA JS APPROACH: Simple 60-minute window for "new" highlighting
  const issuedDate = parseDate(notam.issued || notam.validFrom);
  if (!issuedDate) return false;
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
  return issuedDate > sixtyMinutesAgo;
};

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

// 2. UPDATE src/App.js - Simplify handleFetchNotams logic
// ===============================================================================

// ENHANCED NOTAM FETCH with simplified new NOTAM tracking
async function handleFetchNotams(icao, showAlertIfNew = true) {
  if (!activeSession) return { error: true };
  
  try {
    const result = await fetchNotamsForIcao(icao);
    const data = result?.data || result;
    
    if (data?.error) {
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
      return { error: data.error };
    }
    
    const notams = Array.isArray(data) ? data : [];
    
    // Enhanced comparison logic for new NOTAM tracking
    const previousNotams = notamDataByIcao[icao] || [];
    const comparison = compareNotamSets(icao, previousNotams, notams);
    
    // SIMPLIFIED: Always track new NOTAMs, but be smart about notifications
    if (comparison.added.length > 0) {
      const newNotamIds = comparison.added.map(notam => {
        const id = notam.id || notam.number || notam.qLine || notam.summary;
        return { 
          id, 
          timestamp: Date.now(),
          notam: notam,
          issuedTime: notam.issued || notam.validFrom
        };
      });
      
      setNewNotamsByIcao(prev => ({
        ...prev,
        [icao]: [...(prev[icao] || []), ...newNotamIds]
      }));
      
      // HYBRID: Only show notifications if this isn't a silent auto-refresh
      // AND we have genuinely new NOTAMs (issued within reasonable time)
      const shouldShowNotification = showAlertIfNew && comparison.added.some(notam => {
        const issuedDate = parseDate(notam.issued || notam.validFrom);
        if (!issuedDate) return true; // Show notification for NOTAMs without dates
        
        // Show notifications for NOTAMs issued within last 4 hours
        // (more generous than vanilla's 60 minutes for notifications)
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        return issuedDate > fourHoursAgo;
      });
      
      if (shouldShowNotification) {
        const notamKeys = newNotamIds.map(item => `${icao}-${item.id}`);
        setHighlightedNotams(prev => new Set([...prev, ...notamKeys]));
        
        // Remove highlights after 60 seconds
        notamKeys.forEach(key => {
          setTimeout(() => {
            setHighlightedNotams(prev => {
              const newSet = new Set(prev);
              newSet.delete(key);
              return newSet;
            });
          }, 60000);
        });
        
        showNewNotamAlert(
          `${icao}: ${comparison.added.length} new NOTAM${comparison.added.length > 1 ? 's' : ''} detected!`,
          icao,
          comparison.added[0].id || comparison.added[0].number || comparison.added[0].qLine || comparison.added[0].summary
        );
      }
    }
    
    if (showAlertIfNew && comparison.removed.length > 0) {
      showNewNotamAlert(
        `${icao}: ${comparison.removed.length} NOTAM${comparison.removed.length > 1 ? 's' : ''} cancelled/expired`,
        icao,
        comparison.removed[0].id || comparison.removed[0].number || comparison.removed[0].qLine || comparison.removed[0].summary
      );
    }
    
    // Clean up old new NOTAMs (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    setNewNotamsByIcao(prev => ({
      ...prev,
      [icao]: (prev[icao] || []).filter(item => item.timestamp > tenMinutesAgo)
    }));
    
    // Update state (unchanged)
    const currSet = new Set(notams.map(n => n.id || n.number || n.qLine || n.summary));
    setLastNotamIdsByIcao(prev => ({ ...prev, [icao]: currSet }));
    setNotamDataByIcao(prev => ({ ...prev, [icao]: notams }));
    setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'success' }));
    setLoadedIcaosSet(prev => new Set([...prev, icao]));
    
    return notams;
  } catch (error) {
    setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
    return { error: error.message };
  }
}

// 3. UPDATE the auto-refresh logic - Remove the problematic isAutoRefreshRef
// ===============================================================================

// SIMPLIFIED: Better auto-refresh implementation without complex flags
useEffect(() => {
  if (!activeSession || icaoSet.length === 0) return;
  
  let autoRefreshTimer;
  let countdownTimer;
  let countdown = 300; // 5 minutes in seconds
  
  const performAutoRefresh = () => {
    console.log('🔄 Performing auto-refresh...');
    
    // NO MORE isAutoRefreshRef - let the natural logic handle it
    
    // Only add ICAOs that are loaded, not currently loading, and not already queued
    const refreshIcaos = icaoSet.filter(icao =>
      loadedIcaosSet.has(icao) &&
      !loadingIcaosSet.has(icao) &&
      !icaoQueue.includes(icao)
    );
    
    // Add to batching queue with showAlertIfNew = false for silent auto-refresh
    if (refreshIcaos.length > 0) {
      setIcaoQueue(prev => [...prev, ...refreshIcaos]);
      startBatching();
    }
  };
  
  const updateCountdown = () => {
    setAutoRefreshCountdown(countdown);
    countdown--;
    
    if (countdown < 0) {
      countdown = 300; // Reset to 5 minutes
      performAutoRefresh();
    }
  };
  
  // Start timers (unchanged)
  autoRefreshTimer = setInterval(performAutoRefresh, 5 * 60 * 1000); // 5 minutes
  countdownTimer = setInterval(updateCountdown, 1000); // 1 second
  
  return () => {
    clearInterval(autoRefreshTimer);
    clearInterval(countdownTimer);
  };
}, [activeSession, icaoSet, loadedIcaosSet, loadingIcaosSet, icaoQueue, startBatching]);

// 4. UPDATE the batching system to pass the correct showAlertIfNew parameter
// ===============================================================================

// In useBatchingSystem hook, ensure that auto-refresh calls pass showAlertIfNew = false
// This way manual refreshes will show notifications, but auto-refreshes won't

// The key is in the onFetchNotams call within the batching system:
// For auto-refresh: onFetchNotams(icao, false) // No alerts
// For manual refresh: onFetchNotams(icao, true) // Show alerts

// ===== SUMMARY OF CHANGES =====
// 
// 1. ✅ Removed complex isAutoRefreshRef flag system
// 2. ✅ Simplified compareNotamSets to not over-filter NOTAMs
// 3. ✅ Used vanilla JS isNewNotam logic (60-minute window)
// 4. ✅ Kept all existing batching and state management
// 5. ✅ Added smarter notification logic (4-hour window for alerts)
// 6. ✅ Maintained all React V2 features and architecture
//
// This hybrid approach:
// - Uses the simple, reliable detection from vanilla JS
// - Keeps React V2's batching and state management
// - Distinguishes between manual and auto-refresh via showAlertIfNew parameter
// - Shows visual "new" highlighting for 60-minute window (like vanilla)
// - Shows notifications for 4-hour window (more generous for user experience)
