import React from 'react';
import {
  getNotamType,
  getHeadClass,
  getHeadTitle,
  extractRunways,
  needsExpansion,
  getNotamRemainingTime,
  getClassificationTitle,
  isNotamCurrent,
  isNotamFuture
} from '../utils/NotamUtils';

const NotamCard = ({ 
  notam, 
  expandedCardKey, 
  handleCardClick, 
  isNewNotam, 
  markNotamAsViewed,
  notamExpirationTimes,
  showRawNotamModal,
  cardScale
}) => {
  // If it's an ICAO header in ALL tab, render a header instead
  if (notam.isIcaoHeader) {
    return (
      <div 
        key={`header-${notam.icao}`} 
        className="glass icao-header-card" 
        style={{gridColumn: '1 / -1', margin: '10px 0 5px 0'}}
      >
        <h3 className="text-xl font-bold text-cyan-300 p-3">
          {notam.icao} 
          <span className="text-base font-normal text-slate-300 ml-2">
            ({notam.count} NOTAMs)
          </span>
        </h3>
      </div>
    );
  }
  
  const type = getNotamType(notam);
  const headClass = getHeadClass(notam);
  const headTitle = getHeadTitle(notam);
  const key = (notam.id || notam.number || notam.qLine || notam.summary || "").replace(/[^a-zA-Z0-9_-]/g,'');
  const runways = type === "rwy" ? extractRunways(notam.summary + " " + notam.body) : "";
  const expanded = expandedCardKey === key;
  const needsToExpand = needsExpansion(notam.summary);
  const isNew = isNewNotam(notam);
  const timeStatus = isNotamCurrent(notam) ? "Current" : isNotamFuture(notam) ? "Future" : "";
  const remainingTime = isNew ? getNotamRemainingTime(notam, notamExpirationTimes) : 0;

  return (
    <div
      key={key}
      className={`glass notam-card notam-animate ${type} ${expanded ? 'expanded-card' : ''} ${!needsToExpand ? 'auto-sized' : ''} ${isNew ? 'new-notam-highlight' : ''}`}
      id={`notam-${key}`}
      onClick={() => {
        if (needsToExpand) {
          handleCardClick(key, notam);
        } else if (isNew) {
          // Even if not expanding, still mark as viewed when clicked
          markNotamAsViewed(notam);
        }
      }}
      style={{
        transform: `scale(${cardScale})`,
        transformOrigin: 'top left',
        marginBottom: `${(cardScale - 1) * 280}px`,
        marginRight: `${(cardScale - 1) * 320}px`
      }}
    >
      <div className={`card-head ${headClass}`}>
        <div className="flex justify-between items-center w-full">
          <span>{headTitle}</span>
          <div className="flex items-center">
            {timeStatus && (
              <span className={`time-status ${timeStatus.toLowerCase()}`}>
                {timeStatus}
              </span>
            )}
            {type === 'rwy' && runways ? 
              <span className="ml-4 text-lg font-extrabold tracking-widest">{runways}</span> : 
              notam.qLine ? <span className="qline ml-4">{notam.qLine}</span> : ""
            }
          </div>
        </div>
      </div>
      
      <div className="notam-card-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div className="notam-head">
            {notam.number || ""} 
            <span className="text-base font-normal text-cyan-300 ml-2">{notam.icao || ""}</span>
            {isNew && (
              <span className="new-notam-badge ml-2">
                NEW {remainingTime > 0 && `(${remainingTime}s)`}
              </span>
            )}
          </div>
          <a 
            href="#" 
            className="notam-raw-link" 
            title="View raw NOTAM"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              showRawNotamModal(notam);
            }}
          >
            RAW
          </a>
        </div>
        
        <div className="notam-meta">
          <span><b>Type:</b> {notam.type || ""}</span>
          <span><b>Class:</b> {getClassificationTitle(notam.classification)}</span>
          <span><b>Valid:</b> {notam.validFrom?.replace('T', ' ').slice(0,16)} → {notam.validTo?.replace('T', ' ').slice(0,16)}</span>
        </div>
        
        {expanded || !needsToExpand ? 
          <div className="notam-full-text">
            {notam.summary ? (
              <div dangerouslySetInnerHTML={{ __html: notam.summary.replace(/\n/g, '<br>') }} />
            ) : ""}
          </div>
          : 
          <div 
            className="notam-summary" 
            dangerouslySetInnerHTML={{ __html: notam.summary ? notam.summary.replace(/\n/g, '<br>') : "" }} 
          />
        }
        
        {needsToExpand && (
          <button 
            className="card-expand-btn" 
            title={expanded ? 'Hide details' : 'Show details'}
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick(key, notam);
            }}
          >
            <i className={`fa fa-angle-${expanded ? "up" : "down"}`}></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default NotamCard;