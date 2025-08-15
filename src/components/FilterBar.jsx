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
  return (
    <div className="glass" style={{
      padding: '0.75rem', 
      marginBottom: '1rem', 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '1rem', 
      alignItems: 'center', 
      justifyContent: 'space-between'
    }}>
      <div className="filter-chips">
        {Object.entries(FILTER_LABELS).map(([key, label]) => (
          <label
            key={key}
            className={`filter-chip filter-chip-${key} ${filters[key] ? 'active' : ''}`}
            onClick={() => onFilterChange(key)}
          >
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem'}}>
        <div className="card-scale-wrap">
          <span style={{ color: '#06b6d4', fontWeight: 'bold' }}>Card Size</span>
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
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '0.5rem',
            background: '#21263b',
            border: '1px solid #283057',
            fontSize: '1rem',
            fontFamily: 'monospace',
            width: '144px',
            color: '#e2e8f0'
          }}
          placeholder="Keyword"
          value={keywordFilter}
          onChange={(e) => setKeywordFilter(e.target.value)}
          onFocus={(e) => e.target.style.borderColor = '#67e8f9'}
          onBlur={(e) => e.target.style.borderColor = '#283057'}
        />
        <button
          type="button"
          onClick={onReloadAll}
          style={{
            marginLeft: '0.75rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.5rem',
            background: '#2a3352',
            color: '#67e8f9',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
          onMouseOut={(e) => e.target.style.background = '#2a3352'}
        >
          <i className="fa-solid fa-arrows-rotate"></i> Reload
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
