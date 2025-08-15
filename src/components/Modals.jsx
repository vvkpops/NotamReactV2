import React from 'react';

export const RawNotamModal = ({ show, title, content, onClose }) => {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
        onClick={onClose}
      ></div>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        width: '80%',
        maxWidth: '800px',
        maxHeight: '80%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        animation: 'modalOpen 0.3s',
        zIndex: 1
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: '#172030',
          borderBottom: '1px solid #334155'
        }}>
          <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{title}</span>
          <button 
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.5rem',
              lineHeight: 1
            }}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <pre 
          className="scrollbar"
          style={{
            padding: '16px',
            overflowY: 'auto',
            flexGrow: 1,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            fontSize: '0.9rem',
            color: '#d1d5db',
            margin: 0
          }}
        >
          {content}
        </pre>
      </div>
    </div>
  );
};

export const IcaoSetsModal = ({ 
  show, 
  onClose, 
  icaoSets, 
  newSetName, 
  setNewSetName, 
  icaoSet,
  onCreateSet, 
  onLoadSet, 
  onDeleteSet 
}) => {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div 
        className="glass"
        style={{
          width: '90%',
          maxWidth: '600px',
          maxHeight: '80%',
          padding: '24px',
          overflow: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#67e8f9' }}>ICAO Sets</h3>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '1.5rem'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Create New Set</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Set name"
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #374151',
                backgroundColor: '#1f2937',
                color: '#fff',
                cursor: newSetName.trim() && icaoSet.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Create
            </button>
          </div>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '5px' }}>
            Current ICAOs: {icaoSet.join(', ')}
          </div>
        </div>
        
        <div>
          <h4 style={{ fontWeight: 'bold', marginBottom: '10px' }}>Saved Sets</h4>
          {icaoSets.length === 0 ? (
            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px' }}>
              No saved sets
            </div>
          ) : (
            icaoSets.map((set, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  marginBottom: '8px',
                  backgroundColor: 'rgba(55, 65, 81, 0.5)',
                  borderRadius: '6px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold' }}>{set.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                    {set.icaos.join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      onLoadSet(set.icaos);
                      onClose();
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#3b82f6',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => onDeleteSet(index)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: '#dc2626',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const SaveSetModal = ({ show, onClose, onSave }) => {
  if (!show) return null;

  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 1100,
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div 
        className="glass"
        style={{
          width: '90%',
          maxWidth: '450px',
          padding: '24px',
          borderRadius: '8px',
          animation: 'modalOpen 0.3s ease'
        }}
      >
        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#67e8f9', marginBottom: '16px', textAlign: 'center' }}>
          Save Current ICAO Set?
        </h3>
        <p style={{ marginBottom: '20px', textAlign: 'center', color: '#e2e8f0' }}>
          Do you want to save the current ICAO set before creating a new one?
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            onClick={() => onSave(true)}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#059669',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          >
            YES
          </button>
          <button
            onClick={() => onSave(false)}
            style={{
              padding: '10px 24px',
              borderRadius: '6px',
              border: '1px solid #475569',
              backgroundColor: '#1e293b',
              color: '#e2e8f0',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
          >
            NO
          </button>
        </div>
      </div>
    </div>
  );
};e5e7eb',
                flex: 1
              }}
            />
            <button
              onClick={onCreateSet}
              disabled={!newSetName.trim() || icaoSet.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: newSetName.trim() && icaoSet.length > 0 ? '#059669' : '#374151',
                color: '#
