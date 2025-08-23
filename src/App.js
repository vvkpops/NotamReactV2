import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Components
import Header from './components/Header';
import IcaoInput from './components/IcaoInput';
import IcaoSetsBar from './components/IcaoSetsBar';
import FilterBar from './components/FilterBar';
import IcaoTabs from './components/IcaoTabs';
import NotamGrid from './components/NotamGrid';
import ProgressBar from './components/ProgressBar';
import BackToTopButton from './components/BackToTopButton';
import NotificationSystem from './components/NotificationSystem';

// Modals
import { RawNotamModal, IcaoRawModal, IcaoSetsModal, SaveSetModal } from './components/modal';

// Services and Utils
import { fetchNotamsForIcao } from './services/notamService';
import { 
  getIcaoSets, 
  saveIcaoSets, 
  getSavedIcaos, 
  saveIcaos,
  getCachedNotamData,
  setCachedNotamData 
} from './utils/storageUtils';
import { 
  compareNotamSets
} from './utils/notamUtils';

// Hooks
import { useSessionManagement, useBatchingSystem } from './hooks';

import { 
  DEFAULT_FILTERS 
} from './constants';

function App() {
  // Core state
  const [icaoSet, setIcaoSet] = useState([]);
  const [icaoInput, setIcaoInput] = useState('');
  const [notamDataByIcao, setNotamDataByIcao] = useState({});
  const [notamFetchStatusByIcao, setNotamFetchStatusByIcao] = useState({});
  const [lastNotamIdsByIcao, setLastNotamIdsByIcao] = useState({});
  const [loadedIcaosSet, setLoadedIcaosSet] = useState(new Set());
  const [loadingIcaosSet, setLoadingIcaosSet] = useState(new Set());
  const [tabMode, setTabMode] = useState("ALL");
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  
  // NEW NOTAM NOTIFICATION STATE
  const [newNotamsByIcao, setNewNotamsByIcao] = useState({}); // Track new NOTAMs per ICAO
  const [highlightedNotams, setHighlightedNotams] = useState(new Set()); // Track highlighted NOTAMs
  
  // ICAO Sets functionality
  const [icaoSets, setIcaoSets] = useState([]);
  const [showIcaoSetsModal, setShowIcaoSetsModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  const [pendingNewSetAction, setPendingNewSetAction] = useState(false);
  
  // Modal state
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawModalTitle, setRawModalTitle] = useState('');
  const [rawModalContent, setRawModalContent] = useState('');
  const [showIcaoRawModal, setShowIcaoRawModal] = useState(false);
  
  // UI state
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(300); // 5 minutes in seconds
  
  // Filter state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [keywordFilter, setKeywordFilter] = useState('');

  // FIXED: Add ref to track if this is an auto-refresh to prevent false "new NOTAM" alerts
  const isAutoRefreshRef = useRef(false);

  // Session management and batching
  const { activeSession } = useSessionManagement();
  const { 
    icaoQueue, 
    setIcaoQueue,
    batchingActive, 
    setBatchingActive,
    startBatching,
    stopBatching
  } = useBatchingSystem({
    activeSession,
    loadedIcaosSet,
    loadingIcaosSet,
    setLoadingIcaosSet,
    onFetchNotams: handleFetchNotams
  });

  // Show a notification for NOTAMs changes
  const showNewNotamAlert = useCallback((text, icao, latestNotamKey) => {
    const newNotification = {
      id: Date.now(),
      text,
      icao,
      latestNotamKey,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setNotificationCount(prev => prev + 1);
  }, []);

  // ENHANCED NOTAM FETCH with better new NOTAM tracking
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
      
      // FIXED: Only track and alert for new NOTAMs if this is NOT an auto-refresh
      // or if the NOTAMs are genuinely new (recently issued)
      const shouldShowNewNotamAlerts = showAlertIfNew && !isAutoRefreshRef.current;
      
      // Track new NOTAMs with timestamps, but be smarter about it
      if (comparison.added.length > 0) {
        const newNotamIds = comparison.added.map(notam => {
          const id = notam.id || notam.number || notam.qLine || notam.summary;
          return { 
            id, 
            timestamp: Date.now(),
            notam: notam,
            issuedTime: notam.issued || notam.validFrom // Track when NOTAM was actually issued
          };
        });
        
        setNewNotamsByIcao(prev => ({
          ...prev,
          [icao]: [...(prev[icao] || []), ...newNotamIds]
        }));
        
        // Add to highlighted NOTAMs only if they're genuinely new
        if (shouldShowNewNotamAlerts) {
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
            }, 60000); // 60 seconds
          });
        }
      }
      
      // Clean up old new NOTAMs (older than 10 minutes)
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      setNewNotamsByIcao(prev => ({
        ...prev,
        [icao]: (prev[icao] || []).filter(item => item.timestamp > tenMinutesAgo)
      }));
      
      // Update state
      const currSet = new Set(notams.map(n => n.id || n.number || n.qLine || n.summary));
      setLastNotamIdsByIcao(prev => ({ ...prev, [icao]: currSet }));
      setNotamDataByIcao(prev => ({ ...prev, [icao]: notams }));
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'success' }));
      setLoadedIcaosSet(prev => new Set([...prev, icao]));
      
      // FIXED: Only show notifications for genuinely new NOTAMs, not auto-refresh refetches
      if (shouldShowNewNotamAlerts && comparison.added.length > 0) {
        showNewNotamAlert(
          `${icao}: ${comparison.added.length} new NOTAM${comparison.added.length > 1 ? 's' : ''} detected!`,
          icao,
          comparison.added[0].id || comparison.added[0].number || comparison.added[0].qLine || comparison.added[0].summary
        );
      }
      
      if (shouldShowNewNotamAlerts && comparison.removed.length > 0) {
        showNewNotamAlert(
          `${icao}: ${comparison.removed.length} NOTAM${comparison.removed.length > 1 ? 's' : ''} cancelled/expired`,
          icao,
          comparison.removed[0].id || comparison.removed[0].number || comparison.removed[0].qLine || comparison.removed[0].summary
        );
      }
      
      return notams;
    } catch (error) {
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
      return { error: error.message };
    }
  }

  // Helper functions for new NOTAM system
  const hasNewNotams = useCallback((icao) => {
    const newNotams = newNotamsByIcao[icao] || [];
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return newNotams.some(item => item.timestamp > fiveMinutesAgo);
  }, [newNotamsByIcao]);

  const isNotamHighlighted = useCallback((icao, notam) => {
    const notamId = notam.id || notam.number || notam.qLine || notam.summary;
    const key = `${icao}-${notamId}`;
    return highlightedNotams.has(key);
  }, [highlightedNotams]);

  // Enhanced tab click handler
  const handleTabClick = useCallback((newTabMode) => {
    setTabMode(newTabMode);
    
    // Mark NOTAMs as "seen" for this ICAO when tab is clicked
    if (newTabMode !== "ALL") {
      // Clear the red dot for this ICAO after a short delay
      setTimeout(() => {
        setNewNotamsByIcao(prev => ({
          ...prev,
          [newTabMode]: []
        }));
      }, 1000); // 1 second delay to allow user to see the new NOTAMs
    }
  }, []);

  // FIXED: Better auto-refresh implementation that doesn't trigger false "new" alerts
  useEffect(() => {
    if (!activeSession || icaoSet.length === 0) return;
    
    let autoRefreshTimer;
    let countdownTimer;
    let countdown = 300; // 5 minutes in seconds
    
    const performAutoRefresh = () => {
      console.log('🔄 Performing auto-refresh...');
      
      // Set the auto-refresh flag to prevent false "new NOTAM" alerts
      isAutoRefreshRef.current = true;
      
      // Only add ICAOs that are loaded, not currently loading, and not already queued
      const refreshIcaos = icaoSet.filter(icao =>
        loadedIcaosSet.has(icao) &&
        !loadingIcaosSet.has(icao) &&
        !icaoQueue.includes(icao)
      );
      
      // Add to batching queue
      if (refreshIcaos.length > 0) {
        setIcaoQueue(prev => [...prev, ...refreshIcaos]);
        startBatching();
        
        // Reset the auto-refresh flag after a delay to allow processing
        setTimeout(() => {
          isAutoRefreshRef.current = false;
          console.log('✅ Auto-refresh flag reset');
        }, 10000); // 10 seconds should be enough for most batches
      } else {
        // No ICAOs to refresh, reset flag immediately
        isAutoRefreshRef.current = false;
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
    
    // Start timers
    autoRefreshTimer = setInterval(performAutoRefresh, 5 * 60 * 1000); // 5 minutes
    countdownTimer = setInterval(updateCountdown, 1000); // 1 second
    
    return () => {
      clearInterval(autoRefreshTimer);
      clearInterval(countdownTimer);
    };
  }, [activeSession, icaoSet, loadedIcaosSet, loadingIcaosSet, icaoQueue, startBatching]);

  // Cleanup effect for old highlights and notifications
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const tenMinutesAgo = now - 10 * 60 * 1000;
      
      // Clean up old new NOTAMs
      setNewNotamsByIcao(prev => {
        const cleaned = {};
        Object.keys(prev).forEach(icao => {
          cleaned[icao] = prev[icao].filter(item => item.timestamp > tenMinutesAgo);
        });
        return cleaned;
      });
    }, 60000); // Run every minute
    
    return () => clearInterval(cleanup);
  }, []);

  // ICAO Sets logic
  const isCurrentSetSaved = () => {
    return icaoSets.some(set => 
      set.icaos.length === icaoSet.length && 
      set.icaos.every(icao => icaoSet.includes(icao))
    );
  };

  const handleNewSetClick = () => {
    if (icaoSet.length === 0) return;
    setShowIcaoSetsModal(true);
  };

  const clearCurrentSet = () => {
    setIcaoSet([]);
    setNotamDataByIcao({});
    setNotamFetchStatusByIcao({});
    setLoadedIcaosSet(new Set());
    setLoadingIcaosSet(new Set());
    setLastNotamIdsByIcao({});
    setNewNotamsByIcao({}); // Clear new NOTAMs
    setHighlightedNotams(new Set()); // Clear highlights
    setIcaoQueue([]);
    setBatchingActive(false);
    setTabMode("ALL");
    // Reset auto-refresh flag
    isAutoRefreshRef.current = false;
  };

  const handleSaveSetResponse = (shouldSave) => {
    setShowSaveSetModal(false);
    if (shouldSave) {
      setShowIcaoSetsModal(true);
    } else if (pendingNewSetAction) {
      clearCurrentSet();
      setPendingNewSetAction(false);
    }
  };

  const createIcaoSet = () => {
    if (!newSetName.trim() || icaoSet.length === 0) return;
    const sets = getIcaoSets();
    const newSet = {
      id: Date.now() + Math.floor(Math.random() * 100000),
      name: newSetName.trim(),
      icaos: [...icaoSet],
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    sets.push(newSet);
    saveIcaoSets(sets);
    setIcaoSets(sets);
    setNewSetName('');
    setShowIcaoSetsModal(false);
    if (pendingNewSetAction) {
      clearCurrentSet();
      setPendingNewSetAction(false);
    }
  };

  const loadIcaoSet = (setIcaos) => {
    clearCurrentSet();
    setIcaoSet([...setIcaos]);
    setIcaoQueue([...setIcaos]);
    startBatching();
    setShowIcaoSetsModal(false);
  };

  const deleteIcaoSet = (index) => {
    const sets = getIcaoSets();
    sets.splice(index, 1);
    saveIcaoSets(sets);
    setIcaoSets(sets);
  };

  // Event handlers
  const handleIcaoSubmit = (newIcaos) => {
    if (newIcaos.length === 0) return;
    const updatedIcaos = [...new Set([...icaoSet, ...newIcaos])];
    const icaosToLoad = newIcaos.filter(icao => !loadedIcaosSet.has(icao));
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    if (icaosToLoad.length > 0) {
      // Mark as manual load (not auto-refresh) to allow new NOTAM alerts
      isAutoRefreshRef.current = false;
      setIcaoQueue(prev => [...prev, ...icaosToLoad]);
      startBatching();
    }
  };

  const handleRemoveIcao = (icaoToRemove) => {
    const updatedIcaos = icaoSet.filter(icao => icao !== icaoToRemove);
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    setNotamDataByIcao(prev => {
      const newData = { ...prev }; 
      delete newData[icaoToRemove]; 
      return newData;
    });
    setLoadedIcaosSet(prev => {
      const newSet = new Set(prev); 
      newSet.delete(icaoToRemove); 
      return newSet;
    });
    // Clear new NOTAM tracking for removed ICAO
    setNewNotamsByIcao(prev => {
      const newData = { ...prev };
      delete newData[icaoToRemove];
      return newData;
    });
    setIcaoQueue(prev => prev.filter(icao => icao !== icaoToRemove));
  };

  const handleFilterChange = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const handleReloadAll = () => {
    if (!icaoSet.length) return;
    
    console.log('🔄 Manual reload all triggered');
    
    // Clear cache and reset auto-refresh flag for manual reload
    setCachedNotamData({});
    isAutoRefreshRef.current = false;
    
    // Clear current data but keep ICAO set
    const currentIcaos = [...icaoSet];
    clearCurrentSet();
    setIcaoSet(currentIcaos);
    setIcaoQueue(currentIcaos);
    startBatching();
  };

  const handleCardClick = (cardKey, notam) => {
    setExpandedCardKey(prev => prev === cardKey ? null : cardKey);
  };

  const handleNotificationClick = (notification) => {
    setTabMode(notification.icao);
    setShowNotificationModal(false);
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    setNotificationCount(prev => Math.max(0, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShowRaw = (currentTabMode, currentNotamData) => {
    setShowIcaoRawModal(true);
  };

  // Load saved data on mount
  useEffect(() => {
    try {
      const savedIcaos = getSavedIcaos();
      const savedSets = getIcaoSets();
      const cachedData = getCachedNotamData();
      
      setIcaoSets(Array.isArray(savedSets) ? savedSets : []);
      
      if (savedIcaos.length > 0) {
        setIcaoSet(savedIcaos);
        if (cachedData.notamData && Object.keys(cachedData.notamData).length > 0) {
          const cacheAge = Date.now() - (cachedData.timestamp || 0);
          const fiveMinutes = 5 * 60 * 1000;
          if (cacheAge < fiveMinutes) {
            setNotamDataByIcao(cachedData.notamData);
            setLastNotamIdsByIcao(cachedData.lastIds || {});
            const cachedIcaos = Object.keys(cachedData.notamData);
            setLoadedIcaosSet(new Set(cachedIcaos));
            setNotamFetchStatusByIcao(
              cachedIcaos.reduce((acc, icao) => ({ ...acc, [icao]: 'success' }), {})
            );
            const icaosToQueue = savedIcaos.filter(icao => !cachedIcaos.includes(icao));
            if (icaosToQueue.length > 0) {
              setIcaoQueue(icaosToQueue);
            }
          } else {
            setCachedNotamData({});
            setIcaoQueue(savedIcaos);
          }
        } else {
          setIcaoQueue(savedIcaos);
        }
      }
    } catch (e) {
      console.error('Failed to load saved data:', e);
      setIcaoSets([]);
    }
  }, []);

  // Cache NOTAM data when it changes
  useEffect(() => {
    if (Object.keys(notamDataByIcao).length > 0) {
      setCachedNotamData({
        notamData: notamDataByIcao,
        lastIds: lastNotamIdsByIcao,
        timestamp: Date.now()
      });
    }
  }, [notamDataByIcao, lastNotamIdsByIcao]);

  // Start batching when queue changes
  useEffect(() => {
    if (icaoQueue.length > 0 && !batchingActive && activeSession) {
      const timer = setTimeout(startBatching, 100);
      return () => clearTimeout(timer);
    }
  }, [icaoQueue.length, batchingActive, activeSession, startBatching]);

  // Progress calculation
  const totalIcaos = icaoSet.length;
  const loadedCount = loadedIcaosSet.size;
  const loadingCount = loadingIcaosSet.size;
  const queuedCount = icaoQueue.length;

  return (
    <div className="bg-gradient-to-br from-[#181c2b] to-[#202230] min-h-screen text-slate-100 w-full">
      <Header />
      <div className="container mx-auto px-2 py-6">
        <IcaoInput
          icaoInput={icaoInput}
          setIcaoInput={setIcaoInput}
          icaoSet={icaoSet}
          icaoListExpanded={icaoListExpanded}
          setIcaoListExpanded={setIcaoListExpanded}
          onSubmit={handleIcaoSubmit}
          onRemoveIcao={handleRemoveIcao}
        />
        <IcaoSetsBar
          icaoSets={icaoSets}
          icaoSet={icaoSet}
          onShowSetsModal={() => setShowIcaoSetsModal(true)}
          onNewSetClick={handleNewSetClick}
          onLoadSet={loadIcaoSet}
        />
        <ProgressBar
          loadedCount={loadedCount}
          totalIcaos={totalIcaos}
          loadingCount={loadingCount}
          queuedCount={queuedCount}
          autoRefreshCountdown={autoRefreshCountdown}
          batchingActive={batchingActive}
        />
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          keywordFilter={keywordFilter}
          setKeywordFilter={setKeywordFilter}
          cardScale={cardScale}
          setCardScale={setCardScale}
          onReloadAll={handleReloadAll}
          onShowRaw={handleShowRaw}
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
        />
        <IcaoTabs
          tabMode={tabMode}
          onTabClick={handleTabClick}
          icaoSet={icaoSet}
          notamDataByIcao={notamDataByIcao}
          hasNewNotams={hasNewNotams}
          newNotamsByIcao={newNotamsByIcao}
        />
        <NotamGrid
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          onCardClick={handleCardClick}
          isNotamHighlighted={isNotamHighlighted}
        />
      </div>
      <BackToTopButton />
      <NotificationSystem
        notifications={notifications}
        notificationCount={notificationCount}
        showNotificationModal={showNotificationModal}
        setShowNotificationModal={setShowNotificationModal}
        setNotifications={setNotifications}
        setNotificationCount={setNotificationCount}
        onNotificationClick={handleNotificationClick}
      />
      {/* Modals */}
      <RawNotamModal
        show={showRawModal}
        title={rawModalTitle}
        content={rawModalContent}
        onClose={() => setShowRawModal(false)}
      />
      <IcaoRawModal
        show={showIcaoRawModal}
        tabMode={tabMode}
        notamDataByIcao={notamDataByIcao}
        onClose={() => setShowIcaoRawModal(false)}
      />
      <IcaoSetsModal
        show={showIcaoSetsModal}
        onClose={() => setShowIcaoSetsModal(false)}
        icaoSets={icaoSets}
        newSetName={newSetName}
        setNewSetName={setNewSetName}
        icaoSet={icaoSet}
        onCreateSet={createIcaoSet}
        onLoadSet={loadIcaoSet}
        onDeleteSet={deleteIcaoSet}
      />
      <SaveSetModal
        show={showSaveSetModal}
        onClose={() => setShowSaveSetModal(false)}
        onSave={handleSaveSetResponse}
      />
    </div>
  );
}

export default App;
