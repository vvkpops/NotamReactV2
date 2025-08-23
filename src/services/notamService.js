// NOTAM API service that calls the backend and falls back to NAV CANADA for Canadian ICAOs
export const fetchNotamsForIcao = async (icao) => {
  try {
    console.log(`[notamService] Fetching NOTAMs for ${icao} via /api/notams`);
    
    const response = await fetch(`/api/notams?icao=${icao}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
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
    // If the response is an object with a 'data' property, use it
    let notams = [];
    if (Array.isArray(data)) {
      notams = data;
    } else if (Array.isArray(data.data)) {
      notams = data.data;
    } else if (data.error) {
      console.error(`[notamService] API returned error for ${icao}:`, data.error);
      return { error: data.error };
    } else {
      console.warn(`[notamService] Unexpected data format for ${icao}:`, data);
      notams = [];
    }

    // If we got results, return them
    if (Array.isArray(notams) && notams.length > 0) {
      return notams;
    }

    // If no NOTAMs returned from primary source and ICAO is Canadian, try NAV CANADA CFPS
    if (icao && icao.toUpperCase().startsWith('C')) {
      console.log(`[notamService] No NOTAMs from primary source for ${icao}. Falling back to NAV CANADA CFPS.`);
      const navResult = await fetchNavCanadaNotams(icao);
      return navResult;
    }

    // Nothing found
    return [];
    
  } catch (error) {
    console.error(`[notamService] Error fetching NOTAMs for ${icao}:`, error);
    // On network / other errors, still attempt NAV CANADA for Canadian ICAOs
    if (icao && icao.toUpperCase().startsWith('C')) {
      try {
        console.log(`[notamService] Attempting NAV CANADA fallback after error for ${icao}`);
        const navResult = await fetchNavCanadaNotams(icao);
        return navResult;
      } catch (navErr) {
        console.error(`[notamService] NAV CANADA fallback failed for ${icao}:`, navErr);
      }
    }
    return { error: error.message || String(error) };
  }
};

// Helper: fetch NAV CANADA CFPS via a CORS proxy and normalize results
export const fetchNavCanadaNotams = async (icao) => {
  try {
    const upperIcao = (icao || '').toUpperCase();
    if (!/^[A-Z]{4}$/.test(upperIcao)) {
      return [];
    }

    // Use the provided CORS proxy + NAV CANADA CFPS endpoint
    const navUrl = `https://corsproxy.io/?https://plan.navcanada.ca/weather/api/alpha/?site=${upperIcao}&alpha=notam`;
    console.log(`[notamService] Fetching NAV CANADA CFPS for ${upperIcao}: ${navUrl}`);

    const resp = await fetch(navUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      console.warn(`[notamService] NAV CANADA request failed for ${upperIcao}: ${resp.status}`);
      return [];
    }

    const raw = await resp.json();
    if (!raw) {
      console.warn(`[notamService] NAV CANADA returned empty payload for ${upperIcao}`);
      return [];
    }

    // NAV CANADA response shapes may vary. Try a few common patterns and normalize.
    // Common possibilities:
    // - An object with 'alpha' array
    // - An object with 'notams' or 'data' arrays
    // - A plain array of items
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (Array.isArray(raw.alpha)) {
      items = raw.alpha;
    } else if (Array.isArray(raw.notams)) {
      items = raw.notams;
    } else if (Array.isArray(raw.data)) {
      items = raw.data;
    } else if (raw?.report) {
      // Some endpoints return a single report object with nested notams
      if (Array.isArray(raw.report.notams)) items = raw.report.notams;
      else if (Array.isArray(raw.report.alpha)) items = raw.report.alpha;
      else items = [raw.report];
    } else {
      // Try to inspect keys for candidate arrays
      for (const key of Object.keys(raw)) {
        if (Array.isArray(raw[key]) && raw[key].length && typeof raw[key][0] === 'object') {
          items = raw[key];
          break;
        }
      }
    }

    if (!items || items.length === 0) {
      console.log(`[notamService] No items parsed from NAV CANADA CFPS for ${upperIcao}`);
      return [];
    }

    // Map NAV CANADA items to the internal NOTAM shape used by the app
    const mapped = items.map((item, idx) => {
      // Attempt to extract fields from variable shapes
      // Some fields commonly present: 'id', 'site', 'raw', 'text', 'message', 'start', 'end', 'issued'
      const number = item.id || item.notamId || item.notamNumber || item.number || '';
      const summary = item.raw || item.text || item.message || item.summary || item.simpleText || '';
      const body = item.text || item.fullText || item.message || summary || '';
      const validFrom = item.start || item.validFrom || item.issued || '';
      const validTo = item.end || item.validTo || '';
      const qLine = item.qLine || '';
      const issued = item.issued || item.start || '';
      const location = item.site || item.icao || upperIcao;

      return {
        id: `${upperIcao}-${number || idx}`,
        number: number || '',
        type: item.type || '',
        classification: item.classification || '',
        icao: upperIcao,
        location: location,
        validFrom: validFrom,
        validTo: validTo,
        summary: summary,
        body: body,
        qLine: qLine,
        issued: issued,
        source: 'NAVCAN',
        rawOriginal: item,
        processedAt: new Date().toISOString()
      };
    });

    console.log(`[notamService] NAV CANADA returned ${mapped.length} NOTAM(s) for ${upperIcao}`);
    return mapped;
  } catch (error) {
    console.error(`[notamService] Error fetching/parsing NAV CANADA CFPS for ${icao}:`, error);
    return [];
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
