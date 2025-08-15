import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles/globals.css';
import './styles/notifications.css';

// Components
import NotificationSystem from './components/NotificationSystem';
import NotamCard from './components/NotamCard';
import IcaoInput from './components/IcaoInput';
import FilterBar from './components/FilterBar';
import ProgressBar from './components/ProgressBar';
import IcaoTabs from './components/IcaoTabs';
import IcaoSetsBar from './components/IcaoSetsBar';
import BackToTopButton from './components/BackToTopButton';
import { RawNotamModal, IcaoSetsModal, SaveSetModal } from './components/Modals';

// Utils and Services
import { 
  getNotamFlags, 
  getNotamType, 
  isNotamCurrent, 
  isNotamFuture, 
  shouldShowDespiteFilters 
} from './utils/notamUtils';
import { mockFetchNotams } from './services/notamService';
import { getIcaoSets, saveIcaoSets, getSavedIcaos, saveIcaos } from './utils/storageUtils';
import { 
  AUTO_REFRESH_INTERVAL_MS, 
  ICAO_BATCH_SIZE, 
  ICAO_BATCH_INTERVAL_MS, 
  ICAO_BATCH_CALL_LIMIT, 
  NEW_NOTAM_HIGHLIGHT_DURATION_MS 
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
  
  // Custom confirm modal for saving sets
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  const [pendingNewSetAction, setPendingNewSetAction] = useState(false);
  
  // Batching system state
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [batchingActive, setBatchingActive] = useState(false);
  const [icaoBatchCallCount, setIcaoBatchCallCount] = useState(0);
  const [icaoBatchWindowStart, setIcaoBatchWindowStart] = useState(Date.now());
  
  // RAW Modal state
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawModalTitle, setRawModalTitle] = useState('');
  const [rawModalContent, setRawModalContent] = useState('');
  
  // UI state
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  
  // New NOTAM tracking state with individual timers
  const [newNotams, setNewNotams] = useState({});
  const [flashingIcaos, setFlashingIcaos] = useState(new Set());
  const [notamExpirationTimes, setNotamExpirationTimes] = useState({});
  const [notamTimers, setNotamTimers] = useState({});
  const [pendingNewNotams, setPendingNewNotams] = useState({});
  
  // Filter state
  const [filters, setFilters] = useState({
    rwy: true,
    twy: true,
    rsc: true,
    crfi: true,
    ils: true,
    fuel: true,
    other: true,
    cancelled: false,
    dom: false,
    current: true,
    future: true
  });
  const [keywordFilter, setKeywordFilter] = useState('');
  
  // Session state
  const [activeSession, setActiveSession] = useState(true);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);
  
  // Refs
  const autoRefreshTimerRef = useRef(null);
  const batchTimerRef = useRef(null);
  const bcRef = useRef(null);
  const sessionIdRef = useRef(Math.random().toString(36).substr(2, 9));

  // Function to check if NOTAM is new
  const isNewNotam = (notam) => {
    const key = notam.id || notam.number || notam.qLine || notam.summary;
    return newNotams[notam.icao] && newNotams[notam.icao].has(key);
  };

  // Mark a NOTAM as viewed/no longer new
  const markNotamAsViewed = (notam) => {
    if (!isNewNotam(notam)) return;
    
    const key = notam.id || notam.number || notam.qLine || notam.summary;
    
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
    
    setNotifications(prev => 
      prev.map(notif => {
        if (notif.icao === notam.icao && notif.latestNewNotamKey === key) {
          return { ...notif, read: true };
        }
        return notif;
      })
    );
    
    updateNotificationCount();
  };
  
  const updateNotificationCount = () => {
    setNotificationCount(prev => Math.max(0, prev - 1));
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
      document.querySelector('input[placeholder="ICAO (comma separated)"]')?.focus();
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
    Object.values(notamTimers).forEach(timer => {
      clearInterval(timer);
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
    setTabMode("ALL");
    
    setTimeout(() => {
      document.querySelector('input[placeholder="ICAO (comma separated)"]')?.focus();
    }, 100);
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
    Object.values(notamTimers).forEach(timer => {
      clearInterval(timer);
    });
    
    setIcaoSet([...setIcaos]);
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
    
    setIcaoQueue(prev => {
      const newQueue = [...prev];
      setIcaos.forEach(icao => {
        if (!newQueue.includes(icao)) {
          newQueue.push(icao);
        }
      });
      return newQueue;
    });
    startBatchingIfNeeded();
  };

  const deleteIcaoSet = (index) => {
    const sets = getIcaoSets();
    sets.splice(index, 1);
    saveIcaoSets(sets);
    setIcaoSets(sets);
  };

  // Batching system
  const startBatchingIfNeeded = useCallback(() => {
    setBatchingActive(prev => {
      if (!prev && icaoQueue.length > 0) {
        scheduleNextBatch(0);
        return true;
      }
      return prev;
    });
  }, [icaoQueue.length]);

  const stopBatching = () => {
    setBatchingActive(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  };

  const scheduleNextBatch = (delay = ICAO_BATCH_INTERVAL_MS) => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(processIcaoBatch, delay);
  };

  const processIcaoBatch = async () => {
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
          setLoadingIcaosSet(prev => new Set([...prev, icao]));
        }
      }

      (async () => {
        for (const icao of batch) {
          try {
            const result = await fetchNotamsForIcao(icao, true, true);
            if (result && !result.error && Array.isArray(result)) {
              setLoadedIcaosSet(prev => new Set([...prev, icao]));
              setIcaoBatchCallCount(prev => prev + 1);
            } else {
              setIcaoQueue(prev => [...prev, icao]);
            }
          } catch {
            setIcaoQueue(prev => [...prev, icao]);
          }
          setLoadingIcaosSet(prev => {
            const newSet = new Set(prev);
            newSet.delete(icao);
            return newSet;
          });
        }

        if (newQueue.length > 0 && icaoBatchCallCount < ICAO_BATCH_CALL_LIMIT) {
          scheduleNextBatch(300);
        } else if (newQueue.length > 0) {
          const nextDelay = icaoBatchWindowStart + ICAO_BATCH_INTERVAL_MS - Date.now() + 50;
          scheduleNextBatch(Math.max(0, nextDelay));
        } else {
          stopBatching();
        }
      })();

      return newQueue;
    });
  };

  // Fetch NOTAMs for a single ICAO
  const fetchNotamsForIcao = async (icao, isBatch = false, suppressError = false) => {
    if (!activeSession) return null;

    try {
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'loading' }));
      
      const result = await mockFetchNotams(icao);
      
      if (result?.error) {
        setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
        return { error: result.error };
      }

      const notams = Array.isArray(result) ? result : [];
      
      setNotamDataByIcao(prev => {
        const updated = { ...prev };
        const existingNotams = updated[icao] || [];
        const existingKeys = new Set(existingNotams.map(n => n.id || n.number || n.qLine || n.summary));
        
        const newNotamsList = notams.filter(notam => {
          const key = notam.id || notam.number || notam.qLine || notam.summary;
          return !existingKeys.has(key);
        });

        if (newNotamsList.length > 0) {
          const newKeys = new Set(newNotamsList.map(n => n.id || n.number || n.qLine || n.summary));
          
          setNewNotams(prev => ({
            ...prev,
            [icao]: new Set([...(prev[icao] || []), ...newKeys])
          }));
          
          setFlashingIcaos(prev => new Set([...prev, icao]));
          
          // Set up timers for new NOTAMs
          newNotamsList.forEach(notam => {
            const key = notam.id || notam.number || notam.qLine || notam.summary;
            const expirationTime = Date.now() + NEW_NOTAM_HIGHLIGHT_DURATION_MS;
            
            setNotamExpirationTimes(prev => ({
              ...prev,
              [key]: expirationTime
            }));
            
            const timer = setInterval(() => {
              const timeLeft = expirationTime - Date.now();
              if (timeLeft <= 0) {
                markNotamAsViewed(notam);
              }
            }, 1000);
            
            setNotamTimers(prev => ({
              ...prev,
              [key]: timer
            }));
          });
        }

        updated[icao] = notams;
        return updated;
      });

      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'success' }));
      return notams;

    } catch (error) {
      console.error(`Failed to fetch NOTAMs for ${icao}:`, error);
      setNotamFetchStatusByIcao(prev => ({ ...prev, [icao]: 'error' }));
      return { error: error.message };
    }
  };

  // Handle ICAO input
  const handleIcaoSubmit = (newIcaos) => {
    if (newIcaos.length === 0) return;
    
    const uniqueIcaos = [...new Set([...icaoSet, ...newIcaos])];
    setIcaoSet(uniqueIcaos);
    saveIcaos(uniqueIcaos);
    
    // Add new ICAOs to queue
    setIcaoQueue(prev => {
      const newQueue = [...prev];
      newIcaos.forEach(icao => {
        if (!newQueue.includes(icao) && !loadedIcaosSet.has(icao)) {
          newQueue.push(icao);
        }
      });
      return newQueue;
    });
    
    startBatchingIfNeeded();
  };

  const handleRemoveIcao = (icaoToRemove) => {
    const updatedIcaos = icaoSet.filter(icao => icao !== icaoToRemove);
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    
    // Clean up data for removed ICAO
    setNotamDataByIcao(prev => {
      const updated = { ...prev };
      delete updated[icaoToRemove];
      return updated;
    });
    
    setNotamFetchStatusByIcao(prev => {
      const updated = { ...prev };
      delete updated[icaoToRemove];
      return updated;
    });
    
    setLoadedIcaosSet(prev => {
      const newSet = new Set(prev);
      newSet.delete(icaoToRemove);
      return newSet;
    });
  };

  // Filter NOTAMs
  const getFilteredNotams = () => {
    const allNotams = [];
    
    Object.entries(notamDataByIcao).forEach(([icao, notams]) => {
      if (Array.isArray(notams)) {
        notams.forEach(notam => {
          const notamWithIcao = { ...notam, icao };
          
          // Apply filters
          if (shouldShowDespiteFilters(notamWithIcao, filters, keywordFilter)) {
            allNotams.push(notamWithIcao);
          }
        });
      }
    });
    
    return allNotams.sort((a, b) => {
      // Sort by ICAO first, then by creation time
      if (a.icao !== b.icao) {
        return a.icao.localeCompare(b.icao);
      }
      const timeA = new Date(a.issued || a.created || 0).getTime();
      const timeB = new Date(b.issued || b.created || 0).getTime();
      return timeB - timeA;
    });
  };

  // Auto refresh functionality
  const startAutoRefresh = () => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }
    
    autoRefreshTimerRef.current = setInterval(() => {
      setAutoRefreshCountdown(prev => {
        if (prev <= 1) {
          // Refresh all loaded ICAOs
          icaoSet.forEach(icao => {
            if (loadedIcaosSet.has(icao)) {
              fetchNotamsForIcao(icao);
            }
          });
          return AUTO_REFRESH_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopAutoRefresh = () => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
  };

  // Handle window visibility changes
  const handleVisibilityChange = () => {
    const isVisible = !document.hidden;
    setActiveSession(isVisible);
    
    if (isVisible) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  };

  // Initialize on mount
  useEffect(() => {
    const savedIcaos = getSavedIcaos();
    const savedSets = getIcaoSets();
    
    setIcaoSets(savedSets);
    
    if (savedIcaos.length > 0) {
      setIcaoSet(savedIcaos);
      setIcaoQueue(savedIcaos);
      startBatchingIfNeeded();
    }
    
    startAutoRefresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopAutoRefresh();
      stopBatching();
      Object.values(notamTimers).forEach(timer => clearInterval(timer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Start batching when queue changes
  useEffect(() => {
    if (icaoQueue.length > 0 && !batchingActive) {
      startBatchingIfNeeded();
    }
  }, [icaoQueue, batchingActive, startBatchingIfNeeded]);

  const filteredNotams = getFilteredNotams();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>NOTAM Dashboard</h1>
          <div className="header-controls">
            <div className="auto-refresh-status">
              Next refresh: {autoRefreshCountdown}s
            </div>
            <NotificationSystem
              count={notificationCount}
              notifications={notifications}
              showModal={showNotificationModal}
              onToggleModal={() => setShowNotificationModal(!showNotificationModal)}
              onMarkAsRead={updateNotificationCount}
            />
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="controls-section">
          <IcaoInput
            value={icaoInput}
            onChange={setIcaoInput}
            onSubmit={handleIcaoSubmit}
            icaoSet={icaoSet}
            onRemoveIcao={handleRemoveIcao}
            expanded={icaoListExpanded}
            onToggleExpanded={() => setIcaoListExpanded(!icaoListExpanded)}
          />
          
          <IcaoSetsBar
            onNewSetClick={handleNewSetClick}
            onManageSetsClick={() => setShowIcaoSetsModal(true)}
            isCurrentSetSaved={isCurrentSetSaved()}
          />
          
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            keywordFilter={keywordFilter}
            onKeywordFilterChange={setKeywordFilter}
          />
          
          <IcaoTabs
            icaoSet={icaoSet}
            notamDataByIcao={notamDataByIcao}
            activeTab={tabMode}
            onTabChange={setTabMode}
            flashingIcaos={flashingIcaos}
            loadingIcaos={loadingIcaosSet}
          />
        </div>

        <div className="content-section">
          {icaoQueue.length > 0 && (
            <ProgressBar
              current={icaoSet.length - icaoQueue.length}
              total={icaoSet.length}
              label="Loading NOTAMs"
            />
          )}
          
          <div className="notam-grid" style={{ transform: `scale(${cardScale})` }}>
            {filteredNotams.map((notam, index) => (
              <NotamCard
                key={`${notam.icao}-${notam.id || notam.number || index}`}
                notam={notam}
                isNew={isNewNotam(notam)}
                isExpanded={expandedCardKey === `${notam.icao}-${notam.id || notam.number || index}`}
                onToggleExpanded={() => {
                  const key = `${notam.icao}-${notam.id || notam.number || index}`;
                  setExpandedCardKey(expandedCardKey === key ? null : key);
                }}
                onMarkAsViewed={() => markNotamAsViewed(notam)}
                onShowRaw={(title, content) => {
                  setRawModalTitle(title);
                  setRawModalContent(content);
                  setShowRawModal(true);
                }}
              />
            ))}
          </div>
          
          {filteredNotams.length === 0 && icaoSet.length > 0 && (
            <div className="empty-state">
              <p>No NOTAMs match the current filters</p>
            </div>
          )}
          
          {icaoSet.length === 0 && (
            <div className="empty-state">
              <p>Enter ICAO codes above to view NOTAMs</p>
            </div>
          )}
        </div>
      </main>

      <BackToTopButton />

      {/* Modals */}
      <RawNotamModal
        isOpen={showRawModal}
        title={rawModalTitle}
        content={rawModalContent}
        onClose={() => setShowRawModal(false)}
      />

      <IcaoSetsModal
        isOpen={showIcaoSetsModal}
        icaoSets={icaoSets}
        newSetName={newSetName}
        onNewSetNameChange={setNewSetName}
        onCreateSet={createIcaoSet}
        onLoadSet={loadIcaoSet}
        onDeleteSet={deleteIcaoSet}
        onClose={() => {
          setShowIcaoSetsModal(false);
          setNewSetName('');
          setPendingNewSetAction(false);
        }}
      />

      <SaveSetModal
        isOpen={showSaveSetModal}
        onResponse={handleSaveSetResponse}
      />
    </div>
  );
}

export default App;
