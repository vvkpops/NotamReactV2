// Storage keys
const STORAGE_KEYS = {
  ICAO_SETS: 'icaoSets',
  SAVED_ICAOS: 'notamIcaos',
  NOTAM_DATA_CACHE: 'notamDataCache',
  LAST_NOTAM_IDS_CACHE: 'lastNotamIdsCache',
  CACHE_TIMESTAMP: 'notamCacheTimestamp',
  USER_PREFERENCES: 'notamUserPreferences'
};

// Safe localStorage operations with error handling
const safeStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
      return false;
    }
  }
};

// ICAO Sets management
export const getIcaoSets = () => {
  return safeStorage.get(STORAGE_KEYS.ICAO_SETS, []);
};

export const saveIcaoSets = (sets) => {
  return safeStorage.set(STORAGE_KEYS.ICAO_SETS, sets);
};

export const addIcaoSet = (name, icaos) => {
  const sets = getIcaoSets();
  const newSet = {
    id: Date.now(),
    name: name.trim(),
    icaos: [...icaos],
    created: new Date().toISOString(),
    lastUsed: new Date().toISOString()
  };
  sets.push(newSet);
  saveIcaoSets(sets);
  return newSet;
};

export const updateIcaoSet = (id, updates) => {
  const sets = getIcaoSets();
  const index = sets.findIndex(set => set.id === id);
  if (index !== -1) {
    sets[index] = { ...sets[index], ...updates, lastUsed: new Date().toISOString() };
    saveIcaoSets(sets);
    return sets[index];
  }
  return null;
};

export const deleteIcaoSet = (id) => {
  const sets = getIcaoSets();
  const filteredSets = sets.filter(set => set.id !== id);
  saveIcaoSets(filteredSets);
  return filteredSets;
};

// ICAO management
export const getSavedIcaos = () => {
  return safeStorage.get(STORAGE_KEYS.SAVED_ICAOS, []);
};

export const saveIcaos = (icaos) => {
  return safeStorage.set(STORAGE_KEYS.SAVED_ICAOS, icaos);
};

export const addIcao = (icao) => {
  const saved = getSavedIcaos();
  if (!saved.includes(icao)) {
    saved.push(icao);
    saveIcaos(saved);
  }
  return saved;
};

export const removeIcao = (icao) => {
  const saved = getSavedIcaos();
  const filtered = saved.filter(i => i !== icao);
  saveIcaos(filtered);
  return filtered;
};

// NOTAM data caching
export const getCachedNotamData = () => {
  const notamData = safeStorage.get(STORAGE_KEYS.NOTAM_DATA_CACHE, {});
  const lastIds = safeStorage.get(STORAGE_KEYS.LAST_NOTAM_IDS_CACHE, {});
  const timestamp = safeStorage.get(STORAGE_KEYS.CACHE_TIMESTAMP, 0);
  
  return {
    notamData,
    lastIds,
    timestamp
  };
};

export const setCachedNotamData = (data) => {
  if (data && typeof data === 'object') {
    if (data.notamData) {
      safeStorage.set(STORAGE_KEYS.NOTAM_DATA_CACHE, data.notamData);
    }
    if (data.lastIds) {
      safeStorage.set(STORAGE_KEYS.LAST_NOTAM_IDS_CACHE, data.lastIds);
    }
    if (data.timestamp) {
      safeStorage.set(STORAGE_KEYS.CACHE_TIMESTAMP, data.timestamp);
    }
  } else {
    // Clear cache
    safeStorage.remove(STORAGE_KEYS.NOTAM_DATA_CACHE);
    safeStorage.remove(STORAGE_KEYS.LAST_NOTAM_IDS_CACHE);
    safeStorage.remove(STORAGE_KEYS.CACHE_TIMESTAMP);
  }
};

export const isCacheValid = (maxAgeMs = 5 * 60 * 1000) => {
  const timestamp = safeStorage.get(STORAGE_KEYS.CACHE_TIMESTAMP, 0);
  return (Date.now() - timestamp) < maxAgeMs;
};

export const clearCache = () => {
  safeStorage.remove(STORAGE_KEYS.NOTAM_DATA_CACHE);
  safeStorage.remove(STORAGE_KEYS.LAST_NOTAM_IDS_CACHE);
  safeStorage.remove(STORAGE_KEYS.CACHE_TIMESTAMP);
};

// User preferences
export const getUserPreferences = () => {
  return safeStorage.get(STORAGE_KEYS.USER_PREFERENCES, {
    cardScale: 1.0,
    autoRefresh: true,
    notifications: true,
    theme: 'dark',
    filters: {
      rwy: true,
      twy: true,
      rsc: true,
      crfi: true,
      ils: true,
      fuel: true,
      other: true,
      cancelled: false,
      dom: false,
      current: true,
      future: true
    }
  });
};

export const saveUserPreferences = (preferences) => {
  const current = getUserPreferences();
  const updated = { ...current, ...preferences };
  return safeStorage.set(STORAGE_KEYS.USER_PREFERENCES, updated);
};

export const updateUserPreference = (key, value) => {
  const preferences = getUserPreferences();
  preferences[key] = value;
  return saveUserPreferences(preferences);
};

// Import/Export functionality
export const exportData = () => {
  const data = {
    icaoSets: getIcaoSets(),
    savedIcaos: getSavedIcaos(),
    userPreferences: getUserPreferences(),
    exportDate: new Date().toISOString(),
    version: '2.0'
  };
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.version && data.exportDate) {
      if (data.icaoSets) saveIcaoSets(data.icaoSets);
      if (data.savedIcaos) saveIcaos(data.savedIcaos);
      if (data.userPreferences) saveUserPreferences(data.userPreferences);
      
      return { success: true, message: 'Data imported successfully' };
    } else {
      return { success: false, message: 'Invalid data format' };
    }
  } catch (error) {
    return { success: false, message: `Import failed: ${error.message}` };
  }
};

// Storage cleanup utilities
export const cleanupOldData = () => {
  // Remove old cache data (older than 24 hours)
  const timestamp = safeStorage.get(STORAGE_KEYS.CACHE_TIMESTAMP, 0);
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  if (Date.now() - timestamp > twentyFourHours) {
    clearCache();
  }
  
  // Remove empty ICAO sets
  const sets = getIcaoSets();
  const validSets = sets.filter(set => set.icaos && set.icaos.length > 0);
  if (validSets.length !== sets.length) {
    saveIcaoSets(validSets);
  }
};

// Storage size monitoring
export const getStorageUsage = () => {
  let total = 0;
  const usage = {};
  
  Object.values(STORAGE_KEYS).forEach(key => {
    const item = localStorage.getItem(key);
    const size = item ? new Blob([item]).size : 0;
    usage[key] = size;
    total += size;
  });
  
  return {
    total,
    usage,
    totalMB: (total / 1024 / 1024).toFixed(2)
  };
};

// Initialize storage on first run
export const initializeStorage = () => {
  // Run cleanup
  cleanupOldData();
  
  // Ensure required keys exist with defaults
  if (!localStorage.getItem(STORAGE_KEYS.ICAO_SETS)) {
    saveIcaoSets([]);
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.SAVED_ICAOS)) {
    saveIcaos([]);
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES)) {
    saveUserPreferences(getUserPreferences());
  }
};

// Legacy support for old storage format
export const migrateLegacyData = () => {
  try {
    // Check for old format ICAO sets without IDs
    const sets = getIcaoSets();
    let needsMigration = false;
    
    const migratedSets = sets.map(set => {
      if (!set.id) {
        needsMigration = true;
        return {
          ...set,
          id: Date.now() + Math.random(),
          created: set.created || new Date().toISOString(),
          lastUsed: new Date().toISOString()
        };
      }
      return set;
    });
    
    if (needsMigration) {
      saveIcaoSets(migratedSets);
      console.log('Migrated legacy ICAO sets data');
    }
    
  } catch (error) {
    console.error('Error migrating legacy data:', error);
  }
};
