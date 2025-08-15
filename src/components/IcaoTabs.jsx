import React from 'react';

const IcaoTabs = ({ 
  tabMode, 
  onTabClick, 
  icaoSet, 
  notamDataByIcao, 
  flashingIcaos 
}) => {
  const totalNotams = Object.values(notamDataByIcao).reduce(
    (sum, notams) => sum + (Array.isArray(notams) ? notams.length : 0), 
    0
  );

  return (
    <div className="icao-tabs">
      <div
        className={`icao-tab ${tabMode === 'ALL' ? 'active' : ''}`}
        onClick={() => onTabClick('ALL')}
      >
        ALL ({totalNotams})
      </div>
      {icaoSet.map(icao => {
        const count = Array.isArray(notamDataByIcao[icao]) ? notamDataByIcao[icao].length : 0;
        const isFlashing = flashingIcaos.has(icao);
        return (
          <div
            key={icao}
            className={`icao-tab ${tabMode === icao ? 'active' : ''} ${isFlashing ? 'flashing-tab' : ''}`}
            onClick={() => onTabClick(icao)}
          >
            {icao} ({count})
          </div>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
