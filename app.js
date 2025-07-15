// Data storage
let chats = [];
let folders = [
    { id: 'all', name: 'All Chats', isSystem: true }
];
let currentChatId = null;
let currentFolderId = 'all';
let isNewChat = false;
let currentProvider = null;
let currentModel = null;

// API configurations
const apiSettings = {
    ollama: {
        url: '/ollama-proxy',
        models: []
    },
    huggingface: {
        apiKey: '',
        models: [
            "mistralai/Mistral-7B-Instruct-v0.2",
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "meta-llama/Llama-2-7b-chat-hf",
            "meta-llama/Llama-2-13b-chat-hf",
            "meta-llama/Llama-2-70b-chat-hf",
            "codellama/CodeLlama-34b-Instruct-hf",
            "google/flan-t5-xxl",
            "tiiuae/falcon-7b-instruct",
            "bigscience/bloom"
        ]
    },
    openrouter: {
        apiKey: '',
        models: [
            "openai/gpt-3.5-turbo",
            "openai/gpt-4",
            "openai/gpt-4-turbo",
            "openai/gpt-4o",
            "anthropic/claude-3-opus",
            "anthropic/claude-3-sonnet",
            "anthropic/claude-3-haiku",
            "anthropic/claude-2",
            "anthropic/claude-instant-1",
            "google/gemini-pro",
            "google/gemini-flash",
            "meta-llama/llama-3-8b-instruct",
            "meta-llama/llama-3-70b-instruct",
            "mistralai/mistral-7b-instruct",
            "mistralai/mixtral-8x7b-instruct",
            "mistralai/mistral-large",
            "microsoft/wizardlm-2-8x22b"
        ]
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadApiSettings();
    loadDataFromStorage();
    initializeEventListeners();
    initializeDragAndDrop();
    renderFolders();
    renderChatList();
    populateSourceFilter();
    initializeAutoSave();
});

// Load data from localStorage
function loadDataFromStorage() {
    const savedChats = localStorage.getItem('aiChatArchive_chats');
    const savedFolders = localStorage.getItem('aiChatArchive_folders');
    
    if (savedChats) {
        chats = JSON.parse(savedChats);
    }
    
    if (savedFolders) {
        const userFolders = JSON.parse(savedFolders);
        folders = [folders[0], ...userFolders];
    }
}

// Load API settings from localStorage
function loadApiSettings() {
    const saved = localStorage.getItem('aiChatArchive_apiSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        Object.assign(apiSettings, settings);
    }
}

// Save API settings to localStorage
function saveApiSettings() {
    localStorage.setItem('aiChatArchive_apiSettings', JSON.stringify(apiSettings));
}

// Save data to localStorage
function saveDataToStorage() {
    localStorage.setItem('aiChatArchive_chats', JSON.stringify(chats));
    const userFolders = folders.filter(f => !f.isSystem);
    localStorage.setItem('aiChatArchive_folders', JSON.stringify(userFolders));
}

// Initialize event listeners
function initializeEventListeners() {
    // Import button
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    // File input
    document.getElementById('fileInput').addEventListener('change', handleFileImport);
    document.getElementById('exportAllBtn').addEventListener('click', showExportModal);
    
    // Search input with debouncing
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderChatList();
            saveSearchHistory(e.target.value);
        }, 300);
    });

    // Advanced search filters
    document.getElementById('sourceFilter').addEventListener('change', renderChatList);
    document.getElementById('dateFromFilter').addEventListener('change', renderChatList);
    document.getElementById('dateToFilter').addEventListener('change', renderChatList);
    
    // Add folder button
    document.getElementById('addFolderBtn').addEventListener('click', showFolderModal);
    
    // Modal buttons
    document.getElementById('confirmModalBtn').addEventListener('click', createFolder);
    document.getElementById('cancelModalBtn').addEventListener('click', hideFolderModal);
    document.getElementById('cancelMoveBtn').addEventListener('click', hideMoveModal);
    
    // Chat action buttons
    document.getElementById('editTitleBtn').addEventListener('click', editChatTitle);
    document.getElementById('moveToFolderBtn').addEventListener('click', showMoveModal);
    document.getElementById('deleteChatBtn').addEventListener('click', deleteChat);
    document.getElementById('exportChatBtn').addEventListener('click', showExportModal);
    document.getElementById('modelSettingsBtn').addEventListener('click', showApiSettingsModal);
    document.getElementById('analyticsBtn').addEventListener('click', showAnalytics);
    document.getElementById('bulkActionsBtn').addEventListener('click', toggleBulkSelection);
    document.getElementById('saveApiSettingsBtn').addEventListener('click', saveApiSettingsFromModal);
    document.getElementById('cancelApiSettingsBtn').addEventListener('click', hideApiSettingsModal);
    document.getElementById('newChatBtn').addEventListener('click', () => {
        const newChat = {
            id: generateId(),
            title: 'New Chat',
            messages: [],
            createdAt: Date.now(),
            folderId: 'all',
            source: 'manual'
        };
        chats.push(newChat);
        saveDataToStorage();
        renderChatList();
        
        // Automatically select the new chat and set default provider
        currentProvider = 'ollama';
        currentModel = null; // Reset model selection
        selectChat(newChat.id);
    });
    
    // Click outside modal to close
    document.getElementById('folderModal').addEventListener('click', (e) => {
        if (e.target.id === 'folderModal') hideFolderModal();
    });
    document.getElementById('moveModal').addEventListener('click', (e) => {
        if (e.target.id === 'moveModal') hideMoveModal();
    });

    // Chat input
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Model selectors
    document.getElementById('providerSelect').addEventListener('change', (e) => {
        currentProvider = e.target.value;
        populateModelSelector();
    });
    document.getElementById('modelSelect').addEventListener('change', (e) => {
        currentModel = e.target.value;
    });
}

// File import handler
async function handleFileImport(event) {
    const files = event.target.files;
    
    for (const file of files) {
        try {
            // Any file with an HTML extension or larger than 2MB will be processed by the server
            const useServerProcessing = file.name.toLowerCase().endsWith('.html') || file.size > 2 * 1024 * 1024;
            
            if (useServerProcessing) {
                console.log(`Using server-side processing for ${file.name}`);
                await handleServerUpload(file);
            } else {
                // For small, non-HTML files, use the regular in-browser approach
                console.log(`Processing ${file.name} with standard approach (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
                const content = await readFile(file);
                const parsedChats = parseExportFile(content, file.name);
                
                if (parsedChats && parsedChats.length > 0) {
                    let imported = 0;
                    let duplicates = 0;
                    
                    for (const chat of parsedChats) {
                        if (!isDuplicateConversation(chat, chats)) {
                            // Auto-tag the conversation
                            autoTagConversation(chat);
                            chats.push(chat);
                            imported++;
                        } else {
                            duplicates++;
                        }
                    }
                    
                    saveDataToStorage();
                    renderChatList();
                    updateFolderCounts();
                    
                    let message = `Imported ${imported} conversations from ${file.name}`;
                    if (duplicates > 0) {
                        message += ` (${duplicates} duplicates skipped)`;
                    }
                    showNotification(message);
                    populateSourceFilter();
                }
            }
        } catch (error) {
            console.error('Error importing file:', error);
            showNotification(`Error importing ${file.name}: ${error.message}`, 'error');
        }
    }
    
    // Reset file input
    event.target.value = '';
}


// Handle file upload and processing via the server
async function handleServerUpload(file) {
    showNotification(`Processing ${file.name} on server...`);

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.innerHTML = `
        <div class="progress-label">Processing ${file.name}</div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: 50%; animation: pulse 2s infinite;"></div>
        </div>
        <div class="progress-status">Uploading and processing...</div>
    `;
    document.body.appendChild(progressContainer);

    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with status ${response.status}`);
        }

        const parsedChats = await response.json();

        if (parsedChats && parsedChats.length > 0) {
            let imported = 0;
            let duplicates = 0;
            
            for (const chat of parsedChats) {
                if (!isDuplicateConversation(chat, chats)) {
                    // Auto-tag the conversation
                    autoTagConversation(chat);
                    chats.push(chat);
                    imported++;
                } else {
                    duplicates++;
                }
            }
            
            saveDataToStorage();
            renderChatList();
            updateFolderCounts();
            
            let message = `Successfully imported ${imported} conversations from ${file.name}`;
            if (duplicates > 0) {
                message += ` (${duplicates} duplicates skipped)`;
            }
            showNotification(message);
            populateSourceFilter();
        } else {
            throw new Error("The server didn't find any conversations in the file.");
        }

    } catch (error) {
        console.error('Server upload error:', error);
        showNotification(`Error importing file: ${error.message}`, 'error');
    } finally {
        document.body.removeChild(progressContainer);
    }
}

// Read entire file content (for smaller, non-HTML files)
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        
        const slice = file.slice(start, end);
        reader.readAsArrayBuffer(slice);
    });
}

// Read entire file content (for smaller files)
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Parse export file based on format
function parseExportFile(content, filename) {
    try {
        const extension = filename.split('.').pop().toLowerCase();
        
        // Handle HTML files
        if (extension === 'html' || extension === 'htm') {
            console.log("Processing HTML file:", filename);
            
            // Check if this is a ChatGPT export by title
            if (content.includes("<title>ChatGPT Data Export</title>") ||
                content.includes("<title>ChatGPT Conversation</title>") ||
                content.includes("window.__NEXT_DATA__")) {
                console.log("Detected ChatGPT export by title or structure");
                
                // Try to extract the conversation data using our specialized function
                return extractChatGPTData(content, filename);
            }
            
            // First try to extract JSON from HTML (common in ChatGPT exports)
            try {
                const jsonMatch = content.match(/<script[^>]*>(\s*window\.__NEXT_DATA__\s*=\s*)(.*?)(<\/script>)/s);
                if (jsonMatch && jsonMatch[2]) {
                    console.log("Found embedded JSON data in HTML");
                    const jsonData = JSON.parse(jsonMatch[2]);
                    if (jsonData && jsonData.props && jsonData.props.pageProps &&
                        jsonData.props.pageProps.conversations) {
                        console.log("Found ChatGPT conversations in embedded JSON");
                        return parseChatGPTJsonExport(jsonData.props.pageProps.conversations);
                    }
                }
                
                // Try another common pattern
                const dataMatch = content.match(/data-json="([^"]*)"/);
                if (dataMatch && dataMatch[1]) {
                    console.log("Found data-json attribute");
                    const decodedJson = decodeURIComponent(dataMatch[1].replace(/\\"/g, '"'));
                    const jsonData = JSON.parse(decodedJson);
                    if (Array.isArray(jsonData)) {
                        console.log("Found conversations in data-json");
                        return parseChatGPTExport(jsonData);
                    }
                }
            } catch (jsonError) {
                console.log("JSON extraction failed:", jsonError);
            }
            
            // If JSON extraction fails, fall back to HTML parsing
            return parseHTMLExport(content, filename);
        }
        
        // Handle Markdown files
        if (extension === 'md') {
            return parseMarkdownExport(content, filename);
        }
        
        // Handle JSON files
        const data = JSON.parse(content);
        
        // ChatGPT export format
        if (Array.isArray(data)) {
            return parseChatGPTExport(data);
        }
        
        // Claude export format (usually has a conversations array)
        if (data.conversations && Array.isArray(data.conversations)) {
            return parseClaudeExport(data.conversations);
        }
        
        // Generic format with messages array
        if (data.messages && Array.isArray(data.messages)) {
            return parseGenericExport(data);
        }
        
        throw new Error('Unrecognized export format');
    } catch (error) {
        console.error('Parse error:', error);
        throw new Error('Failed to parse export file');
    }
}

// Parse a single ChatGPT conversation from JSON
function parseSingleChatGPTConversation(data) {
    const messages = [];
    const mapping = data.mapping || {};
    
    // Extract messages from the mapping structure
    for (const nodeId in mapping) {
        const node = mapping[nodeId];
        if (node.message && node.message.content && node.message.content.parts) {
            messages.push({
                role: node.message.author.role,
                content: node.message.content.parts.join('\n'),
                timestamp: node.message.create_time || Date.now()
            });
        }
    }
    
    // Sort messages by timestamp
    messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    return {
        id: generateId(),
        title: data.title || 'ChatGPT Conversation',
        messages: messages,
        source: 'ChatGPT',
        createdAt: data.create_time || Date.now(),
        folderId: 'all'
    };
}

// Parse ChatGPT JSON export format (from embedded data)
function parseChatGPTJsonExport(conversations) {
    return conversations.map((conversation, index) => {
        const messages = [];
        
        if (conversation.messages && Array.isArray(conversation.messages)) {
            conversation.messages.forEach(msg => {
                if (msg.content && msg.author) {
                    messages.push({
                        role: msg.author.role || 'assistant',
                        content: Array.isArray(msg.content.parts) ? msg.content.parts.join('\n') : msg.content,
                        timestamp: msg.create_time || Date.now()
                    });
                }
            });
        }
        
        return {
            id: generateId(),
            title: conversation.title || `ChatGPT Conversation ${index + 1}`,
            messages: messages,
            source: 'ChatGPT',
            createdAt: conversation.create_time || Date.now(),
            folderId: 'all'
        };
    });
}

// Parse HTML export format
function parseHTMLExport(content, filename) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    console.log("--- PARSING HTML FILE ---");
    console.log("Title:", doc.title);
    console.log("Body has", doc.body.children.length, "child elements");
    
    const messages = [];
    let currentRole = null;
    let currentContent = [];
    let messageCount = 0;

    // Strategy 1: Look for divs with specific patterns
    const allDivs = doc.querySelectorAll('div');
    console.log("Found", allDivs.length, "div elements");
    
    // First, try to identify the structure by looking at the content
    let userPattern = null;
    let assistantPattern = null;
    
    // Look for patterns in the text
    allDivs.forEach(div => {
        const text = div.textContent.trim();
        if (text.length > 0 && text.length < 1000) { // Reasonable message length
            // Check for user indicators
            if (text.match(/^(You:|User:|Human:|Me:)/i)) {
                userPattern = 'prefix';
            } else if (div.querySelector('img[alt*="user" i], img[alt*="you" i], .user, .human')) {
                userPattern = 'class-or-img';
            }
            
            // Check for assistant indicators
            if (text.match(/^(Assistant:|AI:|Bot:|ChatGPT:|Claude:)/i)) {
                assistantPattern = 'prefix';
            } else if (div.querySelector('img[alt*="assistant" i], img[alt*="ai" i], img[alt*="bot" i], .assistant, .ai, .bot')) {
                assistantPattern = 'class-or-img';
            }
        }
    });
    
    console.log("Detected patterns - User:", userPattern, "Assistant:", assistantPattern);
    
    // Strategy 2: Process all divs and try to extract messages
    allDivs.forEach((div, index) => {
        const text = div.textContent.trim();
        
        // Skip empty or very short divs
        if (text.length < 2) return;
        
        // Skip divs that are too long (likely containers)
        if (text.length > 50000) return;
        
        // Check if this div contains a message
        let isMessage = false;
        let role = null;
        
        // Check for role indicators
        if (text.match(/^(You:|User:|Human:|Me:)/i)) {
            role = 'user';
            isMessage = true;
        } else if (text.match(/^(Assistant:|AI:|Bot:|ChatGPT:|Claude:)/i)) {
            role = 'assistant';
            isMessage = true;
        } else if (div.classList.contains('user') || div.classList.contains('human')) {
            role = 'user';
            isMessage = true;
        } else if (div.classList.contains('assistant') || div.classList.contains('ai') || div.classList.contains('bot')) {
            role = 'assistant';
            isMessage = true;
        } else if (div.querySelector('p') && !div.querySelector('div')) {
            // This might be a message container with just paragraphs
            isMessage = true;
            role = messageCount % 2 === 0 ? 'user' : 'assistant'; // Alternate roles
        }
        
        if (isMessage && text.length > 0) {
            // Clean the text by removing role prefixes
            let cleanText = text.replace(/^(You:|User:|Human:|Me:|Assistant:|AI:|Bot:|ChatGPT:|Claude:)\s*/i, '');
            
            messages.push({
                role: role,
                content: cleanText,
                timestamp: Date.now()
            });
            messageCount++;
            
            if (messageCount <= 5) {
                console.log(`Message ${messageCount} (${role}):`, cleanText.substring(0, 100) + "...");
            }
        }
    });
    
    // Strategy 3: If no messages found, try looking for paragraphs with alternating roles
    if (messages.length === 0) {
        console.log("No messages found with div strategy, trying paragraphs...");
        const paragraphs = doc.querySelectorAll('p');
        console.log("Found", paragraphs.length, "paragraph elements");
        
        paragraphs.forEach((p, index) => {
            const text = p.textContent.trim();
            if (text.length > 10 && text.length < 50000) {
                // Check parent for role indicators
                const parent = p.parentElement;
                let role = 'assistant';
                
                if (parent) {
                    const parentText = parent.textContent;
                    if (parentText.match(/\b(you|user|human|me)\b/i)) {
                        role = 'user';
                    } else if (index % 2 === 0) {
                        role = 'user';
                    }
                }
                
                messages.push({
                    role: role,
                    content: text,
                    timestamp: Date.now()
                });
                
                if (messages.length <= 5) {
                    console.log(`P-Message ${messages.length} (${role}):`, text.substring(0, 100) + "...");
                }
            }
        });
    }
    
    // Strategy 4: If still no messages, just import all text content as assistant messages
    if (messages.length === 0) {
        console.log("No structured messages found, importing as plain text...");
        const textContent = doc.body.textContent.trim();
        if (textContent.length > 0) {
            // Split by double newlines or common separators
            const chunks = textContent.split(/\n\n+|\r\n\r\n+/);
            chunks.forEach((chunk, index) => {
                const trimmedChunk = chunk.trim();
                if (trimmedChunk.length > 10) {
                    messages.push({
                        role: index % 2 === 0 ? 'user' : 'assistant',
                        content: trimmedChunk,
                        timestamp: Date.now()
                    });
                }
            });
        }
    }
    
    console.log("Total messages extracted:", messages.length);
    console.log("------------------------");
    
    if (messages.length === 0) {
        throw new Error('Could not extract any messages from the HTML file. The file might be empty or use an unsupported format.');
    }

    return [{
        id: generateId(),
        title: doc.title || filename.replace(/\.(html?)$/i, '') || 'HTML Import',
        messages: messages,
        source: 'HTML',
        createdAt: Date.now(),
        folderId: 'all'
    }];
}
// Extract ChatGPT data from HTML content
function extractChatGPTData(content, filename) {
    console.log("Attempting to extract ChatGPT data from HTML");
    
    // Try multiple extraction methods
    
    // Method 1: Look for the mapping structure in any JSON block
    try {
        const mappingMatch = content.match(/{[\s\S]*"mapping"[\s\S]*?}(?=\s*<\/script>|\s*$)/);
        if (mappingMatch) {
            console.log("Found potential mapping structure");
            try {
                const jsonData = JSON.parse(mappingMatch[0]);
                if (jsonData && jsonData.mapping) {
                    console.log("Successfully parsed JSON with mapping");
                    return [parseSingleChatGPTConversation(jsonData)];
                }
            } catch (e) {
                console.log("Failed to parse mapping JSON:", e);
            }
        }
    } catch (e) {
        console.log("Error in mapping extraction:", e);
    }
    
    // Method 2: Look for conversations array in any JSON block
    try {
        const conversationsMatch = content.match(/"conversations"\s*:\s*(\[[\s\S]*?\])(?=\s*,|\s*})/);
        if (conversationsMatch && conversationsMatch[1]) {
            console.log("Found potential conversations array");
            try {
                const conversationsData = JSON.parse(conversationsMatch[1]);
                if (Array.isArray(conversationsData)) {
                    console.log("Successfully parsed conversations array");
                    return parseChatGPTJsonExport(conversationsData);
                }
            } catch (e) {
                console.log("Failed to parse conversations JSON:", e);
            }
        }
    } catch (e) {
        console.log("Error in conversations extraction:", e);
    }
    
    // Method 3: Look for any JSON with pageProps
    try {
        const pagePropsMatch = content.match(/{[\s\S]*"pageProps"[\s\S]*?}(?=\s*<\/script>|\s*$)/);
        if (pagePropsMatch) {
            console.log("Found potential pageProps structure");
            try {
                const jsonData = JSON.parse(pagePropsMatch[0]);
                if (jsonData && jsonData.pageProps && jsonData.pageProps.conversations) {
                    console.log("Successfully parsed pageProps with conversations");
                    return parseChatGPTJsonExport(jsonData.pageProps.conversations);
                }
            } catch (e) {
                console.log("Failed to parse pageProps JSON:", e);
            }
        }
    } catch (e) {
        console.log("Error in pageProps extraction:", e);
    }
    
    // Method 4: Look for any JSON with a title and mapping structure
    try {
        const jsonBlocks = content.match(/{[\s\S]*?}(?=\s*<\/script>|\s*$)/g) || [];
        for (const block of jsonBlocks) {
            if (block.includes('"title"') && block.includes('"mapping"')) {
                try {
                    const jsonData = JSON.parse(block);
                    if (jsonData && jsonData.mapping) {
                        console.log("Found JSON block with title and mapping");
                        return [parseSingleChatGPTConversation(jsonData)];
                    }
                } catch (e) {
                    // Continue to next block
                }
            }
        }
    } catch (e) {
        console.log("Error in JSON blocks extraction:", e);
    }
    
    // If all methods fail, fall back to HTML parsing
    console.log("All JSON extraction methods failed, falling back to HTML parsing");
    return parseHTMLExport(content, filename);
}

// Parse Markdown export format
function parseMarkdownExport(content, filename) {
    const messages = [];
    const lines = content.split('\n');
    
    let currentRole = null;
    let currentContent = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('**User:**') || trimmedLine.startsWith('**You:**')) {
            if (currentRole && currentContent.length > 0) {
                messages.push({
                    role: currentRole,
                    content: currentContent.join('\n').trim(),
                    timestamp: Date.now()
                });
            }
            currentRole = 'user';
            currentContent = [trimmedLine.replace(/^(\*\*User:\*\*|\*\*You:\*\*)/, '').trim()];
        } else if (trimmedLine.startsWith('**Assistant:**') || trimmedLine.startsWith('**AI:**')) {
            if (currentRole && currentContent.length > 0) {
                messages.push({
                    role: currentRole,
                    content: currentContent.join('\n').trim(),
                    timestamp: Date.now()
                });
            }
            currentRole = 'assistant';
            currentContent = [trimmedLine.replace(/^(\*\*Assistant:\*\*|\*\*AI:\*\*)/, '').trim()];
        } else if (trimmedLine.startsWith('### ') || trimmedLine.startsWith('## ')) {
            // Skip headers
            continue;
        } else if (trimmedLine) {
            currentContent.push(line);
        }
    }
    
    // Add the last message
    if (currentRole && currentContent.length > 0) {
        messages.push({
            role: currentRole,
            content: currentContent.join('\n').trim(),
            timestamp: Date.now()
        });
    }
    
    // If no structured messages found, treat as single conversation
    if (messages.length === 0) {
        messages.push({
            role: 'assistant',
            content: content.trim(),
            timestamp: Date.now()
        });
    }
    
    return [{
        id: generateId(),
        title: filename.replace(/\.md$/i, '') || 'Markdown Conversation',
        messages: messages,
        source: 'Markdown',
        createdAt: Date.now(),
        folderId: 'all'
    }];
}

// Parse ChatGPT export format
function parseChatGPTExport(data) {
    return data.map((conversation, index) => {
        const messages = [];
        const mapping = conversation.mapping || {};
        
        // Extract messages from the mapping structure
        for (const nodeId in mapping) {
            const node = mapping[nodeId];
            if (node.message && node.message.content && node.message.content.parts) {
                messages.push({
                    role: node.message.author.role,
                    content: node.message.content.parts.join('\n'),
                    timestamp: node.message.create_time
                });
            }
        }
        
        // Sort messages by timestamp
        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        return {
            id: generateId(),
            title: conversation.title || `ChatGPT Conversation ${index + 1}`,
            messages: messages,
            source: 'ChatGPT',
            createdAt: conversation.create_time || Date.now(),
            folderId: 'all'
        };
    });
}

// Parse Claude export format
function parseClaudeExport(conversations) {
    return conversations.map((conversation, index) => {
        const messages = conversation.messages || [];
        
        return {
            id: generateId(),
            title: conversation.name || `Claude Conversation ${index + 1}`,
            messages: messages.map(msg => ({
                role: msg.sender === 'human' ? 'user' : 'assistant',
                content: msg.text || msg.content || '',
                timestamp: msg.created_at || msg.timestamp
            })),
            source: 'Claude',
            createdAt: conversation.created_at || Date.now(),
            folderId: 'all'
        };
    });
}

// Parse Generic export format
function parseGenericExport(data) {
    const messages = data.messages.map(msg => ({
        role: msg.role || (msg.sender === 'human' ? 'user' : 'assistant'),
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || Date.now()
    }));
    
    return [{
        id: generateId(),
        title: data.title || 'Generic Conversation',
        messages: messages,
        source: 'Generic',
        createdAt: Date.now(),
        folderId: 'all'
    }];
}

// Render folders
function renderFolders() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';
    
    folders.forEach(folder => {
        const folderElement = createFolderElement(folder);
        folderList.appendChild(folderElement);
    });
}

// Create folder element
function createFolderElement(folder) {
    const div = document.createElement('div');
    div.className = `folder-item ${folder.id === currentFolderId ? 'active' : ''}`;
    div.setAttribute('data-folder-id', folder.id);
    
    const chatCount = chats.filter(chat => chat.folderId === folder.id).length;
    
    div.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${folder.name}</span>
        <span class="chat-count">${chatCount}</span>
    `;
    
    div.addEventListener('click', () => selectFolder(folder.id));
    
    return div;
}

// Select folder
function selectFolder(folderId) {
    currentFolderId = folderId;
    renderFolders();
    renderChatList();
}

// Fuzzy search implementation
function fuzzyMatch(text, query) {
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Exact match
    if (textLower.includes(queryLower)) return true;
    
    // Fuzzy match
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
        if (textLower[i] === queryLower[queryIndex]) {
            queryIndex++;
        }
    }
    
    return queryIndex === queryLower.length;
}

// Highlight search matches
function highlightMatches(text, query) {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.split('').join('.*?')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Render chat list
function renderChatList() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';

    // Get filter values
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const source = document.getElementById('sourceFilter').value;
    const dateFrom = document.getElementById('dateFromFilter').value;
    const dateTo = document.getElementById('dateToFilter').value;

    let filteredChats = chats;

    // Apply filters
    if (currentFolderId !== 'all') {
        filteredChats = filteredChats.filter(chat => chat.folderId === currentFolderId);
    }

    if (source) {
        filteredChats = filteredChats.filter(chat => chat.source === source);
    }

    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0); // Start of the day
        filteredChats = filteredChats.filter(chat => chat.createdAt >= fromDate.getTime());
    }

    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of the day
        filteredChats = filteredChats.filter(chat => chat.createdAt <= toDate.getTime());
    }

    if (searchTerm) {
        filteredChats = filteredChats.filter(chat => {
            // Search in title
            if (fuzzyMatch(chat.title, searchTerm)) return true;
            
            // Search in messages
            if (chat.messages.some(msg => fuzzyMatch(msg.content, searchTerm))) return true;
            
            // Search in tags
            if (chat.tags && chat.tags.some(tag => fuzzyMatch(tag, searchTerm))) return true;
            
            return false;
        });
    }
    
    // Sort by created date (newest first)
    filteredChats.sort((a, b) => b.createdAt - a.createdAt);
    
    filteredChats.forEach(chat => {
        const chatElement = createChatElement(chat, searchTerm);
        chatList.appendChild(chatElement);
    });
    
    if (filteredChats.length === 0) {
        chatList.innerHTML = `
            <div class="empty-chat-list">
                <p>No conversations found</p>
                ${searchTerm ? '<p class="search-hint">Try a different search term</p>' : ''}
            </div>
        `;
    }
}

// Create chat element
function createChatElement(chat, searchTerm = '') {
    const div = document.createElement('div');
    const isSelected = selectedChats.has(chat.id);
    div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''} ${isSelected ? 'bulk-selected' : ''}`;
    div.setAttribute('data-chat-id', chat.id);
    
    const lastMessage = chat.messages[chat.messages.length - 1];
    const preview = lastMessage ? lastMessage.content.substring(0, 100) + '...' : 'No messages';
    
    // Highlight search matches
    const titleHtml = searchTerm ? highlightMatches(chat.title, searchTerm) : chat.title;
    const previewHtml = searchTerm ? highlightMatches(preview, searchTerm) : preview;
    
    // Create tags HTML
    const tagsHtml = chat.tags && chat.tags.length > 0
        ? `<div class="chat-tags">${chat.tags.map(tag =>
            `<span class="tag ${searchTerm && fuzzyMatch(tag, searchTerm) ? 'tag-highlighted' : ''}">${tag}</span>`
          ).join('')}</div>`
        : '';
    
    // Add checkbox if in bulk selection mode
    const checkboxHtml = bulkSelectionMode
        ? `<input type="checkbox" class="chat-item-checkbox" ${isSelected ? 'checked' : ''}>`
        : '';
    
    div.innerHTML = `
        ${checkboxHtml}
        <div class="chat-content">
            <div class="chat-title">${titleHtml}</div>
            <div class="chat-preview">${previewHtml}</div>
            ${tagsHtml}
            <div class="chat-meta">
                <span class="chat-source">${chat.source}</span>
                <span class="chat-date">${new Date(chat.createdAt).toLocaleDateString()}</span>
            </div>
        </div>
    `;
    
    div.addEventListener('click', (e) => {
        if (bulkSelectionMode) {
            e.preventDefault();
            if (selectedChats.has(chat.id)) {
                selectedChats.delete(chat.id);
            } else {
                selectedChats.add(chat.id);
            }
            updateBulkSelectionCount();
            renderChatList();
        } else {
            selectChat(chat.id);
        }
    });
    
    return div;
}

// Select chat
function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (chat) {
        document.getElementById('chatTitle').textContent = chat.title;
        document.getElementById('chatMessages').innerHTML = '';
        renderMessages(chat);
        
        // Show action buttons
        document.getElementById('editTitleBtn').style.display = 'block';
        document.getElementById('moveToFolderBtn').style.display = 'block';
        document.getElementById('deleteChatBtn').style.display = 'block';
        document.getElementById('exportChatBtn').style.display = 'block';
        document.getElementById('modelSettingsBtn').style.display = 'block';
        
        renderChatList();
        document.getElementById('chatInputContainer').style.display = 'block';
        populateProviderSelector();
    }
}

// Render messages
function renderMessages(chat) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = '';
    
    chat.messages.forEach(message => {
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
    });
    
    // Scroll to top
    messagesContainer.scrollTop = 0;
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    
    const avatar = message.role === 'user' ? 'U' : 'AI';
    const roleDisplay = message.role === 'user' ? 'You' : 'Assistant';
    
    const timestamp = message.timestamp
        ? new Date(message.timestamp > 1000000000000 ? message.timestamp : message.timestamp * 1000).toLocaleString()
        : '';
    
    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-role">${roleDisplay}</div>
            <div class="message-text">${escapeHtml(message.content)}</div>
            ${timestamp ? `<div class="message-timestamp">${timestamp}</div>` : ''}
        </div>
    `;
    
    return div;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show folder modal
function showFolderModal() {
    document.getElementById('folderModal').style.display = 'flex';
    document.getElementById('folderNameInput').value = '';
    document.getElementById('folderNameInput').focus();
}

// Hide folder modal
function hideFolderModal() {
    document.getElementById('folderModal').style.display = 'none';
}

// Create folder
function createFolder() {
    const folderName = document.getElementById('folderNameInput').value.trim();
    
    if (!folderName) {
        showNotification('Please enter a folder name', 'error');
        return;
    }
    
    const newFolder = {
        id: generateId(),
        name: folderName,
        isSystem: false
    };
    
    folders.push(newFolder);
    saveDataToStorage();
    renderFolders();
    hideFolderModal();
    showNotification(`Folder "${folderName}" created`);
}

// Show move modal
function showMoveModal() {
    const modal = document.getElementById('moveModal');
    const folderSelectList = document.getElementById('folderSelectList');
    
    folderSelectList.innerHTML = '';
    
    folders.forEach(folder => {
        const div = document.createElement('div');
        div.className = 'folder-select-item';
        div.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <span>${folder.name}</span>
        `;
        div.addEventListener('click', () => moveToFolder(folder.id));
        folderSelectList.appendChild(div);
    });
    
    modal.style.display = 'flex';
}

// Hide move modal
function hideMoveModal() {
    document.getElementById('moveModal').style.display = 'none';
}

// Move to folder
function moveToFolder(folderId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) {
        chat.folderId = folderId;
        saveDataToStorage();
        renderChatList();
        updateFolderCounts();
        hideMoveModal();
        showNotification('Chat moved successfully');
    }
}

// Edit chat title
function editChatTitle() {
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    const newTitle = prompt('Enter new title:', chat.title);
    if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim();
        saveDataToStorage();
        document.getElementById('chatTitle').textContent = chat.title;
        renderChatList();
        showNotification('Title updated');
    }
}

// Delete chat
function deleteChat() {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    const index = chats.findIndex(c => c.id === currentChatId);
    if (index !== -1) {
        chats.splice(index, 1);
        saveDataToStorage();
        renderChatList();
        updateFolderCounts();
        
        // Clear the main content
        document.getElementById('chatTitle').textContent = 'Select a conversation';
        document.getElementById('chatMessages').innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" opacity="0.3">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <p>Select a conversation to view</p>
                <p class="empty-state-hint">Import your chat exports to get started</p>
            </div>
        `;
        
        // Hide action buttons
        document.getElementById('editTitleBtn').style.display = 'none';
        document.getElementById('moveToFolderBtn').style.display = 'none';
        document.getElementById('deleteChatBtn').style.display = 'none';
        document.getElementById('exportChatBtn').style.display = 'none';
        
        currentChatId = null;
        showNotification('Conversation deleted');
    }
}

// Popuplate provider selector
function populateProviderSelector() {
    const providerSelect = document.getElementById('providerSelect');
    providerSelect.innerHTML = '<option value="">Select a provider</option>';
    
    for (const provider in apiSettings) {
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
        providerSelect.appendChild(option);
    }

    if (currentProvider) {
        providerSelect.value = currentProvider;
    }
    populateModelSelector();
}

// Populate model selector
async function populateModelSelector() {
    const modelSelect = document.getElementById('modelSelect');
    modelSelect.innerHTML = '<option value="">Select a model</option>';
    modelSelect.disabled = true;

    if (!currentProvider) return;

    const models = apiSettings[currentProvider].models;
    
    if (currentProvider === 'ollama') {
        try {
            const response = await fetch(`${apiSettings.ollama.url}/api/tags`);
            const data = await response.json();
            apiSettings.ollama.models = data.models.map(m => m.name);
            saveApiSettings();
        } catch (error) {
            console.error('Error fetching Ollama models:', error);
            showNotification('Could not fetch models from Ollama. Is it running?', 'error');
            return;
        }
    }

    if (apiSettings[currentProvider].models.length > 0) {
        modelSelect.disabled = false;
        apiSettings[currentProvider].models.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
        if (currentModel) {
            modelSelect.value = currentModel;
        }
    }
}

// Send message
async function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const messageText = chatInput.value.trim();

    if (!messageText || !currentChatId || !currentProvider || !currentModel) {
        showNotification('Please select a provider and model first.', 'error');
        return;
    }

    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;

    const userMessage = { role: 'user', content: messageText, timestamp: Date.now() };
    chat.messages.push(userMessage);

    const assistantMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    chat.messages.push(assistantMessage);

    renderMessages(chat);
    chatInput.value = '';
    chatInput.focus();

    const messageElement = document.querySelector('.message:last-child .message-text');
    const cursorSpan = document.createElement('span');
    cursorSpan.className = 'blinking-cursor';
    cursorSpan.innerHTML = '&#9646;';
    messageElement.appendChild(cursorSpan);

    if (currentProvider === 'ollama') {
        await streamOllamaResponse(chat, assistantMessage, messageElement, cursorSpan);
    } else {
        // Placeholder for other providers
        await new Promise(resolve => setTimeout(resolve, 1000));
        assistantMessage.content = `(Simulated response for ${currentProvider})`;
        messageElement.textContent = assistantMessage.content;
        saveDataToStorage();
    }
}

async function streamOllamaResponse(chat, assistantMessage, messageElement, cursorSpan) {
    try {
        const response = await fetch(`${apiSettings.ollama.url}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                messages: chat.messages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                stream: true,
            }),
        });

        if (!response.body) {
            throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                const parsed = JSON.parse(line);
                if (parsed.message && parsed.message.content) {
                    fullResponse += parsed.message.content;
                    assistantMessage.content = fullResponse;
                    // Use a temporary div to escape HTML before setting innerHTML
                    const tempDiv = document.createElement('div');
                    tempDiv.textContent = fullResponse;
                    messageElement.innerHTML = tempDiv.innerHTML;
                    messageElement.appendChild(cursorSpan);
                }
                if (parsed.done) {
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Ollama API error:', error);
        assistantMessage.content = `Error: Could not connect to Ollama. ${error.message}`;
        messageElement.textContent = assistantMessage.content;
        showNotification('Error connecting to Ollama. Is it running?', 'error');
    } finally {
        cursorSpan.remove();
        saveDataToStorage();
    }
}

// Update folder counts
function updateFolderCounts() {
    renderFolders();
}

// Show notification
function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background-color: ${type === 'success' ? '#10a37f' : '#ef4444'};
        color: white;
        border-radius: 6px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 300);
    }, 3000);
}

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // Ctrl/Cmd + N for new folder
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        showFolderModal();
    }
    
    // Delete key for deleting chat
    if (e.key === 'Delete' && currentChatId) {
        deleteChat();
    }
});

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Initialize drag and drop
function initializeDragAndDrop() {
    const dropZone = document.body;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropZone.classList.add('drag-highlight');
    }
    
    function unhighlight(e) {
        dropZone.classList.remove('drag-highlight');
    }
    
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        handleFileImport({ target: { files: files } });
    }
}

// Initialize auto-save
function initializeAutoSave() {
    // Auto-save every 30 seconds if there are changes
    setInterval(() => {
        if (document.querySelector('.unsaved-indicator')) {
            saveDataToStorage();
            document.querySelector('.unsaved-indicator')?.classList.remove('unsaved-indicator');
        }
    }, 30000);
}

// Save search history
function saveSearchHistory(query) {
    if (!query.trim()) return;
    
    let searchHistory = JSON.parse(localStorage.getItem('aiChatArchive_searchHistory') || '[]');
    searchHistory = searchHistory.filter(q => q !== query);
    searchHistory.unshift(query);
    searchHistory = searchHistory.slice(0, 10); // Keep last 10 searches
    
    localStorage.setItem('aiChatArchive_searchHistory', JSON.stringify(searchHistory));
}

// Calculate message hash for duplicate detection
function calculateMessageHash(message) {
    const content = message.content.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

// Check if conversation is duplicate
function isDuplicateConversation(newChat, existingChats) {
    if (newChat.messages.length === 0) return false;
    
    // Create hash of first few messages
    const newHashes = newChat.messages.slice(0, 5).map(calculateMessageHash).join('|');
    
    for (const existingChat of existingChats) {
        if (existingChat.messages.length === 0) continue;
        
        const existingHashes = existingChat.messages.slice(0, 5).map(calculateMessageHash).join('|');
        
        if (newHashes === existingHashes) {
            return true;
        }
    }
    
    return false;
}

// Auto-tag conversations based on content
function autoTagConversation(chat) {
    const tags = new Set();
    const content = chat.messages.map(m => m.content).join(' ').toLowerCase();
    
    // Programming language detection
    const languages = {
        'javascript': /\b(javascript|js|node|npm|react|vue|angular)\b/gi,
        'python': /\b(python|pip|django|flask|pandas|numpy)\b/gi,
        'java': /\b(java|spring|maven|gradle)\b/gi,
        'csharp': /\b(c#|csharp|\.net|asp\.net)\b/gi,
        'sql': /\b(sql|database|query|select|insert|update)\b/gi,
        'html-css': /\b(html|css|scss|sass|tailwind)\b/gi,
        'devops': /\b(docker|kubernetes|k8s|ci\/cd|jenkins|aws|azure)\b/gi,
        'ai-ml': /\b(machine learning|ml|ai|neural|tensorflow|pytorch)\b/gi,
    };
    
    for (const [tag, regex] of Object.entries(languages)) {
        if (regex.test(content)) {
            tags.add(tag);
        }
    }
    
    // Topic detection
    const topics = {
        'debugging': /\b(debug|error|bug|fix|issue|problem)\b/gi,
        'tutorial': /\b(how to|tutorial|guide|learn|example)\b/gi,
        'code-review': /\b(review|feedback|improve|refactor|optimize)\b/gi,
        'architecture': /\b(architecture|design|pattern|structure|system)\b/gi,
        'api': /\b(api|endpoint|rest|graphql|webhook)\b/gi,
    };
    
    for (const [tag, regex] of Object.entries(topics)) {
        if (regex.test(content)) {
            tags.add(tag);
        }
    }
    
    // Code detection
    if (/```[\s\S]*?```|`[^`]+`/.test(content)) {
        tags.add('has-code');
    }
    
    chat.tags = Array.from(tags);
    return chat;
}

// API Settings Modal
function showApiSettingsModal() {
    document.getElementById('ollamaUrl').value = apiSettings.ollama.url;
    document.getElementById('huggingfaceApiKey').value = apiSettings.huggingface.apiKey;
    document.getElementById('openrouterApiKey').value = apiSettings.openrouter.apiKey;
    document.getElementById('apiSettingsModal').style.display = 'flex';
}

function hideApiSettingsModal() {
    document.getElementById('apiSettingsModal').style.display = 'none';
}

function saveApiSettingsFromModal() {
    apiSettings.ollama.url = document.getElementById('ollamaUrl').value.trim();
    apiSettings.huggingface.apiKey = document.getElementById('huggingfaceApiKey').value.trim();
    apiSettings.openrouter.apiKey = document.getElementById('openrouterApiKey').value.trim();
    
    saveApiSettings();
    hideApiSettingsModal();
    showNotification('API settings saved successfully');
    
    // Re-populate selectors if a chat is open
    if (currentChatId) {
        populateProviderSelector();
    }
}

// Show export modal
function showExportModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'exportModal';
    
    const isExportingAll = !currentChatId;
    const chatToExport = currentChatId ? chats.find(c => c.id === currentChatId) : null;
    
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <h3>Export ${isExportingAll ? 'All Conversations' : 'Conversation'}</h3>
            <div class="export-options">
                <h4>Select Export Format:</h4>
                <div class="export-format-grid">
                    <button class="export-format-btn" data-format="json">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>JSON</span>
                        <small>Original format with all metadata</small>
                    </button>
                    <button class="export-format-btn" data-format="markdown">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                        </svg>
                        <span>Markdown</span>
                        <small>Formatted text with code blocks</small>
                    </button>
                    <button class="export-format-btn" data-format="txt">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>Plain Text</span>
                        <small>Simple text format</small>
                    </button>
                    <button class="export-format-btn" data-format="html">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        <span>HTML</span>
                        <small>Standalone web page</small>
                    </button>
                </div>
                ${isExportingAll ? `
                <div class="export-filter-options">
                    <h4>Filter Options:</h4>
                    <label>
                        <input type="checkbox" id="exportByFolder" checked>
                        Organize by folders
                    </label>
                    <label>
                        <input type="checkbox" id="exportWithTags" checked>
                        Include tags
                    </label>
                </div>
                ` : ''}
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('exportModal').remove()">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners to format buttons
    modal.querySelectorAll('.export-format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const format = btn.dataset.format;
            if (isExportingAll) {
                exportAllChatsInFormat(format);
            } else {
                exportChatInFormat(chatToExport, format);
            }
            modal.remove();
        });
    });
}

// Export chat in specific format
function exportChatInFormat(chat, format) {
    if (!chat) return;
    
    let content, filename, mimeType;
    
    switch (format) {
        case 'markdown':
            content = convertChatToMarkdown(chat);
            filename = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
            mimeType = 'text/markdown';
            break;
        case 'txt':
            content = convertChatToText(chat);
            filename = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
            mimeType = 'text/plain';
            break;
        case 'html':
            content = convertChatToHTML(chat);
            filename = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
            mimeType = 'text/html';
            break;
        default: // json
            content = JSON.stringify(chat, null, 2);
            filename = `${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            mimeType = 'application/json';
    }
    
    downloadData(content, filename, mimeType);
    showNotification(`Exported "${chat.title}" as ${format.toUpperCase()}`);
}

// Export all chats in specific format
function exportAllChatsInFormat(format) {
    const organizeByFolders = document.getElementById('exportByFolder')?.checked ?? true;
    const includeTags = document.getElementById('exportWithTags')?.checked ?? true;
    
    let content, filename, mimeType;
    
    switch (format) {
        case 'markdown':
            content = convertAllChatsToMarkdown(chats, organizeByFolders, includeTags);
            filename = 'ai-chat-archive-export.md';
            mimeType = 'text/markdown';
            break;
        case 'txt':
            content = convertAllChatsToText(chats, organizeByFolders);
            filename = 'ai-chat-archive-export.txt';
            mimeType = 'text/plain';
            break;
        case 'html':
            content = convertAllChatsToHTML(chats, organizeByFolders, includeTags);
            filename = 'ai-chat-archive-export.html';
            mimeType = 'text/html';
            break;
        default: // json
            content = JSON.stringify(chats, null, 2);
            filename = 'ai-chat-archive-export.json';
            mimeType = 'application/json';
    }
    
    downloadData(content, filename, mimeType);
    showNotification(`Exported ${chats.length} conversations as ${format.toUpperCase()}`);
}

// Convert chat to Markdown
function convertChatToMarkdown(chat) {
    let markdown = `# ${chat.title}\n\n`;
    markdown += `**Date:** ${new Date(chat.createdAt).toLocaleString()}\n`;
    markdown += `**Source:** ${chat.source}\n`;
    
    if (chat.tags && chat.tags.length > 0) {
        markdown += `**Tags:** ${chat.tags.join(', ')}\n`;
    }
    
    markdown += '\n---\n\n';
    
    chat.messages.forEach(msg => {
        markdown += `## ${msg.role === 'user' ? 'You' : 'Assistant'}\n\n`;
        markdown += `${msg.content}\n\n`;
    });
    
    return markdown;
}

// Convert chat to plain text
function convertChatToText(chat) {
    let text = `${chat.title}\n${'='.repeat(chat.title.length)}\n\n`;
    text += `Date: ${new Date(chat.createdAt).toLocaleString()}\n`;
    text += `Source: ${chat.source}\n\n`;
    
    chat.messages.forEach(msg => {
        text += `${msg.role === 'user' ? 'You' : 'Assistant'}:\n`;
        text += `${msg.content}\n\n`;
        text += '-'.repeat(40) + '\n\n';
    });
    
    return text;
}

// Convert chat to HTML
function convertChatToHTML(chat) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${chat.title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .user { background-color: #f0f0f0; }
        .assistant { background-color: #e3f2fd; }
        .role { font-weight: bold; margin-bottom: 5px; }
        .timestamp { font-size: 0.8em; color: #666; }
        pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        .tags { margin: 10px 0; }
        .tag { display: inline-block; background-color: #e0e0e0; padding: 4px 8px; border-radius: 4px; margin-right: 5px; font-size: 0.9em; }
    </style>
</head>
<body>
    <h1>${chat.title}</h1>
    <p><strong>Date:</strong> ${new Date(chat.createdAt).toLocaleString()}</p>
    <p><strong>Source:</strong> ${chat.source}</p>
    ${chat.tags && chat.tags.length > 0 ? `<div class="tags">${chat.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
    <hr>
    ${chat.messages.map(msg => `
        <div class="message ${msg.role}">
            <div class="role">${msg.role === 'user' ? 'You' : 'Assistant'}</div>
            <div>${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
            ${msg.timestamp ? `<div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
    
    return html;
}

// Convert all chats to Markdown
function convertAllChatsToMarkdown(chats, organizeByFolders, includeTags) {
    let markdown = '# AI Chat Archive Export\n\n';
    markdown += `**Export Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Conversations:** ${chats.length}\n\n`;
    
    if (organizeByFolders) {
        const chatsByFolder = {};
        chats.forEach(chat => {
            const folder = folders.find(f => f.id === chat.folderId)?.name || 'Uncategorized';
            if (!chatsByFolder[folder]) chatsByFolder[folder] = [];
            chatsByFolder[folder].push(chat);
        });
        
        Object.entries(chatsByFolder).forEach(([folderName, folderChats]) => {
            markdown += `## 📁 ${folderName}\n\n`;
            folderChats.forEach(chat => {
                markdown += `### ${chat.title}\n`;
                markdown += `- **Date:** ${new Date(chat.createdAt).toLocaleDateString()}\n`;
                markdown += `- **Source:** ${chat.source}\n`;
                if (includeTags && chat.tags && chat.tags.length > 0) {
                    markdown += `- **Tags:** ${chat.tags.join(', ')}\n`;
                }
                markdown += '\n';
            });
        });
    } else {
        chats.forEach(chat => {
            markdown += `## ${chat.title}\n`;
            markdown += `- **Date:** ${new Date(chat.createdAt).toLocaleDateString()}\n`;
            markdown += `- **Source:** ${chat.source}\n`;
            if (includeTags && chat.tags && chat.tags.length > 0) {
                markdown += `- **Tags:** ${chat.tags.join(', ')}\n`;
            }
            markdown += '\n';
        });
    }
    
    return markdown;
}

// Convert all chats to plain text
function convertAllChatsToText(chats, organizeByFolders) {
    let text = 'AI CHAT ARCHIVE EXPORT\n';
    text += '======================\n\n';
    text += `Export Date: ${new Date().toLocaleString()}\n`;
    text += `Total Conversations: ${chats.length}\n\n`;
    
    if (organizeByFolders) {
        const chatsByFolder = {};
        chats.forEach(chat => {
            const folder = folders.find(f => f.id === chat.folderId)?.name || 'Uncategorized';
            if (!chatsByFolder[folder]) chatsByFolder[folder] = [];
            chatsByFolder[folder].push(chat);
        });
        
        Object.entries(chatsByFolder).forEach(([folderName, folderChats]) => {
            text += `\n[${folderName}]\n${'-'.repeat(folderName.length + 2)}\n\n`;
            folderChats.forEach(chat => {
                text += `* ${chat.title} (${new Date(chat.createdAt).toLocaleDateString()})\n`;
            });
        });
    } else {
        chats.forEach(chat => {
            text += `* ${chat.title} (${new Date(chat.createdAt).toLocaleDateString()})\n`;
        });
    }
    
    return text;
}

// Convert all chats to HTML
function convertAllChatsToHTML(chats, organizeByFolders, includeTags) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Chat Archive Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #333; }
        .folder { margin-bottom: 30px; }
        .chat-item { margin: 10px 0; padding: 10px; background-color: #f5f5f5; border-radius: 8px; }
        .chat-item:hover { background-color: #e0e0e0; }
        .meta { font-size: 0.9em; color: #666; }
        .tags { margin-top: 5px; }
        .tag { display: inline-block; background-color: #e0e0e0; padding: 2px 6px; border-radius: 3px; margin-right: 5px; font-size: 0.8em; }
        a { color: #1976d2; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>AI Chat Archive Export</h1>
    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Conversations:</strong> ${chats.length}</p>
    <hr>
    ${organizeByFolders ?
        Object.entries(chats.reduce((acc, chat) => {
            const folder = folders.find(f => f.id === chat.folderId)?.name || 'Uncategorized';
            if (!acc[folder]) acc[folder] = [];
            acc[folder].push(chat);
            return acc;
        }, {})).map(([folderName, folderChats]) => `
            <div class="folder">
                <h2>📁 ${folderName}</h2>
                ${folderChats.map((chat, index) => `
                    <div class="chat-item">
                        <h3><a href="#chat-${chat.id}">${chat.title}</a></h3>
                        <div class="meta">
                            <span>Date: ${new Date(chat.createdAt).toLocaleDateString()}</span> |
                            <span>Source: ${chat.source}</span> |
                            <span>Messages: ${chat.messages.length}</span>
                        </div>
                        ${includeTags && chat.tags && chat.tags.length > 0 ?
                            `<div class="tags">${chat.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `).join('') :
        chats.map(chat => `
            <div class="chat-item">
                <h3><a href="#chat-${chat.id}">${chat.title}</a></h3>
                <div class="meta">
                    <span>Date: ${new Date(chat.createdAt).toLocaleDateString()}</span> |
                    <span>Source: ${chat.source}</span> |
                    <span>Messages: ${chat.messages.length}</span>
                </div>
                ${includeTags && chat.tags && chat.tags.length > 0 ?
                    `<div class="tags">${chat.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
            </div>
        `).join('')
    }
</body>
</html>`;
    
    return html;
}

// Helper function to trigger a download
function downloadData(data, filename, type) {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function populateSourceFilter() {
    const sourceFilter = document.getElementById('sourceFilter');
    const existingSources = new Set(Array.from(sourceFilter.options).map(opt => opt.value));
    
    const allSources = new Set(chats.map(chat => chat.source).filter(Boolean));
    allSources.forEach(source => {
        if (!existingSources.has(source)) {
            const option = document.createElement('option');
            option.value = source;
            option.textContent = source;
            sourceFilter.appendChild(option);
        }
    });
}

// Show analytics dashboard
function showAnalytics() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'analyticsModal';
    
    const analytics = calculateAnalytics();
    
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <h3>📊 Chat Analytics</h3>
            <div class="analytics-container">
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.totalChats}</div>
                        <div class="analytics-label">Total Conversations</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.totalMessages}</div>
                        <div class="analytics-label">Total Messages</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.avgMessagesPerChat}</div>
                        <div class="analytics-label">Avg Messages/Chat</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.totalWords.toLocaleString()}</div>
                        <div class="analytics-label">Total Words</div>
                    </div>
                </div>
                
                <div class="analytics-section">
                    <h4>📅 Activity Over Time</h4>
                    <div class="activity-chart">
                        ${generateActivityChart(analytics.activityByMonth)}
                    </div>
                </div>
                
                <div class="analytics-section">
                    <h4>🏷️ Top Tags</h4>
                    <div class="tag-cloud">
                        ${analytics.topTags.map(([tag, count]) =>
                            `<span class="tag-cloud-item" style="font-size: ${Math.min(24, 12 + count * 2)}px">${tag} (${count})</span>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="analytics-section">
                    <h4>💬 Sources</h4>
                    <div class="source-stats">
                        ${analytics.sourceBreakdown.map(([source, count]) => `
                            <div class="source-stat">
                                <span class="source-name">${source}</span>
                                <div class="source-bar-container">
                                    <div class="source-bar" style="width: ${(count / analytics.totalChats * 100)}%"></div>
                                </div>
                                <span class="source-count">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="analytics-section">
                    <h4>💻 Code Languages Detected</h4>
                    <div class="language-stats">
                        ${analytics.codeLanguages.map(([lang, count]) =>
                            `<span class="language-badge">${lang} (${count})</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-primary" onclick="exportAnalytics()">Export Report</button>
                <button class="btn-secondary" onclick="document.getElementById('analyticsModal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Calculate analytics
function calculateAnalytics() {
    const analytics = {
        totalChats: chats.length,
        totalMessages: 0,
        totalWords: 0,
        avgMessagesPerChat: 0,
        activityByMonth: {},
        topTags: [],
        sourceBreakdown: [],
        codeLanguages: []
    };
    
    const tagCounts = {};
    const sourceCounts = {};
    const languageCounts = {};
    
    chats.forEach(chat => {
        // Count messages and words
        analytics.totalMessages += chat.messages.length;
        chat.messages.forEach(msg => {
            analytics.totalWords += msg.content.split(/\s+/).length;
        });
        
        // Activity by month
        const monthKey = new Date(chat.createdAt).toISOString().slice(0, 7);
        analytics.activityByMonth[monthKey] = (analytics.activityByMonth[monthKey] || 0) + 1;
        
        // Count tags
        if (chat.tags) {
            chat.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                
                // Count programming languages
                if (tag.match(/^(javascript|python|java|csharp|sql|html-css|typescript|go|rust|cpp|php)$/)) {
                    languageCounts[tag] = (languageCounts[tag] || 0) + 1;
                }
            });
        }
        
        // Count sources
        if (chat.source) {
            sourceCounts[chat.source] = (sourceCounts[chat.source] || 0) + 1;
        }
    });
    
    // Calculate averages
    analytics.avgMessagesPerChat = Math.round(analytics.totalMessages / analytics.totalChats) || 0;
    
    // Sort and get top items
    analytics.topTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15);
    
    analytics.sourceBreakdown = Object.entries(sourceCounts)
        .sort(([,a], [,b]) => b - a);
    
    analytics.codeLanguages = Object.entries(languageCounts)
        .sort(([,a], [,b]) => b - a);
    
    return analytics;
}

// Generate activity chart
function generateActivityChart(activityByMonth) {
    const months = Object.keys(activityByMonth).sort();
    if (months.length === 0) return '<p>No activity data available</p>';
    
    const maxCount = Math.max(...Object.values(activityByMonth));
    const chartHeight = 150;
    
    return `
        <div class="activity-chart-container">
            ${months.map(month => {
                const count = activityByMonth[month];
                const height = (count / maxCount) * chartHeight;
                const [year, monthNum] = month.split('-');
                const monthName = new Date(year, monthNum - 1).toLocaleDateString('en', { month: 'short' });
                
                return `
                    <div class="activity-bar-wrapper">
                        <div class="activity-bar" style="height: ${height}px" title="${count} chats in ${monthName} ${year}">
                            <span class="activity-count">${count}</span>
                        </div>
                        <div class="activity-label">${monthName}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Export analytics report
function exportAnalytics() {
    const analytics = calculateAnalytics();
    let report = '# AI Chat Archive Analytics Report\n\n';
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    report += '## Summary\n\n';
    report += `- **Total Conversations:** ${analytics.totalChats}\n`;
    report += `- **Total Messages:** ${analytics.totalMessages}\n`;
    report += `- **Average Messages per Chat:** ${analytics.avgMessagesPerChat}\n`;
    report += `- **Total Words:** ${analytics.totalWords.toLocaleString()}\n\n`;
    
    report += '## Activity Over Time\n\n';
    Object.entries(analytics.activityByMonth).sort().forEach(([month, count]) => {
        report += `- ${month}: ${count} conversations\n`;
    });
    
    report += '\n## Top Tags\n\n';
    analytics.topTags.forEach(([tag, count]) => {
        report += `- ${tag}: ${count} occurrences\n`;
    });
    
    report += '\n## Sources\n\n';
    analytics.sourceBreakdown.forEach(([source, count]) => {
        report += `- ${source}: ${count} conversations\n`;
    });
    
    downloadData(report, 'chat-analytics-report.md', 'text/markdown');
    showNotification('Analytics report exported');
}

// Toggle bulk selection mode
let bulkSelectionMode = false;
let selectedChats = new Set();

function toggleBulkSelection() {
    bulkSelectionMode = !bulkSelectionMode;
    selectedChats.clear();
    
    const bulkActionsBtn = document.getElementById('bulkActionsBtn');
    if (bulkSelectionMode) {
        bulkActionsBtn.textContent = 'Cancel Selection';
        bulkActionsBtn.classList.add('active');
        showBulkActionBar();
    } else {
        bulkActionsBtn.textContent = 'Bulk Actions';
        bulkActionsBtn.classList.remove('active');
        hideBulkActionBar();
    }
    
    renderChatList();
}

// Show bulk action bar
function showBulkActionBar() {
    const existingBar = document.getElementById('bulkActionBar');
    if (existingBar) return;
    
    const bar = document.createElement('div');
    bar.id = 'bulkActionBar';
    bar.className = 'bulk-action-bar';
    bar.innerHTML = `
        <span class="bulk-selection-count">0 selected</span>
        <div class="bulk-actions">
            <button onclick="selectAllChats()">Select All</button>
            <button onclick="bulkMoveToFolder()">Move to Folder</button>
            <button onclick="bulkAddTags()">Add Tags</button>
            <button onclick="bulkExport()">Export Selected</button>
            <button onclick="bulkDelete()" class="danger">Delete Selected</button>
        </div>
    `;
    
    document.querySelector('.sidebar').appendChild(bar);
}

// Hide bulk action bar
function hideBulkActionBar() {
    document.getElementById('bulkActionBar')?.remove();
}

// Select all visible chats
function selectAllChats() {
    const visibleChatIds = Array.from(document.querySelectorAll('.chat-item'))
        .map(el => el.dataset.chatId);
    
    visibleChatIds.forEach(id => selectedChats.add(id));
    updateBulkSelectionCount();
    renderChatList();
}

// Update bulk selection count
function updateBulkSelectionCount() {
    const countEl = document.querySelector('.bulk-selection-count');
    if (countEl) {
        countEl.textContent = `${selectedChats.size} selected`;
    }
}

// Bulk operations
function bulkMoveToFolder() {
    if (selectedChats.size === 0) {
        showNotification('No chats selected', 'error');
        return;
    }
    
    // Show folder selection modal
    showMoveModal(true);
}

function bulkAddTags() {
    if (selectedChats.size === 0) {
        showNotification('No chats selected', 'error');
        return;
    }
    
    const tags = prompt('Enter tags to add (comma-separated):');
    if (tags) {
        const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
        
        selectedChats.forEach(chatId => {
            const chat = chats.find(c => c.id === chatId);
            if (chat) {
                if (!chat.tags) chat.tags = [];
                chat.tags = [...new Set([...chat.tags, ...tagList])];
            }
        });
        
        saveDataToStorage();
        renderChatList();
        showNotification(`Added tags to ${selectedChats.size} chats`);
    }
}

function bulkExport() {
    if (selectedChats.size === 0) {
        showNotification('No chats selected', 'error');
        return;
    }
    
    const selectedChatObjects = chats.filter(c => selectedChats.has(c.id));
    const filename = `selected-chats-export-${Date.now()}.json`;
    const jsonStr = JSON.stringify(selectedChatObjects, null, 2);
    downloadData(jsonStr, filename, 'application/json');
    showNotification(`Exported ${selectedChats.size} chats`);
}

function bulkDelete() {
    if (selectedChats.size === 0) {
        showNotification('No chats selected', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedChats.size} conversations?`)) return;
    
    chats = chats.filter(c => !selectedChats.has(c.id));
    saveDataToStorage();
    toggleBulkSelection();
    renderChatList();
    updateFolderCounts();
    showNotification(`Deleted ${selectedChats.size} conversations`);
}
