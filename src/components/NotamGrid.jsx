// src/components/NotamGrid.jsx
import React from 'react';
import NotamCard from './NotamCard';
import { 
  applyNotamFilters, 
  sortNotams
} from '../utils/notamUtils';

const NotamGrid = ({
  tabMode,
  notamDataByIcao,
  filters,
  keywordFilter,
  expandedCardKey,
  cardScale,
  onCardClick,
  isNotamHighlighted
}) => {
  
  const getFilteredNotams = () => {
    let allNotams = [];
    
    if (tabMode === "ALL") {
      // Show all NOTAMs grouped by ICAO
      let icaoGroups = {};
      Object.entries(notamDataByIcao).forEach(([icao, notams]) => {
        if (Array.isArray(notams) && notams.length > 0) {
          icaoGroups[icao] = notams.map(n => ({ ...n, icao }));
        }
      });
      
      const sortedIcaos = Object.keys(icaoGroups).sort();
      
      sortedIcaos.forEach(icao => {
        const notamsForIcao = [...icaoGroups[icao]];
        
        const filteredNotamsForIcao = applyNotamFilters(
          notamsForIcao, 
          filters, 
          keywordFilter
        );
        
        if (filteredNotamsForIcao.length > 0) {
          const sortedNotams = sortNotams(filteredNotamsForIcao, 'priority');
          
          // Add ICAO header
          allNotams.push({ 
            isIcaoHeader: true, 
            icao,
            count: filteredNotamsForIcao.length
          });
          
          allNotams = [...allNotams, ...sortedNotams];
        }
      });
      
      return allNotams;
    } 
    else {
      // Show NOTAMs for specific ICAO
      const notams = notamDataByIcao[tabMode];
      if (Array.isArray(notams)) {
        const notamsWithIcao = notams.map(n => ({ ...n, icao: tabMode }));
        const filtered = applyNotamFilters(notamsWithIcao, filters, keywordFilter);
        return sortNotams(filtered, 'priority');
      }
      return [];
    }
  };

  const renderNotamCard = (notam, index) => {
    if (notam.isIcaoHeader) {
      return (
        <div 
          key={`header-${notam.icao}`} 
          className="glass icao-header-card" 
          style={{
            gridColumn: '1 / -1', 
            margin: '10px 0 5px 0',
            background: 'rgba(30, 41, 59, 0.8)',
            borderBottom: '2px solid #0891b2'
          }}
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
    
    const key = (notam.id || notam.number || notam.qLine || notam.summary || "").replace(/[^a-zA-Z0-9_-]/g,'');
    const cardKey = `${notam.icao}-${key}-${index}`;
    const expanded = expandedCardKey === cardKey;
    
    // Check if this NOTAM should be highlighted
    const isHighlighted = isNotamHighlighted ? isNotamHighlighted(notam.icao, notam) : false;

    return (
      <NotamCard
        key={cardKey}
        notam={notam}
        cardKey={cardKey}
        expanded={expanded}
        cardScale={cardScale}
        onCardClick={onCardClick}
        isHighlighted={isHighlighted}
      />
    );
  };

  const filteredNotams = getFilteredNotams();

  return (
    <div id="result">
      {filteredNotams.length > 0 ? (
        <div 
          className="notam-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
            marginTop: '1rem'
          }}
        >
          {filteredNotams.map((notam, index) => renderNotamCard(notam, index))}
        </div>
      ) : (
        <div className="glass p-8 rounded-lg text-center text-base text-slate-400">
          {Object.keys(notamDataByIcao).length === 0 
            ? "Add some ICAO codes above to get started"
            : "No NOTAMs found matching current filters"
          }
        </div>
      )}
    </div>
  );
};

export default NotamGrid;
