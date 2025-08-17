// src/components/IcaoInput.jsx
// ========================================
import React, { useState } from 'react';

const IcaoInput = ({ 
  icaoInput, 
  setIcaoInput, 
  icaoSet, 
  icaoListExpanded, 
  setIcaoListExpanded, 
  onSubmit, 
  onRemoveIcao 
}) => {
  const [inputValue, setInputValue] = useState(icaoInput || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    const icaos = inputValue
      .toUpperCase()
      .split(/[,\s]+/)
      .filter(icao => icao.match(/^[A-Z]{4}$/))
      .filter((icao, index, arr) => arr.indexOf(icao) === index);
    
    if (icaos.length > 0) {
      onSubmit(icaos);
      setInputValue('');
      setIcaoInput('');
    }
  };

  return (
    <div className="glass p-4 mb-4">
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIcaoInput(e.target.value);
            }}
            placeholder="Enter ICAO codes (e.g., KJFK, KLAX, EGLL)"
            className="flex-1 px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      {icaoSet.length > 0 && (
        <div className="space-y-2">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIcaoListExpanded(!icaoListExpanded)}
          >
            <h3 className="text-lg font-semibold text-cyan-300">
              Current ICAOs ({icaoSet.length})
            </h3>
            <i className={`fa fa-chevron-${icaoListExpanded ? 'up' : 'down'} text-slate-400`}></i>
          </div>
          
          {icaoListExpanded && (
            <div className="flex flex-wrap gap-2">
              {icaoSet.map((icao) => (
                <div key={icao} className="icao-chip">
                  <span>{icao}</span>
                  <span 
                    className="remove-btn ml-2"
                    onClick={() => onRemoveIcao(icao)}
                  >
                    ×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IcaoInput;
