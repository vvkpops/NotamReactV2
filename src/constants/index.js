export const ICAO_CLASSIFICATION_MAP = {
  AA: "Aerodrome",
  RW: "Runway", 
  TW: "Taxiway",
  AB: "Obstacle",
  AC: "Communications",
  AD: "Navigation Aid",
  AE: "Airspace Restriction",
  AO: "Other",
  GP: "GPS",
  NAV: "Navigation",
  COM: "Communication",
  SVC: "Service",
  DOM: "Domestic",
  INTL: "International",
  MISC: "Miscellaneous",
  SEC: "Security",
  FDC: "Flight Data Center",
  SAA: "Special Activity Airspace"
};

export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
export const ICAO_BATCH_SIZE = 10;
export const ICAO_BATCH_INTERVAL_MS = 65000;
export const ICAO_BATCH_CALL_LIMIT = 30;
export const NEW_NOTAM_HIGHLIGHT_DURATION_MS = 60 * 1000;

export const NOTAM_TYPES = {
  rwy: 'RUNWAY CLOSURE',
  twy: 'TAXIWAY CLOSURE', 
  rsc: 'RUNWAY CONDITIONS',
  crfi: 'FRICTION INDEX',
  ils: 'ILS/NAV AID',
  fuel: 'FUEL SERVICES',
  cancelled: 'CANCELLED',
  other: 'GENERAL NOTAM'
};

export const HEAD_COLOR_STYLES = {
  'head-rwy': { backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#fca5a5' },
  'head-twy': { backgroundColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' },
  'head-rsc': { backgroundColor: 'rgba(16, 185, 129, 0.4)', color: '#6ee7b7' },
  'head-crfi': { backgroundColor: 'rgba(139, 92, 246, 0.4)', color: '#c4b5fd' },
  'head-ils': { backgroundColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' },
  'head-fuel': { backgroundColor: 'rgba(236, 72, 153, 0.4)', color: '#f9a8d4' },
  'head-cancelled': { backgroundColor: 'rgba(107, 114, 128, 0.4)', color: '#d1d5db' },
  'head-other': { backgroundColor: 'rgba(75, 85, 99, 0.4)', color: '#d1d5db' }
};

export const TIME_STATUS_STYLES = {
  current: { backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' },
  future: { backgroundColor: 'rgba(251, 191, 36, 0.3)', color: '#fde68a' }
};

export const FILTER_LABELS = {
  rwy: 'RWY Closure',
  twy: 'TWY Closure', 
  rsc: 'RSC',
  crfi: 'CRFI',
  ils: 'ILS',
  fuel: 'FUEL',
  other: 'Other',
  cancelled: 'Cancelled',
  dom: 'DOM',
  current: 'Current',
  future: 'Future'
};
