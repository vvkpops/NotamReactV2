// Real FAA NOTAM API service
export const fetchNotams = async (icao) => {
  try {
    // Get FAA API credentials from config
    const response = await fetch('/config.json');
    const config = await response.json();
    
    // First, get access token
    const tokenResponse = await fetch('https://external-api.faa.gov/notamapi/v1/oauthtoken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': config.faa_client_id,
        'client_secret': config.faa_client_secret
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token request failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Now fetch NOTAMs using the token
    const notamResponse = await fetch(`https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!notamResponse.ok) {
      throw new Error(`NOTAM request failed: ${notamResponse.status}`);
    }

    const notamData = await notamResponse.json();
    
    // Transform FAA API response to your app's format
    const notams = notamData.items?.map(item => ({
      id: item.id,
      number: item.number,
      type: item.type,
      classification: item.classification,
      icao: icao,
      location: item.location,
      validFrom: item.effectiveStart,
      validTo: item.effectiveEnd,
      summary: item.text,
      body: item.text,
      qLine: item.qLine || `${item.number} NOTAM ${item.type}${icao}`,
      issued: item.created,
      effective: item.effectiveStart,
      expires: item.effectiveEnd
    })) || [];

    return notams;

  } catch (error) {
    console.error(`Error fetching NOTAMs for ${icao}:`, error);
    
    // Return error object that your app expects
    return { error: error.message };
  }
};

// Keep the mock function for development/testing
export const mockFetchNotams = async (icao) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
  
  // Mock data - different NOTAMs for different ICAOs
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
