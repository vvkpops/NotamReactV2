import { useState, useEffect, useCallback } from 'react';
import { fetchNotamsForIcao } from '../services/api';
import {
  setupNotamTimers,
  trackNewNotams,
  isNotamCurrent,
  isNotamFuture
} from '../utils/NotamUtils';

export const useNotamData = (icaoSet, activeSession, tabMode) => {
  // Core state
  const [notamDataByIcao, setNotamDataByIcao] = useState({});
  const [notamFetchStatusByIcao, setNotamFetchStatusByIcao] = useState({});
  const [lastNotamIdsByIcao, setLastNotamIdsByIcao] = useState({});
  const [loadedIcaosSet, setLoadedIcaosSet] = useState(new Set());
  const [loadingIcaosSet, setLoadingIcaosSet] = useState(new Set());
  
  // New NOTAM tracking state with individual timers
  const [newNotams, setNewNotams] = useState({});
  const [flashingIcaos, setFlashingIcaos] = useState(new Set());
  const [notamExpirationTimes, setNotamExpirationTimes] = useState({});
  const [notamTimers, setNotamTimers] = useState({});
  const [pendingNewNotams, setPendingNewNotams] = useState({});

  // Function to fetch NOTAMs for a specific ICAO
  const fetchNotamsForIcaoWithTracking = useCallback(async (icao, showAlertIfNew = true, isBatch = false) => {
    if (!activeSession) return { error: true };
    
    if (!isBatch) {
      setLoadingIcaosSet(prev => new Set([...prev, icao]));
    }
    
    try {
      const data = await fetchNotamsForIcao(icao);
      
      if (data.error) {
        console.error(`Error fetching NOTAM for ${icao}:`, data.error);
        return { error: true };
      }
      
      if (!Array.isArray(data)) {
        console.error(`Invalid data format for ${icao}:`, data);
        return { error: true };
      }
      
      const prevSet = lastNotamIdsByIcao[icao] || new Set();
      const currSet = new Set(data.map(n => n.id || n.number || n.qLine || n.summary));
      
      // Detect new NOTAMs
      let newNotamKeys = new Set();
      if (showAlertIfNew) {
        let newCount = 0;
        for (const n of data) {
          const key = n.id || n.number || n.qLine || n.summary;
          if (key && !prevSet.has(key)) {
            newCount++;
            newNotamKeys.add(key);
          }
        }
        
        if (newCount > 0) {
          const alertText = `${icao}: ${newCount} new NOTAM${newCount > 1 ? 's' : ''} detected!`;
          
          // Track new NOTAMs but don't start timers yet
          trackNewNotams(
            icao, 
            newNotamKeys, 
            setNewNotams, 
            setFlashingIcaos, 
            setPendingNewNotams
          );
          
          // If this is the current tab, start timers immediately
          if (tabMode === icao) {
            setupNotamTimers(
              icao, 
              newNotamKeys,
              notamExpirationTimes, 
              notamTimers,
              setNewNotams, 
              setFlashingIcaos, 
              setNotamExpirationTimes, 
              setNotamTimers,
              setPendingNewNotams
            );
          }
          
          return { data, newCount, alertText, latestNewNotamKey: Array.from(newNotamKeys)[0] };
        }
      }
      
      setLastNotamIdsByIcao(prev => ({ ...prev, [icao]: currSet }));
      setNotamDataByIcao(prev => ({ ...prev, [icao]: data }));
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: true }));
      setLoadedIcaosSet(prev => new Set([...prev, icao]));
      
      return { data };
    } catch (err) {
      console.error(`Network error for ${icao}:`, err);
      return { error: true };
    } finally {
      if (!isBatch) {
        setLoadingIcaosSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(icao);
          return newSet;
        });
      }
    }
  }, [activeSession, lastNotamIdsByIcao, notamExpirationTimes, notamTimers, tabMode]);

  // Function to mark a NOTAM as viewed
  const markNotamAsViewed = useCallback((notam) => {
    if (!isNewNotam(notam)) return;
    
    const key = notam.id || notam.number || notam.qLine || notam.summary;
    
    // Clear timer if exists
    if (notamTimers[key]) {
      clearInterval(notamTimers[key]);
      
      // Remove timer from timers state
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
    }
    
    // Remove from newNotams
    setNewNotams(prev => {
      const updated = { ...prev };
      if (updated[notam.icao]) {
        updated[notam.icao].delete(key);
        // If no more new NOTAMs for this ICAO, remove the set
        if (updated[notam.icao].size === 0) {
          delete updated[notam.icao];
          
          // Also remove from flashingIcaos if this was the last new NOTAM
          setFlashingIcaos(prev => {
            const newSet = new Set(prev);
            newSet.delete(notam.icao);
            return newSet;
          });
        }
      }
      return updated;
    });
    
    // Also remove from pendingNewNotams if it's there
    setPendingNewNotams(prev => {
      const updated = { ...prev };
      if (updated[notam.icao]) {
        updated[notam.icao].delete(key);
        // If no more pending new NOTAMs for this ICAO, remove the set
        if (updated[notam.icao].size === 0) {
          delete updated[notam.icao];
        }
      }
      return updated;
    });
    
    return key;
  }, [notamTimers]);

  // Function to check if NOTAM is new
  const isNewNotam = useCallback((notam) => {
    if (!notam || !notam.icao) return false;
    const key = notam.id || notam.number || notam.qLine || notam.summary;
    return newNotams[notam.icao] && newNotams[notam.icao].has(key);
  }, [newNotams]);

  // Effect to start timers for pending NOTAMs when tab changes
  useEffect(() => {
    // Only start timers when viewing a specific ICAO tab (not the ALL tab)
    if (tabMode !== "ALL" && pendingNewNotams[tabMode] && pendingNewNotams[tabMode].size > 0) {
      // Start timers for all pending NOTAMs in this ICAO
      setupNotamTimers(
        tabMode, 
        pendingNewNotams[tabMode],
        notamExpirationTimes, 
        notamTimers,
        setNewNotams, 
        setFlashingIcaos, 
        setNotamExpirationTimes, 
        setNotamTimers,
        setPendingNewNotams
      );
    }
  }, [tabMode, pendingNewNotams, notamExpirationTimes, notamTimers]);

  // Clean up function for timers
  const cleanupNotamTimers = useCallback(() => {
    Object.values(notamTimers).forEach(timer => {
      clearInterval(timer);
    });
  }, [notamTimers]);

  // Reset data when component unmounts
  useEffect(() => {
    return () => {
      cleanupNotamTimers();
    };
  }, [cleanupNotamTimers]);

  return {
    notamDataByIcao,
    notamFetchStatusByIcao,
    lastNotamIdsByIcao,
    loadedIcaosSet,
    loadingIcaosSet,
    newNotams,
    flashingIcaos,
    notamExpirationTimes,
    notamTimers,
    pendingNewNotams,
    fetchNotamsForIcaoWithTracking,
    markNotamAsViewed,
    isNewNotam,
    cleanupNotamTimers,
    setNotamDataByIcao,
    setNotamFetchStatusByIcao,
    setLastNotamIdsByIcao,
    setLoadedIcaosSet,
    setLoadingIcaosSet,
    setNewNotams,
    setFlashingIcaos,
    setNotamExpirationTimes,
    setNotamTimers,
    setPendingNewNotams
  };
};
