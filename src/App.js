import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

// Components Main
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
import RawNotamModal from './components/modals/RawNotamModal';
import IcaoSetsModal from './components/modals/IcaoSetsModal';
import SaveSetModal from './components/modals/SaveSetModal';

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
  trackNewNotams,
  setupNotamTimers,
  markNotamAsViewed,
  shouldShowDespiteFilters 
} from './utils/notamUtils';
import { useSessionManagement } from './hooks/useSessionManagement';
import { useBatchingSystem } from './hooks/useBatchingSystem';
import { useAutoRefresh } from './hooks/useAutoRefresh';

// Constants
import { 
  AUTO_REFRESH_INTERVAL_MS,
  NEW_NOTAM_HIGHLIGHT_DURATION_MS,
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
  
  // UI state
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  
  // New NOTAM tracking state
  const [newNotams, setNewNotams] = useState({});
  const [flashingIcaos, setFlashingIcaos] = useState(new Set());
  const [notamExpirationTimes, setNotamExpirationTimes] = useState({});
  const [notamTimers, setNotamTimers] = useState({});
  const [pendingNewNotams, setPendingNewNotams] = useState({});
  
  // Filter state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [keywordFilter, setKeywordFilter] = useState('');

  // Custom hooks
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
  
  const { autoRefreshCountdown } = useAutoRefresh({
    activeSession,
    icaoSet,
    loadedIcaosSet,
    onRefreshIcao: handleFetchNotams
  });

  // Function to check if NOTAM is new
  const isNewNotam = (notam) => {
    const key = notam.id || notam.number || notam.qLine || notam.summary;
    return newNotams[notam.icao] && newNotams[notam.icao].has(key);
  };

  // Handle NOTAM fetching
  async function handleFetchNotams(icao, showAlertIfNew = true) {
    if (!activeSession) return { error: true };
    
    try {
      const data = await fetchNotamsForIcao(icao);
      
      if (data?.error) {
        setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
        return { error: data.error };
      }
      
      const notams = Array.isArray(data) ? data : [];
      
      // Detect new NOTAMs
      if (showAlertIfNew) {
        const prevSet = lastNotamIdsByIcao[icao] || new Set();
        const newNotamKeys = new Set();
        
        for (const notam of notams) {
          const key = notam.id || notam.number || notam.qLine || notam.summary;
          if (!prevSet.has(key)) {
            newNotamKeys.add(key);
          }
        }
        
        if (newNotamKeys.size > 0) {
          trackNewNotams(
            icao, 
            newNotamKeys, 
            setNewNotams, 
            setFlashingIcaos, 
            setPendingNewNotams
          );
          
          showNewNotamAlert(
            `${icao}: ${newNotamKeys.size} new NOTAM${newNotamKeys.size > 1 ? 's' : ''} detected!`,
            icao,
            Array.from(newNotamKeys)[0]
          );
          
          // Setup timers if this ICAO is currently selected
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
        }
        
        // Update last seen IDs
        const currSet = new Set(notams.map(n => n.id || n.number || n.qLine || n.summary));
        setLastNotamIdsByIcao(prev => ({ ...prev, [icao]: currSet }));
      }
      
      setNotamDataByIcao(prev => ({ ...prev, [icao]: notams }));
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'success' }));
      setLoadedIcaosSet(prev => new Set([...prev, icao]));
      
      return notams;
      
    } catch (error) {
      console.error(`Error fetching NOTAMs for ${icao}:`, error);
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
      return { error: error.message };
    }
  }

  const showNewNotamAlert = (text, icao, latestNewNotamKey) => {
    const newNotification = {
      id: Date.now(),
      text,
      icao,
      latestNewNotamKey,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
    setNotificationCount(prev => prev + 1);
  };

  // ICAO Sets functionality
  const isCurrentSetSaved = () => {
    return icaoSets.some(set => 
      set.icaos.length === icaoSet.length && 
      set.icaos.every(icao => icaoSet.includes(icao))
    );
  };

  const handleNewSetClick = () => {
    if (icaoSet.length === 0) {
      return;
    }
    
    if (!isCurrentSetSaved()) {
      setShowSaveSetModal(true);
      setPendingNewSetAction(true);
    } else {
      clearCurrentSet();
    }
  };
  
  const clearCurrentSet = () => {
    // Clear all timers
    Object.values(notamTimers).forEach(timer => {
      if (timer) clearInterval(timer);
    });
    
    setIcaoSet([]);
    setNotamDataByIcao({});
    setNotamFetchStatusByIcao({});
    setLoadedIcaosSet(new Set());
    setLoadingIcaosSet(new Set());
    setLastNotamIdsByIcao({});
    setNewNotams({});
    setFlashingIcaos(new Set());
    setNotamExpirationTimes({});
    setNotamTimers({});
    setPendingNewNotams({});
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
      name: newSetName.trim(),
      icaos: [...icaoSet],
      created: new Date().toISOString()
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
      setIcaoQueue(prev => [...prev, ...icaosToLoad]);
      startBatching();
    }
  };

  const handleRemoveIcao = (icaoToRemove) => {
    // Clear timers for this ICAO
    if (newNotams[icaoToRemove]) {
      for (const key of newNotams[icaoToRemove]) {
        if (notamTimers[key]) {
          clearInterval(notamTimers[key]);
        }
      }
    }
    
    const updatedIcaos = icaoSet.filter(icao => icao !== icaoToRemove);
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    
    // Clean up state
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
    
    setFlashingIcaos(prev => {
      const newSet = new Set(prev);
      newSet.delete(icaoToRemove);
      return newSet;
    });
    
    // Clean up new NOTAMs tracking
    setNewNotams(prev => {
      const newState = {...prev};
      delete newState[icaoToRemove];
      return newState;
    });
    
    setPendingNewNotams(prev => {
      const newState = {...prev};
      delete newState[icaoToRemove];
      return newState;
    });
    
    // Remove from queue
    setIcaoQueue(prev => prev.filter(icao => icao !== icaoToRemove));
  };

  const handleFilterChange = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const handleReloadAll = () => {
    if (!icaoSet.length) return;
    
    // Clear cache and reload all
    setCachedNotamData({});
    clearCurrentSet();
    setIcaoSet([...icaoSet]); // Keep the same ICAOs but reload data
    setIcaoQueue([...icaoSet]);
    startBatching();
  };

  const handleCardClick = (cardKey, notam) => {
    setExpandedCardKey(prev => prev === cardKey ? null : cardKey);
    
    if (notam && isNewNotam(notam)) {
      markNotamAsViewed(notam, {
        newNotams,
        setNewNotams,
        setFlashingIcaos,
        notamTimers,
        setNotamTimers,
        setNotamExpirationTimes,
        setPendingNewNotams,
        setNotifications,
        updateNotificationCount: () => setNotificationCount(prev => Math.max(0, prev - 1))
      });
    }
  };

  const handleNotificationClick = (notification) => {
    setTabMode(notification.icao);
    setShowNotificationModal(false);
    
    setNotifications(prev => 
      prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      )
    );
    
    setNotificationCount(prev => Math.max(0, prev - 1));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showRawNotamModal = (notam) => {
    const title = `${notam.number || notam.icao || "NOTAM"} Raw`;
    let rawContent = "";
    if (notam.qLine) rawContent += notam.qLine + "\n";
    if (notam.body) rawContent += notam.body;
    else if (notam.summary) rawContent += notam.summary;
    
    setRawModalTitle(title);
    setRawModalContent(rawContent.trim());
    setShowRawModal(true);
    
    if (isNewNotam(notam)) {
      markNotamAsViewed(notam, {
        newNotams,
        setNewNotams,
        setFlashingIcaos,
        notamTimers,
        setNotamTimers,
        setNotamExpirationTimes,
        setPendingNewNotams,
        setNotifications,
        updateNotificationCount: () => setNotificationCount(prev => Math.max(0, prev - 1))
      });
    }
  };

  // Load saved data on mount
  useEffect(() => {
    try {
      const savedIcaos = getSavedIcaos();
      const savedSets = getIcaoSets();
      const cachedData = getCachedNotamData();
      
      setIcaoSets(savedSets);
      
      if (savedIcaos.length > 0) {
        setIcaoSet(savedIcaos);
        
        // Check if we have valid cached data
        if (cachedData.notamData && Object.keys(cachedData.notamData).length > 0) {
          const cacheAge = Date.now() - (cachedData.timestamp || 0);
          const fiveMinutes = 5 * 60 * 1000;
          
          if (cacheAge < fiveMinutes) {
            console.log('Restoring NOTAM data from cache');
            setNotamDataByIcao(cachedData.notamData);
            setLastNotamIdsByIcao(cachedData.lastIds || {});
            
            const cachedIcaos = Object.keys(cachedData.notamData);
            setLoadedIcaosSet(new Set(cachedIcaos));
            setNotamFetchStatusByIcao(
              cachedIcaos.reduce((acc, icao) => ({ ...acc, [icao]: 'success' }), {})
            );
            
            // Only queue ICAOs that aren't in cache
            const icaosToQueue = savedIcaos.filter(icao => !cachedIcaos.includes(icao));
            if (icaosToQueue.length > 0) {
              setIcaoQueue(icaosToQueue);
            }
          } else {
            // Cache is stale
            setCachedNotamData({});
            setIcaoQueue(savedIcaos);
          }
        } else {
          setIcaoQueue(savedIcaos);
        }
      }
    } catch (e) {
      console.error('Failed to load saved data:', e);
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

  // Setup timers when tab changes
  useEffect(() => {
    if (tabMode !== "ALL" && pendingNewNotams[tabMode] && pendingNewNotams[tabMode].size > 0) {
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
        />

        <IcaoTabs
          tabMode={tabMode}
          onTabClick={setTabMode}
          icaoSet={icaoSet}
          notamDataByIcao={notamDataByIcao}
          flashingIcaos={flashingIcaos}
          newNotams={newNotams}
        />

        <NotamGrid
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          newNotams={newNotams}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          notamExpirationTimes={notamExpirationTimes}
          onCardClick={handleCardClick}
          onShowRaw={showRawNotamModal}
          isNewNotam={isNewNotam}
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
