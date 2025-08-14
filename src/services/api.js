import axios from 'axios';

export const fetchNotamsForIcao = async (icao) => {
  try {
    console.log(`Fetching NOTAMs for ${icao}`);
    const res = await fetch(`/api/notams?icao=${icao}`);
    
    if (!res.ok) {
      console.error(`Error response from API for ${icao}: ${res.status}`);
      return { error: true, status: res.status };
    }
    
    const data = await res.json();
    
    if (!Array.isArray(data)) {
      console.error(`Invalid response format for ${icao}:`, data);
      return { error: true, message: "Invalid response format" };
    }
    
    console.log(`Received ${data.length} NOTAMs for ${icao}`);
    return data;
  } catch (err) {
    console.error(`Network error for ${icao}:`, err);
    return { error: true, message: err.message };
  }
};
