
// ========================================
// src/components/IcaoTabs.jsx
// ========================================
import React from 'react';

const IcaoTabs = ({ 
  tabMode, 
  onTabClick, 
  icaoSet, 
  notamDataByIcao, 
  flashingIcaos, 
  newNotams 
}) => {
  if (icaoSet.length === 0) return null;

  const getNotamCount = (icao) => {
    const notams = notamDataByIcao[icao];
    return Array.isArray(notams) ? notams.length : 0;
  };

  const getNewNotamCount = (icao) => {
    return newNotams[icao] ? newNotams[icao].size : 0;
  };

  return (
    <div className="icao-tabs mb-4">
      <button
        onClick={() => onTabClick("ALL")}
        className={`icao-tab ${tabMode === "ALL" ? "active" : ""}`}
      >
        ALL ({icaoSet.reduce((sum, icao) => sum + getNotamCount(icao), 0)})
      </button>
      
      {icaoSet.map(icao => {
        const notamCount = getNotamCount(icao);
        const newCount = getNewNotamCount(icao);
        const isFlashing = flashingIcaos.has(icao);
        
        return (
          <button
            key={icao}
            onClick={() => onTabClick(icao)}
            className={`icao-tab ${tabMode === icao ? "active" : ""} ${isFlashing ? "flashing-tab" : ""}`}
          >
            {icao} ({notamCount})
            {newCount > 0 && (
              <span className="ml-1 px-1 bg-red-500 text-white text-xs rounded">
                +{newCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
