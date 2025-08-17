// ========================================
// src/components/IcaoSetsBar.jsx
// ========================================
import React from 'react';

const IcaoSetsBar = ({ icaoSets, onShowSetsModal, onNewSetClick, onLoadSet }) => {
  if (icaoSets.length === 0) return null;

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-cyan-300">Saved ICAO Sets</h3>
        <div className="flex gap-2">
          <button
            onClick={onNewSetClick}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors"
          >
            <i className="fa fa-plus mr-2"></i>New Set
          </button>
          <button
            onClick={onShowSetsModal}
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
          >
            <i className="fa fa-cog mr-2"></i>Manage
          </button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {icaoSets.slice(0, 5).map((set, index) => (
          <button
            key={index}
            onClick={() => onLoadSet(set.icaos)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-cyan-300 rounded-lg text-sm transition-colors"
            title={`${set.icaos.join(', ')} (${set.icaos.length} ICAOs)`}
          >
            {set.name}
          </button>
        ))}
        {icaoSets.length > 5 && (
          <button
            onClick={onShowSetsModal}
            className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-lg text-sm transition-colors"
          >
            +{icaoSets.length - 5} more
          </button>
        )}
      </div>
    </div>
  );
};

export default IcaoSetsBar;
