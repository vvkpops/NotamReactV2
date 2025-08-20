import React from 'react';
import { 
  getNotamType, 
  getHeadClass, 
  getHeadTitle, 
  extractRunways, 
  needsExpansion,
  isNotamCurrent,
  isNotamFuture,
  getClassificationTitle,
  isNewNotam
} from '../utils/notamUtils';

const NotamCard = ({
  notam,
  cardKey,
  expanded,
  cardScale,
  onCardClick
}) => {
  const type = getNotamType(notam);
  const headClass = getHeadClass(notam);
  const headTitle = getHeadTitle(notam);
  const runways = type === "rwy" ? extractRunways(notam.summary + " " + notam.body) : "";
  
  // VANILLA JS APPROACH - Pass cardScale to needsExpansion
  const needsToExpand = needsExpansion(notam.summary, notam.body, cardScale);
  
  const timeStatus = isNotamCurrent(notam) ? "Current" : isNotamFuture(notam) ? "Future" : "";
  
  // VANILLA JS APPROACH - Simple new NOTAM detection
  const isNew = isNewNotam(notam);

  // Head color styles
  const headColorStyles = {
    'head-rwy': { backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#fca5a5' },
    'head-twy': { backgroundColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' },
    'head-rsc': { backgroundColor: 'rgba(16, 185, 129, 0.4)', color: '#6ee7b7' },
    'head-crfi': { backgroundColor: 'rgba(139, 92, 246, 0.4)', color: '#c4b5fd' },
    'head-ils': { backgroundColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' },
    'head-fuel': { backgroundColor: 'rgba(236, 72, 153, 0.4)', color: '#f9a8d4' },
    'head-cancelled': { backgroundColor: 'rgba(107, 114, 128, 0.4)', color: '#d1d5db' },
    'head-other': { backgroundColor: 'rgba(75, 85, 99, 0.4)', color: '#d1d5db' }
  };

  // Time status styles
  const timeStatusStyles = {
    current: { backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' },
    future: { backgroundColor: 'rgba(251, 191, 36, 0.3)', color: '#fde68a' }
  };

  const cardStyles = {
    position: 'relative',
    height: needsToExpand && !expanded ? '280px' : 'auto',
    overflow: expanded ? 'visible' : 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease, height 0.3s ease',
    background: 'rgba(30, 41, 59, 0.6)',
    backdropFilter: 'blur(10px)',
    border: isNew ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(148, 163, 184, 0.1)',
    borderRadius: '12px',
    boxShadow: isNew ? '0 0 15px rgba(236, 72, 153, 0.4)' : '0 8px 32px rgba(0, 0, 0, 0.3)',
    transform: `scale(${cardScale})`,
    transformOrigin: 'top left',
    marginBottom: `${(cardScale - 1) * 280}px`,
    marginRight: `${(cardScale - 1) * 320}px`,
    cursor: needsToExpand ? 'pointer' : 'default'
  };

  const handleCardClick = () => {
    if (needsToExpand) {
      onCardClick(cardKey, notam);
    }
  };

  const handleExpandClick = (e) => {
    e.stopPropagation();
    onCardClick(cardKey, notam);
  };

  return (
    <div
      className={`notam-card notam-animate ${type} ${expanded ? 'expanded-card' : ''} ${!needsToExpand ? 'auto-sized' : ''} ${isNew ? 'new-notam-highlight' : ''}`}
      id={`notam-${cardKey}`}
      onClick={handleCardClick}
      style={cardStyles}
    >
      <div 
        className={`card-head ${headClass}`} 
        style={{
          padding: '0.75rem',
          fontSize: '1.1rem',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...headColorStyles[headClass]
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
          <span>{headTitle}</span>
          <div style={{display: 'flex', alignItems: 'center'}}>
            {timeStatus && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '0.15rem 0.5rem',
                borderRadius: '0.25rem',
                marginRight: '0.5rem',
                ...timeStatusStyles[timeStatus.toLowerCase()]
              }}>
                {timeStatus}
              </span>
            )}
            {type === 'rwy' && runways ? 
              <span style={{marginLeft: '1rem', fontSize: '1.125rem', fontWeight: '800', letterSpacing: '0.1em'}}>
                {runways}
              </span> : 
              notam.qLine ? 
                <span style={{marginLeft: '1rem', fontFamily: 'Courier New, monospace', fontSize: '0.75rem', color: '#94a3b8'}}>
                  {notam.qLine}
                </span> : ""
            }
          </div>
        </div>
      </div>
      
      <div className="notam-card-content" style={{
        padding: '0.75rem',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        <div className="notam-head" style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          color: '#fbbf24',
          marginBottom: '0.5rem'
        }}>
          {notam.number || ""} 
          <span style={{fontSize: '1rem', fontWeight: 'normal', color: '#67e8f9', marginLeft: '0.5rem'}}>
            {notam.icao || ""}
          </span>
          {isNew && (
            <span style={{
              backgroundColor: 'rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              padding: '0.1rem 0.4rem',
              borderRadius: '0.25rem',
              marginLeft: '0.5rem',
              animation: 'pulse 2s infinite'
            }}>
              NEW
            </span>
          )}
        </div>
        
        <div className="notam-meta" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          marginBottom: '0.75rem',
          fontSize: '0.875rem',
          color: '#94a3b8'
        }}>
          <span><b>Type:</b> {notam.type || ""}</span>
          <span><b>Class:</b> {getClassificationTitle(notam.classification)}</span>
          <span>
            <b>Valid:</b> {notam.validFrom?.replace('T', ' ').slice(0,16)} → {notam.validTo?.replace('T', ' ').slice(0,16)}
          </span>
        </div>
        
        {/* Only show summary content - no raw content duplication */}
        <div 
          className={expanded || !needsToExpand ? "notam-full-text" : "notam-summary"} 
          style={{
            flex: 1,
            fontSize: '0.875rem',
            lineHeight: 1.4,
            color: '#e2e8f0',
            overflow: expanded || !needsToExpand ? 'visible' : 'hidden',
            maxHeight: expanded || !needsToExpand ? 'none' : undefined,
            display: expanded || !needsToExpand ? 'block' : '-webkit-box',
            WebkitLineClamp: expanded || !needsToExpand ? 'none' : 6,
            WebkitBoxOrient: expanded || !needsToExpand ? 'initial' : 'vertical'
          }}
          dangerouslySetInnerHTML={{ __html: notam.summary ? notam.summary.replace(/\n/g, '<br>') : "" }} 
        />
        
        {needsToExpand && (
          <button 
            onClick={handleExpandClick}
            style={{
              position: 'absolute',
              bottom: '0.5rem',
              right: '0.5rem',
              background: 'rgba(6, 182, 212, 0.8)',
              border: 'none',
              borderRadius: '50%',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.875rem'
            }}
            onMouseOver={(e) => {
              e.target.style.background = '#06b6d4';
              e.target.style.transform = 'scale(1.1)';
            }}
            onMouseOut={(e) => {
              e.target.style.background = 'rgba(6, 182, 212, 0.8)';
              e.target.style.transform = 'scale(1)';
            }}
            title={expanded ? 'Hide details' : 'Show details'}
          >
            <i className={`fa fa-angle-${expanded ? "up" : "down"}`}></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default NotamCard;
