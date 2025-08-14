import React from 'react';

const IcaoSetsModal = ({ 
  showIcaoSetsModal, 
  setShowIcaoSetsModal, 
  newSetName, 
  setNewSetName, 
  createIcaoSet, 
  icaoSets, 
  deleteIcaoSet, 
  loadIcaoSet, 
  icaoSet 
}) => {
  if (!showIcaoSetsModal) return null;
  
  return (
    <div 
      style={{
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
      }}
    >
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
            onClick={() => setShowIcaoSetsModal(false)}
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
                color: '#e5e7eb',
                flex: 1
              }}
            />
            <button
              onClick={createIcaoSet}
              disabled={!newSetName.trim() || icaoSet.length === 0}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: newSetName.trim() && icaoSet.length > 0 ? '#059669' : '#374151',
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
                      loadIcaoSet(set.icaos);
                      setShowIcaoSetsModal(false);
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
                    onClick={() => deleteIcaoSet(index)}
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

export default IcaoSetsModal;