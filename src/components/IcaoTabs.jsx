// src/components/IcaoTabs.jsx
import React from 'react';

const IcaoTabs = ({ 
  tabMode, 
  onTabClick, 
  icaoSet, 
  notamDataByIcao, 
  hasNewNotams,
  newNotamsByIcao
}) => {
  if (icaoSet.length === 0) return null;

  const getNotamCount = (icao) => {
    const notams = notamDataByIcao[icao];
    return Array.isArray(notams) ? notams.length : 0;
  };

  const getNewNotamCount = (icao) => {
    const newNotams = newNotamsByIcao[icao] || [];
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return newNotams.filter(item => item.timestamp > fiveMinutesAgo).length;
  };

  const getTotalNewNotams = () => {
    return icaoSet.reduce((total, icao) => total + getNewNotamCount(icao), 0);
  };

  const renderNotificationIndicator = (newCount) => {
    if (newCount === 0) return null;
    
    if (newCount === 1) {
      // Single new NOTAM - show red dot
      return (
        <span 
          className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg"
          style={{
            boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
            animation: 'pulse 2s infinite',
            border: '1px solid rgba(30, 41, 59, 0.8)'
          }}
          title={`${newCount} new NOTAM`}
        />
      );
    } else {
      // Multiple new NOTAMs - show numbered badge
      return (
        <span 
          className="absolute -top-2 -right-2 min-w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold"
          style={{
            fontSize: '0.65rem',
            padding: '0 4px',
            lineHeight: 1,
            border: '1px solid #991b1b',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            animation: 'pulse 2s infinite'
          }}
          title={`${newCount} new NOTAMs`}
        >
          {newCount > 99 ? '99+' : newCount}
        </span>
      );
    }
  };

  return (
    <div className="icao-tabs mb-4">
      {/* ALL Tab */}
      <button
        onClick={() => onTabClick("ALL")}
        className={`icao-tab ${tabMode === "ALL" ? "active" : ""}`}
        style={{ position: 'relative' }}
      >
        ALL ({icaoSet.reduce((sum, icao) => sum + getNotamCount(icao), 0)})
        {getTotalNewNotams() > 0 && renderNotificationIndicator(getTotalNewNotams())}
      </button>
      
      {/* Individual ICAO Tabs */}
      {icaoSet.map(icao => {
        const notamCount = getNotamCount(icao);
        const newCount = getNewNotamCount(icao);
        const hasNew = hasNewNotams && hasNewNotams(icao);
        
        return (
          <button
            key={icao}
            onClick={() => onTabClick(icao)}
            className={`icao-tab ${tabMode === icao ? "active" : ""} ${hasNew ? "has-new-notams" : ""}`}
            style={{ position: 'relative' }}
          >
            {icao} ({notamCount})
            {hasNew && renderNotificationIndicator(newCount)}
          </button>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
