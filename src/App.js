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
  
  // ICAO Sets functionality - FIXED: Initialize as empty array instead of undefined
  const [icaoSets, setIcaoSets] = useState([]);
  const [showIcaoSetsModal, setShowIcaoSetsModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  const [pendingNewSetAction, setPendingNewSetAction] = useState(false);
  
  // Modal state
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawModalTitle, setRawModalTitle] = useState('');
  const [rawModalContent, setRawModalContent] = useState('');
  
  // NEW: ICAO Raw Modal state - Updated to handle both single ICAO and ALL
  const [showIcaoRawModal, setShowIcaoRawModal] = useState(false);
  
  // UI state
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  
  // VANILLA JS APPROACH - Simple auto-refresh state (no complex timers)
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(300); // 5 minutes in seconds
  
  // Filter state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [keywordFilter, setKeywordFilter] = useState('');

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

  // VANILLA JS APPROACH - Simple NOTAM fetch with proper comparison logic
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
      
      // VANILLA JS APPROACH - Simple comparison logic
      const previousNotams = notamDataByIcao[icao] || [];
      const comparison = compareNotamSets(icao, previousNotams, notams);
      
      // Update state
      const currSet = new Set(notams.map(n => n.id || n.number || n.qLine || n.summary));
      setLastNotamIdsByIcao(prev => ({ ...prev, [icao]: currSet }));
      setNotamDataByIcao(prev => ({ ...prev, [icao]: notams }));
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'success' }));
      setLoadedIcaosSet(prev => new Set([...prev, icao]));
      
      // VANILLA JS APPROACH - Simple notifications for changes
      if (showAlertIfNew) {
        if (comparison.added.length > 0) {
          showNewNotamAlert(
            `${icao}: ${comparison.added.length} new NOTAM${comparison.added.length > 1 ? 's' : ''} detected!`,
            icao,
            comparison.added[0].id || comparison.added[0].number || comparison.added[0].qLine || comparison.added[0].summary
          );
        }
        
        if (comparison.removed.length > 0) {
          showNewNotamAlert(
            `${icao}: ${comparison.removed.length} NOTAM${comparison.removed.length > 1 ? 's' : ''} cancelled/expired`,
            icao,
            comparison.removed[0].id || comparison.removed[0].number || comparison.removed[0].qLine || comparison.removed[0].summary
          );
        }
      }
      
      return notams;
    } catch (error) {
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
      return { error: error.message };
    }
  }

  // VANILLA JS APPROACH - Simple auto-refresh implementation
  useEffect(() => {
    if (!activeSession || icaoSet.length === 0) return;
    
    let autoRefreshTimer;
    let countdownTimer;
    let countdown = 300; // 5 minutes in seconds
    
    const performAutoRefresh = async () => {
      console.log('Starting auto-refresh for', icaoSet.length, 'ICAOs');
      
      // Refresh all loaded ICAOs
      for (const icao of icaoSet) {
        if (loadedIcaosSet.has(icao)) {
          try {
            await handleFetchNotams(icao, true); // This handles new/removed detection
          } catch (error) {
            console.error(`Auto-refresh failed for ${icao}:`, error);
          }
        }
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
  }, [activeSession, icaoSet, loadedIcaosSet, notamDataByIcao]);

  // ICAO Sets logic, modals, new set, load/save/delete, etc.
  const isCurrentSetSaved = () => {
    return icaoSets.some(set => 
      set.icaos.length === icaoSet.length && 
      set.icaos.every(icao => icaoSet.includes(icao))
    );
  };

  // FIXED: Simplified handleNewSetClick - just open the modal to save
  const handleNewSetClick = () => {
    if (icaoSet.length === 0) return;
    // Simply show the sets modal to save the current set
    setShowIcaoSetsModal(true);
  };

  const clearCurrentSet = () => {
    setIcaoSet([]);
    setNotamDataByIcao({});
    setNotamFetchStatusByIcao({});
    setLoadedIcaosSet(new Set());
    setLoadingIcaosSet(new Set());
    setLastNotamIdsByIcao({});
    setIcaoQueue([]);
    setBatchingActive(false);
    setTabMode("ALL");
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

  // Event handlers for input, remove, filters, reload
  const handleIcaoSubmit = (newIcaos) => {
    if (newIcaos.length === 0) return;
    const updatedIcaos = [...new Set([...icaoSet, ...newIcaos])];
    const icaosToLoad = newIcaos.filter(icao => !loadedIcaosSet.has(icao));
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    if (icaosToLoad.length > 0) {
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
    setIcaoQueue(prev => prev.filter(icao => icao !== icaoToRemove));
  };

  const handleFilterChange = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const handleReloadAll = () => {
    if (!icaoSet.length) return;
    setCachedNotamData({});
    clearCurrentSet();
    setIcaoSet([...icaoSet]);
    setIcaoQueue([...icaoSet]);
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

  // NEW: Updated RAW Modal handler for context-aware display
  const handleShowRaw = (currentTabMode, currentNotamData) => {
    setShowIcaoRawModal(true);
  };

  // FIXED: Load saved data on mount with proper error handling
  useEffect(() => {
    try {
      const savedIcaos = getSavedIcaos();
      const savedSets = getIcaoSets();
      const cachedData = getCachedNotamData();
      
      // FIXED: Ensure icaoSets is always an array
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
      // FIXED: Set empty array as fallback
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
          onTabClick={setTabMode}
          icaoSet={icaoSet}
          notamDataByIcao={notamDataByIcao}
          flashingIcaos={new Set()} // Simple approach - no flashing logic
          newNotams={{}} // Simple approach - no complex new NOTAM tracking
        />
        <NotamGrid
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          onCardClick={handleCardClick}
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
