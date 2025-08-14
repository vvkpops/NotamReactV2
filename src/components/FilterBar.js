import React from 'react';

const FilterBar = ({ filters, handleFilterChange, keywordFilter, setKeywordFilter, cardScale, setCardScale, handleReloadAll }) => {
  return (
    <div className="glass px-3 py-2 mb-4 flex flex-wrap gap-4 items-center justify-between">
      <div className="filter-chips flex flex-wrap items-center gap-2">
        {Object.entries({
          rwy: 'RWY Closure',
          twy: 'TWY Closure', 
          rsc: 'RSC',
          crfi: 'CRFI',
          ils: 'ILS',
          fuel: 'FUEL',
          other: 'Other',
          cancelled: 'Cancelled',
          dom: 'DOM',
          current: 'Current',
          future: 'Future'
        }).map(([key, label]) => (
          <label
            key={key}
            className={`filter-chip filter-chip-${key} ${filters[key] ? 'active' : ''}`}
            onClick={() => handleFilterChange(key)}
          >
            <span className="filter-chip-label">{label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0">
        <div className="card-scale-wrap">
          <span style={{ color: '#0ff', fontWeight: 'bold' }}>Card Size</span>
          <input
            className="card-scale-slider"
            type="range"
            min="0.5"
            max="1.5"
            step="0.01"
            value={cardScale}
            onChange={(e) => setCardScale(parseFloat(e.target.value))}
          />
          <span className="card-scale-value">{cardScale.toFixed(2)}x</span>
        </div>
        <input
          type="text"
          className="px-3 py-1 rounded-lg bg-[#21263b] border border-[#283057] text-base font-mono w-36"
          placeholder="Keyword"
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
        />
        <button
          type="button"
          onClick={handleReloadAll}
          className="ml-3 px-3 py-1 rounded-lg bg-[#2a3352] text-cyan-300 hover:bg-cyan-950 shadow"
        >
          <i className="fa-solid fa-arrows-rotate"></i> Reload
        </button>
      </div>
    </div>
  );
};

export default FilterBar;