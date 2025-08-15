import React from 'react';

const IcaoInput = ({ 
  icaoInput, 
  setIcaoInput, 
  icaoSet, 
  icaoListExpanded, 
  setIcaoListExpanded,
  onSubmit, 
  onRemoveIcao 
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!icaoInput.trim()) return;

    const icaos = icaoInput
      .toUpperCase()
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s.length === 4 && /^[A-Z]{4}$/.test(s));

    if (icaos.length > 0) {
      onSubmit(icaos);
      setIcaoInput('');
    }
  };

  return (
    <div className="glass" style={{padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem'}}>
      <form onSubmit={handleSubmit} style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', width: '100%'}}>
        <input
          value={icaoInput}
          onChange={(e) => setIcaoInput(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            background: '#21263b',
            border: '1px solid #283057',
            fontSize: '1.125rem',
            outline: 'none',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            width: '224px',
            textTransform: 'uppercase',
            color: '#e2e8f0'
          }}
          maxLength="60"
          placeholder="ICAO (comma separated)"
          spellCheck="false"
          onFocus={(e) => e.target.style.borderColor = '#67e8f9'}
          onBlur={(e) => e.target.style.borderColor = '#283057'}
        />
        <button
          type="submit"
          style={{
            background: '#06b6d4',
            color: '#131926',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
          }}
          onMouseOver={(e) => e.target.style.background = '#22d3ee'}
          onMouseOut={(e) => e.target.style.background = '#06b6d4'}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setIcaoListExpanded(!icaoListExpanded)}
          style={{
            marginLeft: 'auto',
            fontSize: '1.3em',
            padding: '0.1em 0.9em',
            borderRadius: '1em',
            background: '#18213b',
            color: '#67e8f9',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {icaoListExpanded ? '⬆' : '⬈'}
        </button>
      </form>
      {icaoListExpanded && (
        <div style={{width: '100%'}}>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem'}}>
            {icaoSet.map(icao => (
              <div key={icao} className="icao-chip">
                {icao}
                <span className="remove-btn" onClick={() => onRemoveIcao(icao)}>×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IcaoInput;
