const http = require('http');
const fs = require('fs');
const path = require('path');
const busboy = require('busboy');
const cheerio = require('cheerio');

const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434';

const server = http.createServer((req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Proxy for Ollama API
    if (req.url.startsWith('/ollama-proxy')) {
        const proxyUrl = new URL(OLLAMA_URL + req.url.replace('/ollama-proxy', ''));
        const proxyReq = http.request(proxyUrl, {
            method: req.method,
            headers: { ...req.headers, host: proxyUrl.host },
        }, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });
        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Proxy request failed' }));
        });
        req.pipe(proxyReq, { end: true });
        return;
    }

    // Handle all file uploads at a single, robust endpoint
    if (req.url === '/upload' && req.method === 'POST') {
        const bb = busboy({ headers: req.headers });
        let fileContent = '';
        let originalFilename = '';

        bb.on('file', (name, file, info) => {
            originalFilename = info.filename;
            console.log(`Upload started for: ${originalFilename}`);
            
            file.on('data', (data) => {
                fileContent += data.toString();
            });

            file.on('end', () => {
                console.log(`Upload finished for ${originalFilename}. Total size: ${(fileContent.length / (1024 * 1024)).toFixed(2)} MB`);
            });
        });

        bb.on('finish', () => {
            try {
                console.log('Starting to parse file content on the server...');
                const parsedChats = parseChatGPTExport(fileContent, originalFilename);
                console.log(`Successfully parsed ${parsedChats.length} conversations.`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(parsedChats));
            } catch (error) {
                console.error('Error parsing uploaded file on server:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Failed to parse file: ${error.message}` }));
            }
        });

        req.pipe(bb);
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

function parseChatGPTExport(content, filename) {
    console.log("Attempting to extract ChatGPT data from HTML content...");
    const $ = cheerio.load(content);

    // Strategy 1: Find the __NEXT_DATA__ script tag, the most reliable method
    const nextDataScript = $('script#__NEXT_DATA__');
    if (nextDataScript.length > 0) {
        console.log("Found __NEXT_DATA__ script tag.");
        try {
            const jsonData = JSON.parse(nextDataScript.html());
            if (jsonData.props?.pageProps?.conversations) {
                console.log("Successfully parsed conversations from __NEXT_DATA__.");
                return extractConversations(jsonData.props.pageProps.conversations);
            }
             if (jsonData.props?.pageProps?.sharedConversations) {
                console.log("Successfully parsed conversations from sharedConversations in __NEXT_DATA__.");
                return extractConversations(jsonData.props.pageProps.sharedConversations);
            }
        } catch (e) {
            console.error("Failed to parse JSON from __NEXT_DATA__:", e);
        }
    }

    // Strategy 2: Look for any script tag with a JSON blob containing "mapping"
    let conversations = [];
    $('script').each((i, elem) => {
        const scriptContent = $(elem).html();
        if (scriptContent.includes('"mapping"') && scriptContent.includes('"id"')) {
            try {
                const jsonData = JSON.parse(scriptContent);
                if (jsonData.mapping) {
                     console.log("Found and parsed conversation from a script tag with a mapping object.");
                     conversations.push(extractSingleConversation(jsonData));
                }
            } catch (e) {
                // Ignore parsing errors for other scripts
            }
        }
    });

    if (conversations.length > 0) {
        return conversations;
    }
    
    console.log("Could not find structured JSON. Falling back to basic HTML parsing.");
    // Fallback strategy if JSON is not found (less reliable)
    // This part can be expanded if needed, but JSON is the primary target.
    throw new Error('No valid ChatGPT conversation data found in the file.');
}

function extractConversations(conversationsData) {
    return conversationsData.map(conv => extractSingleConversation(conv));
}

function extractSingleConversation(convData) {
    const messages = [];
    if (convData.mapping) {
        for (const nodeId in convData.mapping) {
            const node = convData.mapping[nodeId];
            if (node.message?.content?.parts) {
                messages.push({
                    role: node.message.author.role,
                    content: node.message.content.parts.join('\n'),
                    timestamp: node.message.create_time
                });
            }
        }
    }
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    return {
        id: convData.id || generateId(),
        title: convData.title || 'ChatGPT Import',
        messages: messages,
        source: 'ChatGPT',
        createdAt: conv.create_time || Date.now(),
        folderId: 'all'
    };
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});