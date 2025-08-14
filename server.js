const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Try to get credentials from environment variables first, fallback to config file
let CLIENT_ID, CLIENT_SECRET;

try {
  CLIENT_ID = process.env.FAA_CLIENT_ID;
  CLIENT_SECRET = process.env.FAA_CLIENT_SECRET;
  
  // If not in environment variables, try config file
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log("Credentials not found in environment variables, trying config.json");
    const config = require('./config.json');
    CLIENT_ID = config.faa_client_id;
    CLIENT_SECRET = config.faa_client_secret;
  }
  
  console.log("API credentials loaded successfully");
} catch (err) {
  console.error("ERROR LOADING CREDENTIALS:", err);
  console.error("Please ensure config.json exists with faa_client_id and faa_client_secret");
  process.exit(1);
}

const app = express();

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'build')));

// Add a basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add detailed status endpoint
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: require('./package.json').version,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    apiCredentials: {
      clientIdConfigured: !!CLIENT_ID,
      clientSecretConfigured: !!CLIENT_SECRET
    }
  });
});

app.get('/api/notams', async (req, res) => {
    const icao = (req.query.icao || '').toUpperCase();
    console.log(`[DEBUG] Incoming request for ICAO: ${icao}`);
    
    if (!icao || icao.length !== 4) {
        console.log("[DEBUG] Invalid ICAO");
        return res.status(400).json({ error: "Invalid ICAO code" });
    }

    try {
        const url = `https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${icao}&responseFormat=geoJson&pageSize=1000`;
        console.log(`[DEBUG] Fetching NOTAMs from: ${url}`);

        const notamRes = await axios.get(url, {
            headers: {
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET
            },
            timeout: 15000
        });

        // Verify response structure
        console.log(`[DEBUG] Response status: ${notamRes.status}`);
        
        if (!notamRes.data) {
            console.error("[ERROR] Empty response data");
            return res.status(500).json({ error: "Empty response from FAA API" });
        }
        
        if (!notamRes.data.items) {
            console.error("[ERROR] Missing items array in response", JSON.stringify(notamRes.data).substring(0, 200));
            return res.status(500).json({ error: "Unexpected response format from FAA API" });
        }

        // Parse and flatten NOTAMs for easy display
        const items = notamRes.data.items || [];
        console.log(`[DEBUG] Raw data items length: ${items.length}`);
        
        if (items.length > 0) {
            console.log(`[DEBUG] First item sample:`, JSON.stringify(items[0]).substring(0, 200));
        }
        
        let parsed = [];
        
        try {
            parsed = items.map(item => {
                const core = item.properties?.coreNOTAMData?.notam || {};
                const translation = (item.properties?.coreNOTAMData?.notamTranslation || [])[0] || {};
                const icao = core.icaoLocation || core.location || '';
                return {
                    number: core.number || '',
                    type: core.type || '',
                    classification: core.classification || '',
                    icao,
                    location: core.location || '',
                    validFrom: core.effectiveStart || core.issued || '',
                    validTo: core.effectiveEnd || '',
                    summary: translation.simpleText || translation.formattedText || '',
                    body: core.text || '',
                    qLine: translation.formattedText?.split('\n')[0] || '',
                };
            });
        } catch (parseErr) {
            console.error("[ERROR] Failed to parse NOTAM data:", parseErr);
            return res.status(500).json({ error: "Failed to parse NOTAM data", details: parseErr.message });
        }

        console.log(`[DEBUG] Parsed data length: ${parsed.length}`);

        // Filter for currently valid or future NOTAMs only
        const now = new Date();
        parsed = parsed.filter(n => {
            if (!n.validTo) return true; // keep if end time missing
            try {
                return new Date(n.validTo) >= now;
            } catch {
                return true;
            }
        });

        // Dispatcher-priority sort:
        parsed.sort((a, b) => {
            const isClosureA = /clsd|closed/i.test(a.summary);
            const isRscA = /rsc/i.test(a.summary);
            const isCrfiA = /crfi/i.test(a.summary);

            const isClosureB = /clsd|closed/i.test(b.summary);
            const isRscB = /rsc/i.test(b.summary);
            const isCrfiB = /crfi/i.test(b.summary);

            // Priority 1: Runway closure
            if (isClosureA && !isClosureB) return -1;
            if (!isClosureA && isClosureB) return 1;

            // Priority 2: RSC
            if (isRscA && !isRscB) return -1;
            if (!isRscA && isRscB) return 1;

            // Priority 3: CRFI
            if (isCrfiA && !isCrfiB) return -1;
            if (!isCrfiA && isCrfiB) return 1;

            // Then, most recent validFrom first
            try {
                return new Date(b.validFrom) - new Date(a.validFrom);
            } catch {
                return 0;
            }
        });

        // Only show the first 50
        parsed = parsed.slice(0, 50);

        console.log(`[DEBUG] Sending response with ${parsed.length} NOTAMs`);
        res.json(parsed);

    } catch (err) {
        console.error(`[ERROR] ${err.message}`);
        console.error(`[ERROR] Details:`, err.response?.data || err);
        
        // Check if the error is from the FAA API
        if (err.response) {
            return res.status(err.response.status).json({ 
                error: "FAA API error", 
                status: err.response.status,
                details: err.response.data || err.message
            });
        }
        
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

// Catch all handler for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`NOTAM app running at http://localhost:${PORT}`);
    console.log(`Server started at: ${new Date().toISOString()}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
