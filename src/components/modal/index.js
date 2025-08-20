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
      zIndex: 10000,
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
        zIndex: 10001
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

// ICAO Raw NOTAMs Modal Component - UPDATED for ALL tab support
export const IcaoRawModal = ({ show, tabMode, notamDataByIcao, onClose }) => {
  if (!show) return null;

  const formatRawContent = () => {
    if (!notamDataByIcao || Object.keys(notamDataByIcao).length === 0) {
      return `No NOTAMs available`;
    }

    if (tabMode === "ALL") {
      // Show all NOTAMs grouped by ICAO
      const icaos = Object.keys(notamDataByIcao).sort();
      return icaos.map(icao => {
        const notams = notamDataByIcao[icao] || [];
        if (notams.length === 0) return '';
        
        let content = `\n${'='.repeat(60)}\n`;
        content += `                    ${icao} NOTAMs (${notams.length})\n`;
        content += `${'='.repeat(60)}\n\n`;
        
        notams.forEach((notam, index) => {
          content += `--- NOTAM ${index + 1} ---\n`;
          content += `Number: ${notam.number || 'N/A'}\n`;
          content += `Type: ${notam.type || 'N/A'}\n`;
          content += `Classification: ${notam.classification || 'N/A'}\n`;
          content += `Valid From: ${notam.validFrom || 'N/A'}\n`;
          content += `Valid To: ${notam.validTo || 'N/A'}\n`;
          content += `Issued: ${notam.issued || 'N/A'}\n\n`;
          
          if (notam.qLine) {
            content += `Q-Line:\n${notam.qLine}\n\n`;
          }
          
          if (notam.summary) {
            content += `Summary:\n${notam.summary}\n\n`;
          }
          
          if (notam.body && notam.body !== notam.summary) {
            content += `Full Text:\n${notam.body}\n\n`;
          }
          
          content += `${'-'.repeat(40)}\n\n`;
        });
        
        return content;
      }).join('\n');
    } else {
      // Show NOTAMs for specific ICAO
      const notams = notamDataByIcao[tabMode] || [];
      if (notams.length === 0) {
        return `No NOTAMs available for ${tabMode}`;
      }

      return notams.map((notam, index) => {
        let content = `=== NOTAM ${index + 1} ===\n`;
        content += `Number: ${notam.number || 'N/A'}\n`;
        content += `ICAO: ${notam.icao || tabMode}\n`;
        content += `Type: ${notam.type || 'N/A'}\n`;
        content += `Classification: ${notam.classification || 'N/A'}\n`;
        content += `Valid From: ${notam.validFrom || 'N/A'}\n`;
        content += `Valid To: ${notam.validTo || 'N/A'}\n`;
        content += `Issued: ${notam.issued || 'N/A'}\n\n`;
        
        if (notam.qLine) {
          content += `Q-Line:\n${notam.qLine}\n\n`;
        }
        
        if (notam.summary) {
          content += `Summary:\n${notam.summary}\n\n`;
        }
        
        if (notam.body && notam.body !== notam.summary) {
          content += `Full Text:\n${notam.body}\n\n`;
        }
        
        content += `${'='.repeat(50)}\n\n`;
        return content;
      }).join('');
    }
  };

  const getTitle = () => {
    if (tabMode === "ALL") {
      const totalNotams = Object.values(notamDataByIcao).reduce((sum, notams) => 
        sum + (Array.isArray(notams) ? notams.length : 0), 0
      );
      const icaoCount = Object.keys(notamDataByIcao).filter(icao => 
        Array.isArray(notamDataByIcao[icao]) && notamDataByIcao[icao].length > 0
      ).length;
      return `Raw NOTAMs for All ICAOs (${icaoCount} ICAOs, ${totalNotams} NOTAMs)`;
    } else {
      const notams = notamDataByIcao[tabMode] || [];
      return `Raw NOTAMs for ${tabMode} (${notams.length} NOTAMs)`;
    }
  };

  return (
    <div style={{
      display: 'flex',
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: 10000,
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
        width: '90%',
        maxWidth: '1000px',
        maxHeight: '85%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        animation: 'modalOpen 0.3s',
        zIndex: 10001
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          backgroundColor: '#172030',
          borderBottom: '1px solid #334155'
        }}>
          <div>
            <span style={{ fontWeight: 'bold', color: '#67e8f9', fontSize: '1.2rem' }}>
              {getTitle()}
            </span>
          </div>
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
            fontSize: '0.85rem',
            color: '#d1d5db',
            margin: 0,
            lineHeight: '1.4'
          }}
        >
          {formatRawContent()}
        </pre>
      </div>
    </div>
  );
};

// ICAO Sets Modal Component
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
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose}
      />
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(148, 163, 184, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        zIndex: 9999
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #475569' }}>
          <h3 className="text-xl font-bold text-cyan-300 mb-4">ICAO Sets</h3>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Set name"
              className="flex-1 px-3 py-2 rounded bg-[#21263b] border border-[#283057] text-white"
              onKeyPress={(e) => e.key === 'Enter' && onCreateSet()}
            />
            <button
              onClick={onCreateSet}
              disabled={!newSetName.trim() || icaoSet.length === 0}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              Save Current Set ({icaoSet.length})
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {icaoSets.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No saved ICAO sets</p>
          ) : (
            <div className="space-y-2">
              {icaoSets.map((set, index) => (
                <div key={index} className="glass p-3 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-cyan-300">{set.name}</div>
                    <div className="text-sm text-slate-400">
                      {set.icaos.join(', ')} ({set.icaos.length} ICAOs)
                    </div>
                    <div className="text-xs text-slate-500">
                      Created: {new Date(set.created).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoadSet(set.icaos)}
                      className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => onDeleteSet(index)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ padding: '1rem', borderTop: '1px solid #475569' }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};

// Save Set Modal Component
export const SaveSetModal = ({ show, onClose, onSave }) => {
  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10998
        }}
        onClick={() => onSave(false)}
      />
      
      {/* Modal */}
      <div 
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '450px',
          padding: '24px',
          borderRadius: '8px',
          animation: 'modalOpen 0.3s ease',
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 10999
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
    </>
  );
};

// Export individual components
export default {
  RawNotamModal,
  IcaoRawModal,
  IcaoSetsModal,
  SaveSetModal
};
