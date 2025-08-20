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
  newNotams,
  onShowIcaoRaw
}) => {
  if (icaoSet.length === 0) return null;

  const getNotamCount = (icao) => {
    const notams = notamDataByIcao[icao];
    return Array.isArray(notams) ? notams.length : 0;
  };

  const getNewNotamCount = (icao) => {
    return newNotams[icao] ? newNotams[icao].size : 0;
  };

  const handleRawClick = (e, icao) => {
    e.preventDefault();
    e.stopPropagation();
    onShowIcaoRaw(icao);
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
          <div key={icao} className="flex items-center gap-1">
            <button
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
            {notamCount > 0 && (
              <button
                onClick={(e) => handleRawClick(e, icao)}
                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs transition-colors"
                title={`View raw NOTAMs for ${icao}`}
              >
                RAW
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
