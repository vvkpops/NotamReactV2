import React from 'react';

const ProgressBar = ({ 
  loadedCount, 
  totalIcaos, 
  loadingCount, 
  queuedCount, 
  autoRefreshCountdown 
}) => {
  const progressPercent = totalIcaos > 0 ? (loadedCount / totalIcaos) * 100 : 0;

  return (
    <div style={{
      background: 'rgba(30, 41, 59, 0.6)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(148, 163, 184, 0.1)',
      borderRadius: '12px',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{fontWeight: 'bold', color: '#06b6d4', marginBottom: '0.5rem'}}>
        ICAO Load Progress
      </div>
      <div style={{
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        height: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          background: 'linear-gradient(90deg, #06b6d4, #0891b2)',
          height: '100%',
          borderRadius: '8px',
          transition: 'width 0.3s ease',
          width: `${progressPercent}%`
        }}></div>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '0.8rem',
          fontWeight: 'bold',
          color: '#e2e8f0',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)'
        }}>
          {loadedCount} / {totalIcaos} loaded
          {loadingCount > 0 && ` (${loadingCount} loading...)`}
          {queuedCount > 0 && ` (${queuedCount} queued)`}
        </div>
      </div>
      <div style={{
        textAlign: 'center',
        marginTop: '0.5rem',
        fontSize: '0.85rem',
        color: '#94a3b8'
      }}>
        Auto refresh in {Math.floor(autoRefreshCountdown / 60)}:{(autoRefreshCountdown % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
};

export default ProgressBar;
