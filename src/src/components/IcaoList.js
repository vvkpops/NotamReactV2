import React from 'react';

const IcaoList = ({ icaoSet, removeIcao, icaoListExpanded }) => {
  if (!icaoListExpanded) return null;
  
  return (
    <div className="w-full sm:w-auto mb-4">
      <div className="flex flex-wrap gap-2">
        {icaoSet.map(icao => (
          <div key={icao} className="icao-chip">
            {icao}
            <span className="remove-btn" onClick={() => removeIcao(icao)}>×</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IcaoList;