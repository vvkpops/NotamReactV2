import { useState, useEffect, useRef, useCallback } from 'react';

// Session Management Hook
export const useSessionManagement = () => {
  const [activeSession, setActiveSession] = useState(true);
  const bcRef = useRef(null);
  const sessionIdRef = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    const SESSION_CHANNEL = 'notamDashboardSession';
    
    const claimActiveSession = () => {
      if (bcRef.current) {
        bcRef.current.postMessage({ type: 'new-session', sessionId: sessionIdRef.current });
      } else {
        try {
          localStorage.setItem(SESSION_CHANNEL, sessionIdRef.current);
        } catch (e) {
          console.error('Failed to set session in localStorage:', e);
        }
      }
    };
    
    const deactivateSession = () => {
      setActiveSession(false);
      document.body.innerHTML = `<div style="margin-top:80px;text-align:center;font-size:2em;color:#44f;">
        This NOTAM Dashboard session is now inactive because another session started in this browser.</div>`;
    };
    
    if (window.BroadcastChannel) {
      bcRef.current = new BroadcastChannel(SESSION_CHANNEL);
      bcRef.current.onmessage = (event) => {
        if (event.data && event.data.type === 'new-session' && event.data.sessionId !== sessionIdRef.current) {
          deactivateSession();
        }
      };
      claimActiveSession();
    } else {
      const handleStorage = (event) => {
        if (event.key === SESSION_CHANNEL && event.newValue !== sessionIdRef.current) {
          deactivateSession();
        }
      };
      window.addEventListener('storage', handleStorage);
      claimActiveSession();
      
      return () => window.removeEventListener('storage', handleStorage);
    }

    return () => {
      if (bcRef.current) bcRef.current.close();
    };
  }, []);

  return { activeSession };
};

// Batching System Hook (Simplified - removed complex timer logic)
export const useBatchingSystem = ({ 
  activeSession, 
  loadedIcaosSet, 
  loadingIcaosSet, 
  setLoadingIcaosSet, 
  onFetchNotams 
}) => {
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [batchingActive, setBatchingActive] = useState(false);
  const [icaoBatchCallCount, setIcaoBatchCallCount] = useState(0);
  const [icaoBatchWindowStart, setIcaoBatchWindowStart] = useState(Date.now());
  const batchTimerRef = useRef(null);

  // Constants for rate limiting
  const BATCH_SIZE = 1; // Process one at a time to avoid rate limits
  const BATCH_INTERVAL_MS = 3000; // 3 second intervals between requests
  const CALLS_PER_WINDOW = 25; // Conservative limit
  const WINDOW_MS = 65000; // 65 second window

  const stopBatching = useCallback(() => {
    setBatchingActive(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  const scheduleNextBatch = useCallback((delay = BATCH_INTERVAL_MS) => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
    }
    batchTimerRef.current = setTimeout(processIcaoBatch, delay);
  }, []);

  const processIcaoBatch = useCallback(async () => {
    if (!activeSession) {
      stopBatching();
      return;
    }

    // Check rate limiting
    const now = Date.now();
    if (now - icaoBatchWindowStart > WINDOW_MS) {
      setIcaoBatchWindowStart(now);
      setIcaoBatchCallCount(0);
    }

    if (icaoBatchCallCount >= CALLS_PER_WINDOW) {
      const waitTime = icaoBatchWindowStart + WINDOW_MS - now + 1000;
      console.log(`Rate limit reached, waiting ${Math.ceil(waitTime/1000)}s`);
      scheduleNextBatch(waitTime);
      return;
    }

    // Process queue
    setIcaoQueue(currentQueue => {
      if (currentQueue.length === 0) {
        stopBatching();
        return currentQueue;
      }

      const newQueue = [...currentQueue];
      let processedAny = false;

      // Find next ICAO to process
      for (let i = 0; i < Math.min(BATCH_SIZE, newQueue.length); i++) {
        const icao = newQueue.shift();
        if (!loadedIcaosSet.has(icao) && !loadingIcaosSet.has(icao)) {
          setLoadingIcaosSet(prev => new Set([...prev, icao]));
          
          // Process this ICAO
          (async () => {
            try {
              const result = await onFetchNotams(icao, true);
              if (result && !result.error && Array.isArray(result)) {
                setIcaoBatchCallCount(prev => prev + 1);
              } else {
                // Re-queue on failure
                setIcaoQueue(prev => [...prev, icao]);
              }
            } catch (error) {
              console.error(`Error processing ${icao}:`, error);
              setIcaoQueue(prev => [...prev, icao]);
            } finally {
              setLoadingIcaosSet(prev => {
                const newSet = new Set(prev);
                newSet.delete(icao);
                return newSet;
              });
            }
          })();
          
          processedAny = true;
          break; // Process one at a time
        }
      }

      // Schedule next batch if there are more items
      if (newQueue.length > 0) {
        scheduleNextBatch(BATCH_INTERVAL_MS);
      } else {
        stopBatching();
      }

      return newQueue;
    });
  }, [activeSession, loadedIcaosSet, loadingIcaosSet, setLoadingIcaosSet, onFetchNotams, icaoBatchCallCount, icaoBatchWindowStart, stopBatching, scheduleNextBatch]);

  const startBatching = useCallback(() => {
    if (!batchingActive && icaoQueue.length > 0 && activeSession) {
      setBatchingActive(true);
      scheduleNextBatch(0);
    }
  }, [batchingActive, icaoQueue.length, activeSession, scheduleNextBatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return {
    icaoQueue,
    setIcaoQueue,
    batchingActive,
    setBatchingActive,
    startBatching,
    stopBatching,
    icaoBatchCallCount
  };
};

// Local Storage Hook
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// Scroll to Top Hook
export const useScrollToTop = () => {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.pageYOffset > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { showBackToTop, scrollToTop };
};

// Click Outside Hook
export const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};
