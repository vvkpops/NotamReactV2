const express = require('express');
const axios = require('axios');
const path = require('path');
const config = require('./config.json');

const CLIENT_ID = config.faa_client_id;
const CLIENT_SECRET = config.faa_client_secret;

const app = express();

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'build')));

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
            timeout: 10000
        });

        // Parse and flatten NOTAMs for easy display
        const items = notamRes.data.items || [];
        let parsed = items.map(item => {
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
        console.error(`[ERROR]`, err);
        res.status(500).json({ error: "FAA API error", details: err.message });
    }
});

// Catch all handler for React Router
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`NOTAM app running at http://localhost:${PORT}`);
});