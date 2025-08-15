// ICAO Sets storage utilities
export const getIcaoSets = () => {
  const saved = localStorage.getItem('icaoSets');
  return saved ? JSON.parse(saved) : [];
};

export const saveIcaoSets = (sets) => {
  localStorage.setItem('icaoSets', JSON.stringify(sets));
};

export const getSavedIcaos = () => {
  const saved = localStorage.getItem('notamIcaos');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved ICAOs:', e);
      return [];
    }
  }
  return [];
};

export const saveIcaos = (icaos) => {
  localStorage.setItem('notamIcaos', JSON.stringify(icaos));
};
