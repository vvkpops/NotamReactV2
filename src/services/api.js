import axios from 'axios';

export const fetchNotamsForIcao = async (icao) => {
  try {
    const res = await fetch(`/api/notams?icao=${icao}`);
    
    if (!res.ok) {
      return { error: true, status: res.status };
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`Network error for ${icao}:`, err);
    return { error: true };
  }
};