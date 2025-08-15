// Real API service that calls your backend
export const fetchNotams = async (icao) => {
  try {
    console.log(`[notamService] Fetching NOTAMs for ${icao} from backend...`);
    
    const response = await fetch(`/api/notams?icao=${icao}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[notamService] Response status for ${icao}:`, response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[notamService] HTTP error for ${icao}:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[notamService] Received ${data.length} NOTAMs for ${icao}:`, data);
    
    // Ensure we return an array, even if empty
    if (Array.isArray(data)) {
      return data;
    } else if (data.error) {
      console.error(`[notamService] API returned error for ${icao}:`, data.error);
      return { error: data.error };
    } else {
      console.warn(`[notamService] Unexpected data format for ${icao}:`, data);
      return [];
    }
    
  } catch (error) {
    console.error(`[notamService] Error fetching NOTAMs for ${icao}:`, error);
    return { error: error.message };
  }
};

// Mock service for development/testing - now calls the real backend
export const mockFetchNotams = async (icao) => {
  console.log(`[notamService] mockFetchNotams called for ${icao}, routing to real API...`);
  return await fetchNotams(icao);
};

// Development mock data (only used if backend is down)
export const getDevMockNotams = (icao) => {
  const mockData = {
    'KJFK': [
      {
        number: 'A0234/24',
        type: 'A',
        classification: 'RW',
        icao: 'KJFK',
        location: 'KJFK',
        validFrom: new Date(Date.now() - 3600000).toISOString(),
        validTo: new Date(Date.now() + 86400000 * 3).toISOString(),
        summary: 'RWY 04L/22R CLSD FOR MAINTENANCE WORK',
        body: 'RUNWAY 04L/22R CLOSED FOR MAINTENANCE WORK. EXPECT DELAYS.',
        qLine: 'A0234/24 NOTAMN Q) ZNY/QMRLC/IV/NBO/A/000/999/4038N07346W005'
      },
      {
        number: 'A0235/24',
        type: 'A',
        classification: 'NAV',
        icao: 'KJFK',
        location: 'KJFK',
        validFrom: new Date(Date.now() - 1800000).toISOString(),
        validTo: new Date(Date.now() + 86400000 * 2).toISOString(),
        summary: 'ILS RWY 04L U/S',
        body: 'INSTRUMENT LANDING SYSTEM RWY 04L UNSERVICEABLE',
        qLine: 'A0235/24 NOTAMN Q) ZNY/QILCA/IV/NBO/A/000/999/4038N07346W005'
      }
    ],
    'KLAX': [
      {
        number: 'A0456/24',
        type: 'A',
        classification: 'TW',
        icao: 'KLAX',
        location: 'KLAX',
        validFrom: new Date(Date.now() + 3600000).toISOString(),
        validTo: new Date(Date.now() + 86400000 * 5).toISOString(),
        summary: 'TWY A CLSD BTN TWY A9 AND TWY A11',
        body: 'TAXIWAY A CLOSED BETWEEN TAXIWAY A9 AND TAXIWAY A11 FOR CONSTRUCTION',
        qLine: 'A0456/24 NOTAMN Q) ZLA/QMTLC/IV/NBO/A/000/999/3356N11824W005'
      }
    ],
    'CYYZ': [
      {
        number: 'A0789/24',
        type: 'A',
        classification: 'RW',
        icao: 'CYYZ',
        location: 'CYYZ',
        validFrom: new Date(Date.now() - 7200000).toISOString(),
        validTo: new Date(Date.now() + 86400000).toISOString(),
        summary: 'RWY 05/23 RSC 4/4/4 CRFI 0.35/0.35/0.35',
        body: 'RUNWAY 05/23 RUNWAY SURFACE CONDITION 4/4/4 CANADIAN RUNWAY FRICTION INDEX 0.35/0.35/0.35',
        qLine: 'A0789/24 NOTAMN Q) CZT/QMRCS/IV/NBO/A/000/999/4338N07937W005'
      }
    ]
  };
  
  return mockData[icao] || [];
};

// Fallback service with retry logic
export const fetchNotamsWithFallback = async (icao, retries = 2) => {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`[notamService] Attempt ${attempt} for ${icao}`);
      const result = await fetchNotams(icao);
      
      // If we get an error object, don't retry
      if (result && result.error) {
        console.log(`[notamService] API error for ${icao}, no retry:`, result.error);
        return result;
      }
      
      // Success
      return result;
      
    } catch (error) {
      console.warn(`[notamService] Attempt ${attempt} failed for ${icao}:`, error.message);
      
      if (attempt === retries + 1) {
        console.error(`[notamService] All ${retries + 1} attempts failed for ${icao}`);
        // Return dev mock data as last resort
        console.log(`[notamService] Returning fallback mock data for ${icao}`);
        return getDevMockNotams(icao);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Export the main function to use
export default fetchNotams;
