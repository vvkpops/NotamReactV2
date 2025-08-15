import React from 'react';

const IcaoSetsBar = ({ 
  icaoSets, 
  onShowSetsModal, 
  onNewSetClick, 
  onLoadSet 
}) => {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={onShowSetsModal}
          className="glass"
          style={{ 
            padding: '0.25rem 0.75rem', 
            borderRadius: '0.5rem', 
            color: '#67e8f9', 
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.875rem'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(30, 41, 59, 0.6)'}
        >
          <i className="fa fa-bookmark" style={{marginRight: '0.25rem'}}></i>
          ICAO Sets
        </button>
        <button
          onClick={onNewSetClick}
          className="glass"
          style={{ 
            padding: '0.25rem 0.75rem', 
            borderRadius: '0.5rem', 
            color: '#86efac', 
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.1)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '0.875rem'
          }}
          onMouseOver={(e) => e.target.style.background = 'rgba(34, 197, 94, 0.1)'}
          onMouseOut={(e) => e.target.style.background = 'rgba(30, 41, 59, 0.6)'}
        >
          <i className="fa fa-plus" style={{marginRight: '0.25rem'}}></i>
          New Set
        </button>
        {icaoSets.slice(0, 5).map((set, index) => (
          <button
            key={index}
            onClick={() => onLoadSet(set.icaos)}
            className="glass"
            style={{
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              color: '#cbd5e1',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.color = '#67e8f9'}
            onMouseOut={(e) => e.target.style.color = '#cbd5e1'}
            title={`Load: ${set.icaos.join(', ')}`}
          >
            {set.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default IcaoSetsBar;
