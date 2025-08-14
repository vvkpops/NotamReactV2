import React, { createContext, useContext, useState, useEffect } from 'react';
import { AUTO_REFRESH_INTERVAL_MS } from '../utils/NotamUtils';

// Create Context
const NotamContext = createContext();

// Context Provider
export const NotamContextProvider = ({ children }) => {
  // Core state
  const [icaoSet, setIcaoSet] = useState([]);
  const [icaoInput, setIcaoInput] = useState('');
  const [tabMode, setTabMode] = useState("ALL");
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);
  const [cardScale, setCardScale] = useState(1.0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState('');
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

  // Load saved ICAOs
  useEffect(() => {
    const savedIcaos = localStorage.getItem('notamIcaos');
    if (savedIcaos) {
      try {
        const parsed = JSON.parse(savedIcaos);
        setIcaoSet(parsed);
      } catch (e) {
        console.error('Failed to parse saved ICAOs:', e);
      }
    }
  }, []);

  // Save ICAOs when they change
  useEffect(() => {
    localStorage.setItem('notamIcaos', JSON.stringify(icaoSet));
  }, [icaoSet]);

  // Scroll handler for back to top
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.pageYOffset > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle filter change
  const handleFilterChange = (filterKey) => {
    setFilters(prev => ({ ...prev, [filterKey]: !prev[filterKey] }));
  };

  return (
    <NotamContext.Provider
      value={{
        icaoSet,
        setIcaoSet,
        icaoInput,
        setIcaoInput,
        tabMode,
        setTabMode,
        expandedCardKey,
        setExpandedCardKey,
        icaoListExpanded,
        setIcaoListExpanded,
        autoRefreshCountdown,
        setAutoRefreshCountdown,
        cardScale,
        setCardScale,
        showBackToTop,
        keywordFilter,
        setKeywordFilter,
        filters,
        handleFilterChange
      }}
    >
      {children}
    </NotamContext.Provider>
  );
};

// Custom hook to use the context
export const useNotamContext = () => useContext(NotamContext);

export default NotamContext;