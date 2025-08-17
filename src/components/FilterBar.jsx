// ========================================
// src/components/FilterBar.jsx
// ========================================
import React from 'react';
import { FILTER_LABELS } from '../constants';

const FilterBar = ({ 
  filters, 
  onFilterChange, 
  keywordFilter, 
  setKeywordFilter,
  cardScale,
  setCardScale,
  onReloadAll 
}) => {
  const filterKeys = Object.keys(FILTER_LABELS);

  return (
    <div className="glass p-4 mb-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        {/* Filter Chips */}
        <div className="filter-chips">
          {filterKeys.map(key => (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={`filter-chip filter-chip-${key} ${filters[key] ? 'active' : ''}`}
            >
              {FILTER_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Keyword Search */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
              placeholder="Search..."
              className="px-3 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm w-32"
            />
          </div>

          {/* Card Scale */}
          <div className="card-scale-wrap">
            <span className="text-xs text-slate-400">Scale:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={cardScale}
              onChange={(e) => setCardScale(parseFloat(e.target.value))}
              className="card-scale-slider"
            />
            <span className="card-scale-value">{cardScale.toFixed(1)}x</span>
          </div>

          {/* Reload Button */}
          <button
            onClick={onReloadAll}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition-colors"
            title="Reload all NOTAMs"
          >
            <i className="fa fa-refresh"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
