import React from 'react';

const NotamTabs = ({ tabMode, handleTabClick, icaoSet, notamDataByIcao, flashingIcaos }) => {
  return (
    <div className="icao-tabs">
      <div
        className={`icao-tab ${tabMode === 'ALL' ? 'active' : ''}`}
        onClick={() => handleTabClick('ALL')}
      >
        ALL ({Object.values(notamDataByIcao).reduce((sum, notams) => sum + (Array.isArray(notams) ? notams.length : 0), 0)})
      </div>
      {icaoSet.map(icao => {
        const count = Array.isArray(notamDataByIcao[icao]) ? notamDataByIcao[icao].length : 0;
        const isFlashing = flashingIcaos.has(icao);
        return (
          <div
            key={icao}
            className={`icao-tab ${tabMode === icao ? 'active' : ''} ${isFlashing ? 'flashing-tab' : ''}`}
            onClick={() => handleTabClick(icao)}
          >
            {icao} ({count})
          </div>
        );
      })}
    </div>
  );
};

export default NotamTabs;