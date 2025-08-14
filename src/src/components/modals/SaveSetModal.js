import React from 'react';

const SaveSetModal = ({ showSaveSetModal, handleSaveSetResponse, saveSetModalRef }) => {
  if (!showSaveSetModal) return null;
  
  return (
    <div 
      style={{
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
      }}
    >
      <div 
        ref={saveSetModalRef}
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
            onClick={() => handleSaveSetResponse(true)}
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
            onClick={() => handleSaveSetResponse(false)}
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
};

export default SaveSetModal;