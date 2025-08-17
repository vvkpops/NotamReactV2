import React from 'react';

// Raw NOTAM Modal Component
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
