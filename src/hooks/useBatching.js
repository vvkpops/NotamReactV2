import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ICAO_BATCH_SIZE,
  ICAO_BATCH_INTERVAL_MS,
  ICAO_BATCH_CALL_LIMIT
} from '../utils/NotamUtils';

export const useBatching = (activeSession, loadedIcaosSet, loadingIcaosSet, fetchNotamsForIcao) => {
  // Batching system state
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [batchingActive, setBatchingActive] = useState(false);
  const [icaoBatchCallCount, setIcaoBatchCallCount] = useState(0);
  const [icaoBatchWindowStart, setIcaoBatchWindowStart] = useState(Date.now());
  
  const batchTimerRef = useRef(null);

  const startBatchingIfNeeded = useCallback(() => {
    setBatchingActive(prev => {
      if (!prev && icaoQueue.length > 0) {
        scheduleNextBatch(0);
        return true;
      }
      return prev;
    });
  }, [icaoQueue.length]);

  const stopBatching = useCallback(() => {
    setBatchingActive(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  const scheduleNextBatch = useCallback((delay = ICAO_BATCH_INTERVAL_MS) => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(processIcaoBatch, delay);
  }, []);

  const processIcaoBatch = useCallback(async () => {
    if (!activeSession) {
      stopBatching();
      return;
    }

    setIcaoQueue(currentQueue => {
      if (currentQueue.length === 0) {
        stopBatching();
        return currentQueue;
      }

      const now = Date.now();
      if (now - icaoBatchWindowStart > ICAO_BATCH_INTERVAL_MS) {
        setIcaoBatchWindowStart(now);
        setIcaoBatchCallCount(0);
      }

      let batchSize = Math.min(ICAO_BATCH_SIZE, ICAO_BATCH_CALL_LIMIT - icaoBatchCallCount, currentQueue.length);
      if (batchSize <= 0) {
        scheduleNextBatch(icaoBatchWindowStart + ICAO_BATCH_INTERVAL_MS - now + 50);
        return currentQueue;
      }

      const batch = [];
      const newQueue = [...currentQueue];
      
      while (batch.length < batchSize && newQueue.length > 0) {
        const icao = newQueue.shift();
        if (!loadedIcaosSet.has(icao) && !loadingIcaosSet.has(icao)) {
          batch.push(icao);
        }
      }

      // Process batch
      (async () => {
        for (const icao of batch) {
          try {
            const result = await fetchNotamsForIcao(icao, true, true);
            if (result && !result.error) {
              setIcaoBatchCallCount(prev => prev + 1);
            } else {
              setIcaoQueue(prev => [...prev, icao]);
            }
          } catch {
            setIcaoQueue(prev => [...prev, icao]);
          }
        }

        // Schedule next batch
        if (newQueue.length > 0 && icaoBatchCallCount < ICAO_BATCH_CALL_LIMIT) {
          scheduleNextBatch(300);
        } else if (newQueue.length > 0) {
          const nextDelay = icaoBatchWindowStart + ICAO_BATCH_INTERVAL_MS - Date.now();
          scheduleNextBatch(Math.max(nextDelay, 0));
        } else {
          stopBatching();
        }
      })();

      return newQueue;
    });
  }, [activeSession, icaoBatchCallCount, icaoBatchWindowStart, loadedIcaosSet, loadingIcaosSet, fetchNotamsForIcao, scheduleNextBatch, stopBatching]);

  // Start batching when queue changes
  useEffect(() => {
    if (icaoQueue.length > 0 && !batchingActive) {
      startBatchingIfNeeded();
    }
  }, [icaoQueue, batchingActive, startBatchingIfNeeded]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
      }
    };
  }, []);

  return {
    icaoQueue,
    batchingActive,
    icaoBatchCallCount,
    icaoBatchWindowStart,
    setIcaoQueue,
    setIcaoBatchCallCount,
    setIcaoBatchWindowStart,
    startBatchingIfNeeded,
    stopBatching,
    scheduleNextBatch
  };
};