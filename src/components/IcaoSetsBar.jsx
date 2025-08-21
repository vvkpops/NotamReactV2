// ========================================
// src/components/IcaoSetsBar.jsx
// ========================================
import React from 'react';

const IcaoSetsBar = ({ icaoSets, onShowSetsModal, onNewSetClick, onLoadSet, icaoSet }) => {
  // Always show the bar if there are ICAOs entered or saved sets exist
  if (!icaoSet || (icaoSet.length === 0 && icaoSets.length === 0)) return null;

  return (
    <div className="glass p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-cyan-300">
          {icaoSets.length > 0 ? 'Saved ICAO Sets' : 'ICAO Set Actions'}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onNewSetClick}
            disabled={!icaoSet || icaoSet.length === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
            title={icaoSet && icaoSet.length > 0 ? `Save current set (${icaoSet.length} ICAOs)` : 'Add some ICAOs first'}
          >
            <i className="fa fa-plus mr-2"></i>Save Current Set
          </button>
          {icaoSets.length > 0 && (
            <button
              onClick={onShowSetsModal}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
            >
              <i className="fa fa-cog mr-2"></i>Manage ({icaoSets.length})
            </button>
          )}
        </div>
      </div>
      
      {icaoSets.length > 0 && (
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
      )}
    </div>
  );
};

export default IcaoSetsBar;
