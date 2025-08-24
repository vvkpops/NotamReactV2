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
  compareNotamSets,
  parseDate
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

  // HYBRID SOLUTION: Simplified NOTAM fetch with better new NOTAM tracking
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
      
      // HYBRID SOLUTION: Always track new NOTAMs, but be smart about notifications
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

  // HYBRID SOLUTION: Simplified auto-refresh without problematic flags
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

  // ICAO Sets management
  const clearCurrentSet = () => {
    setIcaoSet([]);
    setNotamDataByIcao({});
    setLastNotamIdsByIcao({});
    setLoadedIcaosSet(new Set());
    setNotamFetchStatusByIcao({});
    setNewNotamsByIcao({});
    setHighlightedNotams(new Set());
    setExpandedCardKey(null);
    setTabMode("ALL");
    setIcaoQueue([]);
    saveIcaos([]);
    setCachedNotamData({});
  };

  const loadIcaoSet = (icaos) => {
    if (!icaos || icaos.length === 0) return;
    clearCurrentSet();
    setIcaoSet(icaos);
    setIcaoQueue(icaos);
    saveIcaos(icaos);
  };

  const saveCurrentSetAs = (name) => {
    if (icaoSet.length === 0) return;
    const newSet = { name, icaos: icaoSet, created: new Date().toISOString() };
    const updatedSets = [...icaoSets, newSet];
    setIcaoSets(updatedSets);
    saveIcaoSets(updatedSets);
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
    
    // Clear cache for manual reload
    setCachedNotamData({});
    
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

  // Get computed values for rendering
  const allNotams = Object.values(notamDataByIcao).flat();
  const loadedCount = loadedIcaosSet.size;
  const loadingCount = loadingIcaosSet.size;
  const queuedCount = icaoQueue.length;

  if (!activeSession) {
    return (
      <div className="inactive-session-container">
        <div className="inactive-session-message">
          <h1>✈️ NOTAM Dashboard V2</h1>
          <h2>Session Taken Over</h2>
          <p>This NOTAM Dashboard is already open in another tab or window.</p>
          <p>Only one active session is allowed at a time to respect API rate limits.</p>
          <div className="inactive-session-actions">
            <button onClick={() => window.location.reload()} className="btn-primary">
              Take Over This Session
            </button>
          </div>
          <p className="inactive-session-note">
            Taking over will close the dashboard in the other tab/window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Header />
      
      <main className="main-container">
        <div className="top-controls">
          <IcaoInput
            icaoInput={icaoInput}
            setIcaoInput={setIcaoInput}
            onSubmit={handleIcaoSubmit}
            disabled={!activeSession}
          />

          <IcaoSetsBar
            icaoSets={icaoSets}
            onLoadSet={loadIcaoSet}
            onClearSet={clearCurrentSet}
            onSaveSetClick={() => setShowSaveSetModal(true)}
            onManageSetsClick={() => setShowIcaoSetsModal(true)}
            hasCurrentSet={icaoSet.length > 0}
          />
        </div>

        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          keywordFilter={keywordFilter}
          onKeywordChange={setKeywordFilter}
          icaoSet={icaoSet}
          onRemoveIcao={handleRemoveIcao}
          onReloadAll={handleReloadAll}
          onToggleList={() => setIcaoListExpanded(!icaoListExpanded)}
          icaoListExpanded={icaoListExpanded}
          cardScale={cardScale}
          onCardScaleChange={setCardScale}
          disabled={!activeSession}
        />

        <ProgressBar
          loadedCount={loadedCount}
          totalIcaos={icaoSet.length}
          loadingCount={loadingCount}
          queuedCount={queuedCount}
          autoRefreshCountdown={autoRefreshCountdown}
          batchingActive={batchingActive}
        />

        <IcaoTabs
          icaoSet={icaoSet}
          tabMode={tabMode}
          onTabClick={handleTabClick}
          notamDataByIcao={notamDataByIcao}
          hasNewNotams={hasNewNotams}
          loadedIcaosSet={loadedIcaosSet}
        />

        <NotamGrid
          tabMode={tabMode}
          icaoSet={icaoSet}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          onCardClick={handleCardClick}
          onShowRaw={handleShowRaw}
          isNotamHighlighted={isNotamHighlighted}
          loadedIcaosSet={loadedIcaosSet}
        />
      </main>

      <BackToTopButton />
      
      <NotificationSystem
        notificationCount={notificationCount}
        notifications={notifications}
        showNotificationModal={showNotificationModal}
        onToggleModal={() => setShowNotificationModal(!showNotificationModal)}
        onNotificationClick={handleNotificationClick}
        onClearNotifications={() => {
          setNotifications([]);
          setNotificationCount(0);
        }}
      />

      {/* Modals */}
      <RawNotamModal
        show={showRawModal}
        onClose={() => setShowRawModal(false)}
        title={rawModalTitle}
        content={rawModalContent}
      />

      <IcaoRawModal
        show={showIcaoRawModal}
        onClose={() => setShowIcaoRawModal(false)}
        icao={tabMode}
        notams={tabMode !== "ALL" ? (notamDataByIcao[tabMode] || []) : allNotams}
      />

      <SaveSetModal
        show={showSaveSetModal}
        onClose={() => {
          setShowSaveSetModal(false);
          setNewSetName('');
        }}
        onSave={(name) => {
          saveCurrentSetAs(name);
          setShowSaveSetModal(false);
          setNewSetName('');
        }}
        newSetName={newSetName}
        setNewSetName={setNewSetName}
        icaoCount={icaoSet.length}
      />

      <IcaoSetsModal
        show={showIcaoSetsModal}
        onClose={() => setShowIcaoSetsModal(false)}
        icaoSets={icaoSets}
        onLoadSet={(icaos) => {
          loadIcaoSet(icaos);
          setShowIcaoSetsModal(false);
        }}
        onDeleteSet={(setToDelete) => {
          const updatedSets = icaoSets.filter(set => set !== setToDelete);
          setIcaoSets(updatedSets);
          saveIcaoSets(updatedSets);
        }}
      />
    </div>
  );
}

export default App;
