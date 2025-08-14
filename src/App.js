import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import { 
  AUTO_REFRESH_INTERVAL_MS,
  shouldShowDespiteFilters,
  getNotamType,
  getNotamFlags
} from './utils/NotamUtils';

// Import hooks
import { useNotamData } from './hooks/useNotamData';
import { useBatching } from './hooks/useBatching';
import { useIcaoSets } from './hooks/useIcaoSets';
import { useNotifications } from './hooks/useNotifications';
import { useSessionManager } from './hooks/useSessionManager';

// Import components
import NotamCard from './components/NotamCard';
import FilterBar from './components/FilterBar';
import IcaoInput from './components/IcaoInput';
import IcaoList from './components/IcaoList';
import NotamTabs from './components/NotamTabs';
import RawNotamModal from './components/modals/RawNotamModal';
import IcaoSetsModal from './components/modals/IcaoSetsModal';
import SaveSetModal from './components/modals/SaveSetModal';
import NotificationModal from './components/modals/NotificationModal';

function App() {
  // Core state
  const [icaoSet, setIcaoSet] = useState([]);
  const [icaoInput, setIcaoInput] = useState('');
  const [tabMode, setTabMode] = useState("ALL");
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
  
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
  
  // RAW Modal state
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawModalTitle, setRawModalTitle] = useState('');
  const [rawModalContent, setRawModalContent] = useState('');
  
  // Auto-refresh state
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);
  const autoRefreshTimerRef = useRef(null);
  const saveSetModalRef = useRef(null);
  
  // Use custom hooks
  const { activeSession } = useSessionManager();
  
  const { 
    notamDataByIcao, loadedIcaosSet, loadingIcaosSet, newNotams,
    flashingIcaos, notamExpirationTimes, notamTimers, notamFetchStatusByIcao,
    lastNotamIdsByIcao, pendingNewNotams, fetchNotamsForIcaoWithTracking, 
    markNotamAsViewed, isNewNotam, cleanupNotamTimers, setNotamDataByIcao,
    setNotamFetchStatusByIcao, setLastNotamIdsByIcao, setLoadedIcaosSet, 
    setLoadingIcaosSet, setNewNotams, setFlashingIcaos, setNotamExpirationTimes, 
    setNotamTimers, setPendingNewNotams
  } = useNotamData(icaoSet, activeSession, tabMode);
  
  const {
    icaoQueue, setIcaoQueue, startBatchingIfNeeded, stopBatching
  } = useBatching(activeSession, loadedIcaosSet, loadingIcaosSet, fetchNotamsForIcaoWithTracking);
  
  const {
    icaoSets, showIcaoSetsModal, newSetName, showSaveSetModal,
    setShowIcaoSetsModal, setNewSetName, createIcaoSet, deleteIcaoSet,
    handleNewSetClick, handleSaveSetResponse, isCurrentSetSaved
  } = useIcaoSets(icaoSet);
  
  const {
    notificationCount, notifications, showNotificationModal,
    notificationModalRef, setShowNotificationModal, showNewNotamAlert,
    handleNotificationClick, updateNotificationCount, clearAllNotifications
  } = useNotifications();
  
  // Load saved data
  useEffect(() => {
    const savedIcaos = localStorage.getItem('notamIcaos');
    if (savedIcaos) {
      try {
        const parsed = JSON.parse(savedIcaos);
        setIcaoSet(parsed);
        if (parsed.length > 0) {
          // Use batching system for initial load
          setIcaoQueue(parsed);
          setTimeout(() => startBatchingIfNeeded(), 100);
        }
      } catch (e) {
        console.error('Failed to parse saved ICAOs:', e);
      }
    }
  }, []);

  // Save ICAOs when changed
  useEffect(() => {
    localStorage.setItem('notamIcaos', JSON.stringify(icaoSet));
  }, [icaoSet]);

  // Auto-refresh logic with change detection
  useEffect(() => {
    const updateTimer = () => {
      setAutoRefreshCountdown(prev => {
        if (prev <= 1) {
          performAutoRefresh();
          return AUTO_REFRESH_INTERVAL_MS / 1000;
        }
        return prev - 1;
      });
    };

    autoRefreshTimerRef.current = setInterval(updateTimer, 1000);
    
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, []);

  // Scroll handler for back to top
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.pageYOffset > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside modal handlers
  useEffect(() => {
    function handleClickOutside(event) {
      // Notification modal
      if (
        notificationModalRef.current && 
        !notificationModalRef.current.contains(event.target) &&
        !event.target.closest('.notification-bell')
      ) {
        setShowNotificationModal(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Clean up function when component unmounts
  useEffect(() => {
    return () => {
      cleanupNotamTimers();
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [cleanupNotamTimers]);

  // Auto-refresh function
  const performAutoRefresh = async () => {
    if (!activeSession || !icaoSet.length) return;
    
    // Store previous NOTAMs for change detection
    const previousByIcao = {};
    for (const icao of icaoSet) {
      previousByIcao[icao] = Array.isArray(notamDataByIcao[icao]) ? notamDataByIcao[icao].slice() : [];
    }
    
    // Fetch all NOTAMs with fallback
    for (const icao of icaoSet) {
      try {
        const result = await fetchNotamsForIcaoWithTracking(icao, true, false);
        if (result && result.newCount && result.newCount > 0) {
          showNewNotamAlert(result.alertText, icao, result.latestNewNotamKey);
        }
      } catch (err) {
        console.error(`Auto-refresh error for ${icao}:`, err);
      }
    }
  };

  // Event handlers
  const handleIcaoSubmit = (e) => {
    e.preventDefault();
    if (!icaoInput.trim()) return;

    const icaos = icaoInput
      .toUpperCase()
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length === 4 && /^[A-Z]{4}$/.test(s));

    if (icaos.length > 0) {
      setIcaoSet(prev => [...new Set([...prev, ...icaos])]);
      
      // Add to queue for batching
      const newIcaos = icaos.filter(icao => !loadedIcaosSet.has(icao));
      if (newIcaos.length > 0) {
        setIcaoQueue(prev => [...prev, ...newIcaos.filter(icao => !prev.includes(icao))]);
      }
      
      setIcaoInput('');
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL_MS / 1000);
    }
  };

  const removeIcao = (icaoToRemove) => {
    // Clear timers for this ICAO
    if (newNotams[icaoToRemove]) {
      for (const key of newNotams[icaoToRemove]) {
        if (notamTimers[key]) {
          clearInterval(notamTimers[key]);
        }
      }
    }
    
    setIcaoSet(prev => prev.filter(icao => icao !== icaoToRemove));
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
    
    // Remove from newNotams and clean up timers
    setNewNotams(prev => {
      const newState = {...prev};
      
      if (newState[icaoToRemove]) {
        // Clean up timers for this ICAO's NOTAMs
        newState[icaoToRemove].forEach(key => {
          setNotamTimers(prev => {
            const updated = { ...prev };
            if (updated[key]) {
              clearInterval(updated[key]);
              delete updated[key];
            }
            return updated;
          });
          
          setNotamExpirationTimes(prev => {
            const updated = { ...prev };
            delete updated[key];
            return updated;
          });
        });
        
        delete newState[icaoToRemove];
      }
      
      return newState;
    });
    
    // Remove from pendingNewNotams
    setPendingNewNotams(prev => {
      const newState = {...prev};
      delete newState[icaoToRemove];
      return newState;
    });
    
    // Remove from queue if present
    setIcaoQueue(prev => prev.filter(icao => icao !== icaoToRemove));
    
    // If this was the active tab, switch to ALL
    if (tabMode === icaoToRemove) {
      setTabMode("ALL");
    }
  };

  const handleFilterChange = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  const handleReloadAll = async () => {
    if (!icaoSet.length) return;
    
    // Clear all timers
    Object.values(notamTimers).forEach(timer => {
      clearInterval(timer);
    });
    
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
    
    // Use batching for reload
    setIcaoQueue([...icaoSet]);
    startBatchingIfNeeded();
    setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL_MS / 1000);
  };

  const handleCardClick = (cardKey, notam) => {
    setExpandedCardKey(prev => prev === cardKey ? null : cardKey);
    
    // Mark NOTAM as viewed when expanded
    if (notam && isNewNotam(notam)) {
      markNotamAsViewed(notam);
    }
  };

  const handleNotificationItemClick = (notification) => {
    const result = handleNotificationClick(notification, setTabMode);
    
    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // If there's a specific NOTAM key, try to scroll to it after tab change
    if (result.latestNewNotamKey) {
      setTimeout(() => {
        const sanitizedKey = result.latestNewNotamKey.replace(/[^a-zA-Z0-9_-]/g,'');
        const element = document.getElementById(`notam-${sanitizedKey}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Brief highlight effect
          element.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.6)';
          setTimeout(() => {
            element.style.boxShadow = '';
          }, 2000);
          
          // Mark this NOTAM as viewed
          const icao = result.icao;
          const notams = notamDataByIcao[icao] || [];
          const notam = notams.find(n => 
            (n.id || n.number || n.qLine || n.summary) === result.latestNewNotamKey
          );
          
          if (notam) {
            markNotamAsViewed(notam);
          }
        }
      }, 500);
    }
  };

  const handleTabClick = (newTabMode) => {
    setTabMode(newTabMode);
  };

  // Load ICAO set
  const loadIcaoSet = (setIcaos) => {
    // Clear any existing timers
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
    
    // Enqueue all ICAOs for batching
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

  // Show Raw NOTAM modal
  const showRawNotamModal = (notam) => {
    const title = `${notam.number || notam.icao || "NOTAM"} Raw`;
    let rawContent = "";
    if (notam.qLine) rawContent += notam.qLine + "\n";
    if (notam.body) rawContent += notam.body;
    else if (notam.summary) rawContent += notam.summary;
    
    setRawModalTitle(title);
    setRawModalContent(rawContent.trim());
    setShowRawModal(true);
    
    // Mark as viewed when opening raw view
    markNotamAsViewed(notam);
  };

  const closeRawModal = () => {
    setShowRawModal(false);
  };

  // Clear current set and reset states
  const clearCurrentSet = () => {
    // Clear all NOTAM timers before resetting state
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
    
    // Focus the input field
    setTimeout(() => {
      document.querySelector('input[placeholder="ICAO (comma separated)"]').focus();
    }, 100);
  };

  // Handle "New Set" button click
  const handleNewSetButtonClick = () => {
    if (icaoSet.length === 0) {
      // If there's no current set, just focus the input
      document.querySelector('input[placeholder="ICAO (comma separated)"]').focus();
      return;
    }
    
    const shouldClear = handleNewSetClick();
    if (shouldClear) {
      clearCurrentSet();
    }
  };
  
  // Handle save set modal response
  const handleSaveSetModalResponse = (shouldSave) => {
    const shouldClear = handleSaveSetResponse(shouldSave);
    if (shouldClear) {
      clearCurrentSet();
    }
  };

  // Filter and display logic
  const getFilteredNotams = () => {
    let allNotams = [];
    
    if (tabMode === "ALL") {
      // Group by ICAO for the ALL tab
      let icaoGroups = {};
      Object.entries(notamDataByIcao).forEach(([icao, notams]) => {
        if (Array.isArray(notams) && notams.length > 0) {
          icaoGroups[icao] = notams.map(n => ({ ...n, icao }));
        }
      });
      
      // Sort ICAOs alphabetically
      const sortedIcaos = Object.keys(icaoGroups).sort();
      
      // Process each ICAO group separately - maintaining grouping
      sortedIcaos.forEach(icao => {
        const notamsForIcao = [...icaoGroups[icao]];
        
        // Filter this ICAO's NOTAMs 
        const filteredNotamsForIcao = notamsForIcao.filter(notam => {
          // Always include new NOTAMs regardless of other filters
          if (shouldShowDespiteFilters(notam, newNotams)) {
            return true;
          }
          
          const flags = getNotamFlags(notam);
          const text = (notam.summary + ' ' + (notam.body || '')).toLowerCase();
          
          // Keyword filter
          if (keywordFilter && !text.includes(keywordFilter.toLowerCase())) {
            return false;
          }
          
          // Type filters
          if (flags.isRunwayClosure && !filters.rwy) return false;
          if (flags.isTaxiwayClosure && !filters.twy) return false;
          if (flags.isRSC && !filters.rsc) return false;
          if (flags.isCRFI && !filters.crfi) return false;
          if (flags.isILS && !filters.ils) return false;
          if (flags.isFuel && !filters.fuel) return false;
          if (flags.isCancelled && !filters.cancelled) return false;
          if (flags.isDom && !filters.dom) return false;
          
          // Other type
          if (!flags.isRunwayClosure && !flags.isTaxiwayClosure && !flags.isRSC && 
              !flags.isCRFI && !flags.isILS && !flags.isFuel && !flags.isCancelled && 
              !flags.isDom && !filters.other) return false;
          
          // Time filters
          const isCurrent = isNotamCurrent(notam);
          const isFuture = isNotamFuture(notam);
          
          if (isCurrent && !filters.current) return false;
          if (isFuture && !filters.future) return false;
          
          return true;
        });
        
        // Only add this ICAO group if it has NOTAMs after filtering
        if (filteredNotamsForIcao.length > 0) {
          // Sort NOTAMs within this ICAO group by type priority
          filteredNotamsForIcao.sort((a, b) => {
            const types = ["rwy", "twy", "rsc", "crfi", "ils", "fuel", "other"];
            const aType = getNotamType(a);
            const bType = getNotamType(b);
            const aIndex = types.indexOf(aType);
            const bIndex = types.indexOf(bType);
            return aIndex - bIndex;
          });
          
          // Add ICAO header and its NOTAMs to the result
          allNotams.push({ 
            isIcaoHeader: true, 
            icao,
            count: filteredNotamsForIcao.length
          });
          
          allNotams = [...allNotams, ...filteredNotamsForIcao];
        }
      });
      
      // If there are no NOTAMs after filtering, return empty array
      if (allNotams.filter(item => !item.isIcaoHeader).length === 0) {
        return [];
      }
      
      return allNotams;
    } 
    else {
      // Single ICAO tab
      const notams = notamDataByIcao[tabMode];
      if (Array.isArray(notams)) {
        allNotams = notams.map(n => ({ ...n, icao: tabMode }));
      }

      // Filter logic
      const filtered = allNotams.filter(notam => {
        // Always include new NOTAMs regardless of other filters
        if (shouldShowDespiteFilters(notam, newNotams)) {
          return true;
        }
        
        const flags = getNotamFlags(notam);
        const text = (notam.summary + ' ' + (notam.body || '')).toLowerCase();
        
        // Keyword filter
        if (keywordFilter && !text.includes(keywordFilter.toLowerCase())) {
          return false;
        }
        
        // Type filters
        if (flags.isRunwayClosure && !filters.rwy) return false;
        if (flags.isTaxiwayClosure && !filters.twy) return false;
        if (flags.isRSC && !filters.rsc) return false;
        if (flags.isCRFI && !filters.crfi) return false;
        if (flags.isILS && !filters.ils) return false;
        if (flags.isFuel && !filters.fuel) return false;
        if (flags.isCancelled && !filters.cancelled) return false;
        if (flags.isDom && !filters.dom) return false;
        
        // Other type
        if (!flags.isRunwayClosure && !flags.isTaxiwayClosure && !flags.isRSC && 
            !flags.isCRFI && !flags.isILS && !flags.isFuel && !flags.isCancelled && 
            !flags.isDom && !filters.other) return false;
        
        // Time filters
        const isCurrent = isNotamCurrent(notam);
        const isFuture = isNotamFuture(notam);
        
        if (isCurrent && !filters.current) return false;
        if (isFuture && !filters.future) return false;
        
        return true;
      });

      // Sort by whether NOTAMs are new and by filter type priority
      filtered.sort((a, b) => {
        // New NOTAMs first
        const aIsNew = isNewNotam(a);
        const bIsNew = isNewNotam(b);
        if (aIsNew && !bIsNew) return -1;
        if (!aIsNew && bIsNew) return 1;
        
        // If both are new, sort by remaining time (shorter time first)
        if (aIsNew && bIsNew) {
          const aKey = a.id || a.number || a.qLine || a.summary;
          const bKey = b.id || b.number || b.qLine || b.summary;
          const aTime = notamExpirationTimes[aKey] || 0;
          const bTime = notamExpirationTimes[bKey] || 0;
          return aTime - bTime;
        }
        
        // Then sort by filter type priority
        const types = ["rwy", "twy", "rsc", "crfi", "ils", "fuel", "other"];
        const aType = getNotamType(a);
        const bType = getNotamType(b);
        const aIndex = types.indexOf(aType);
        const bIndex = types.indexOf(bType);
        return aIndex - bIndex;
      });
      
      return filtered;
    }
  };

  const filteredNotams = getFilteredNotams();

  // Progress calculation
  const totalIcaos = icaoSet.length;
  const loadedCount = loadedIcaosSet.size;
  const loadingCount = loadingIcaosSet.size;
  const queuedCount = icaoQueue.length;
  const progressPercent = totalIcaos > 0 ? (loadedCount / totalIcaos) * 100 : 0;

  return (
    <div className="bg-gradient-to-br from-[#181c2b] to-[#202230] min-h-screen text-slate-100 w-full">
      {/* RAW NOTAM Modal */}
      <RawNotamModal 
        showRawModal={showRawModal}
        rawModalTitle={rawModalTitle}
        rawModalContent={rawModalContent}
        closeRawModal={closeRawModal}
      />

      {/* ICAO Sets Modal */}
      <IcaoSetsModal 
        showIcaoSetsModal={showIcaoSetsModal}
        setShowIcaoSetsModal={setShowIcaoSetsModal}
        newSetName={newSetName}
        setNewSetName={setNewSetName}
        createIcaoSet={createIcaoSet}
        icaoSets={icaoSets}
        deleteIcaoSet={deleteIcaoSet}
        loadIcaoSet={loadIcaoSet}
        icaoSet={icaoSet}
      />
      
      {/* Save Set Confirmation Modal */}
      <SaveSetModal 
        showSaveSetModal={showSaveSetModal}
        handleSaveSetResponse={handleSaveSetModalResponse}
        saveSetModalRef={saveSetModalRef}
      />

      {/* Notification Bell */}
      <div className="notification-bell" onClick={() => setShowNotificationModal(!showNotificationModal)}>
        <span style={{ fontSize: '26px', position: 'relative' }}>
          <i className="fa-solid fa-bell"></i>
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </span>
      </div>

      {/* Notification Modal */}
      <NotificationModal 
        showNotificationModal={showNotificationModal}
        notificationModalRef={notificationModalRef}
        notifications={notifications}
        handleNotificationClick={handleNotificationItemClick}
        clearAllNotifications={clearAllNotifications}
      />

      <div className="container mx-auto px-2 py-6">
        {/* Header */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6 text-cyan-300 flex items-center gap-3">
          <i className="fa-solid fa-plane-departure text-xl text-cyan-400"></i>
          NOTAM Dashboard
        </h1>

        {/* ICAO Input */}
        <IcaoInput 
          icaoInput={icaoInput}
          setIcaoInput={setIcaoInput}
          handleIcaoSubmit={handleIcaoSubmit}
          icaoListExpanded={icaoListExpanded}
          setIcaoListExpanded={setIcaoListExpanded}
        />
        
        {/* ICAO List */}
        {icaoListExpanded && (
          <IcaoList 
            icaoSet={icaoSet}
            removeIcao={removeIcao}
            icaoListExpanded={icaoListExpanded}
          />
        )}

        {/* ICAO Sets Bar */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setShowIcaoSetsModal(true)}
              className="glass px-3 py-1 rounded-lg text-cyan-300 hover:bg-cyan-950 transition"
              style={{ fontSize: '0.875rem' }}
            >
              <i className="fa fa-bookmark mr-1"></i>
              ICAO Sets
            </button>
            <button
              onClick={handleNewSetButtonClick}
              className="glass px-3 py-1 rounded-lg text-green-300 hover:bg-green-950 transition"
              style={{ fontSize: '0.875rem' }}
            >
              <i className="fa fa-plus mr-1"></i>
              New Set
            </button>
            {icaoSets.slice(0, 5).map((set, index) => (
              <button
                key={index}
                onClick={() => loadIcaoSet(set.icaos)}
                className="glass px-2 py-1 rounded text-xs text-slate-300 hover:text-cyan-300 transition"
                title={`Load: ${set.icaos.join(', ')}`}
              >
                {set.name}
              </button>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div id="icao-progress-bar-outer">
          <div id="icao-progress-label">ICAO Load Progress</div>
          <div id="icao-progress-bar-bg">
            <div id="icao-progress-bar" style={{ width: `${progressPercent}%` }}></div>
            <div id="icao-progress-text">
              {loadedCount} / {totalIcaos} loaded
              {loadingCount > 0 && ` (${loadingCount} loading...)`}
              {queuedCount > 0 && ` (${queuedCount} queued)`}
            </div>
          </div>
          <div id="icao-progress-timer">
            Auto refresh in {Math.floor(autoRefreshCountdown / 60)}:{(autoRefreshCountdown % 60).toString().padStart(2, '0')}
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar 
          filters={filters}
          handleFilterChange={handleFilterChange}
          keywordFilter={keywordFilter}
          setKeywordFilter={setKeywordFilter}
          cardScale={cardScale}
          setCardScale={setCardScale}
          handleReloadAll={handleReloadAll}
        />
        
        {/* ICAO Tabs */}
        <NotamTabs 
          tabMode={tabMode}
          handleTabClick={handleTabClick}
          icaoSet={icaoSet}
          notamDataByIcao={notamDataByIcao}
          flashingIcaos={flashingIcaos}
        />

        {/* NOTAM Cards - Grid Layout */}
        <div id="result">
          {filteredNotams.length > 0 ? (
            <div className="notam-grid">
              {filteredNotams.map((notam, index) => (
                <NotamCard 
                  key={`notam-${index}-${notam.id || notam.number || notam.qLine || Math.random().toString(36).substring(2, 15)}`}
                  notam={notam}
                  expandedCardKey={expandedCardKey}
                  handleCardClick={handleCardClick}
                  isNewNotam={isNewNotam(notam)}
                  markNotamAsViewed={markNotamAsViewed}
                  notamExpirationTimes={notamExpirationTimes}
                  showRawNotamModal={showRawNotamModal}
                  cardScale={cardScale}
                />
              ))}
            </div>
          ) : (
            <div className="glass p-8 rounded-lg text-center text-base text-slate-400">
              {icaoSet.length === 0 
                ? "Add some ICAO codes above to get started"
                : loadingCount > 0 || queuedCount > 0
                ? "Loading NOTAMs..."
                : "No NOTAMs found matching current filters"
              }
            </div>
          )}
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        id="back-to-top-btn"
        className={showBackToTop ? 'show' : ''}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Back to top"
      >
        <i className="fa fa-arrow-up"></i>
      </button>
    </div>
  );
}

export default App;