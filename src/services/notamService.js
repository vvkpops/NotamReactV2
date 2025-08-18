// NOTAM API service that calls the backend
export const fetchNotamsForIcao = async (icao) => {
  try {
    console.log(`[notamService] Fetching NOTAMs for ${icao}`);
    
    const response = await fetch(`/api/notams?icao=${icao}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log(`[notamService] Response status for ${icao}:`, response.status);
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[notamService] Rate limited for ${icao}`);
        return { error: 'Rate limited', status: 429 };
      }
      
      const errorText = await response.text();
      console.error(`[notamService] HTTP error for ${icao}:`, response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    // ---- FIX ----
    // If the response is an object with a 'data' property, use it
    if (Array.isArray(data)) {
      return data;
    } else if (Array.isArray(data.data)) {
      return data.data;
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

// Fallback service with retry logic
export const fetchNotamsWithRetry = async (icao, retries = 2) => {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`[notamService] Attempt ${attempt} for ${icao}`);
      const result = await fetchNotamsForIcao(icao);
      
      // If we get an error object, check if we should retry
      if (result && result.error) {
        if (result.status === 429 && attempt <= retries) {
          // Rate limited, wait and retry
          console.log(`[notamService] Rate limited, waiting before retry for ${icao}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        // Other errors, don't retry
        console.log(`[notamService] API error for ${icao}, no retry:`, result.error);
        return result;
      }
      
      // Success
      return result;
      
    } catch (error) {
      console.warn(`[notamService] Attempt ${attempt} failed for ${icao}:`, error.message);
      
      if (attempt === retries + 1) {
        console.error(`[notamService] All ${retries + 1} attempts failed for ${icao}`);
        return { error: `Failed after ${retries + 1} attempts: ${error.message}` };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Development mock data (for testing when backend is unavailable)
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
    ],
    'EGLL': [
      {
        number: 'A1234/24',
        type: 'A',
        classification: 'AD',
        icao: 'EGLL',
        location: 'EGLL',
        validFrom: new Date(Date.now() - 3600000).toISOString(),
        validTo: new Date(Date.now() + 86400000 * 7).toISOString(),
        summary: 'FUEL SUPPLY RESTRICTED',
        body: 'FUEL SUPPLY RESTRICTED TO 80% OF NORMAL CAPACITY DUE TO MAINTENANCE',
        qLine: 'A1234/24 NOTAMN Q) EGTT/QFAXX/IV/NBO/A/000/999/5128N00028W005'
      }
    ]
  };
  
  return mockData[icao] || [];
};

// Test service with fallback to mock data
export const fetchNotamsWithMockFallback = async (icao) => {
  try {
    const result = await fetchNotamsForIcao(icao);
    
    // If we get a network error or server is down, use mock data
    if (result && result.error && result.error.includes('fetch')) {
      console.log(`[notamService] Using mock data for ${icao} due to network error`);
      return getDevMockNotams(icao);
    }
    
    return result;
  } catch (error) {
    console.log(`[notamService] Using mock data for ${icao} due to error:`, error);
    return getDevMockNotams(icao);
  }
};

// Export the main function to use
export default fetchNotamsForIcao;
