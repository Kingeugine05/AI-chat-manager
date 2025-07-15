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
        url: 'http://localhost:11434',
        models: []
    },
    huggingface: {
        apiKey: '',
        models: [
            'mistralai/Mistral-7B-Instruct-v0.2',
            'meta-llama/Llama-2-7b-chat-hf',
            'google/flan-t5-xxl',
            'bigscience/bloom',
            'EleutherAI/gpt-j-6B'
        ]
    },
    openrouter: {
        apiKey: '',
        models: [
            'openai/gpt-3.5-turbo',
            'openai/gpt-4',
            'anthropic/claude-2',
            'anthropic/claude-instant-1',
            'meta-llama/llama-2-70b-chat',
            'google/palm-2-chat-bison'
        ]
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    loadApiSettings();
    loadDataFromStorage();
    initializeEventListeners();
    renderFolders();
    renderChatList();
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
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderChatList(e.target.value);
    });
    
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
    
    // Click outside modal to close
    document.getElementById('folderModal').addEventListener('click', (e) => {
        if (e.target.id === 'folderModal') hideFolderModal();
    });
    document.getElementById('moveModal').addEventListener('click', (e) => {
        if (e.target.id === 'moveModal') hideMoveModal();
    });
}

// File import handler
async function handleFileImport(event) {
    const files = event.target.files;
    
    for (const file of files) {
        try {
            const content = await readFile(file);
            const parsedChats = parseExportFile(content, file.name);
            
            if (parsedChats && parsedChats.length > 0) {
                chats.push(...parsedChats);
                saveDataToStorage();
                renderChatList();
                updateFolderCounts();
                showNotification(`Imported ${parsedChats.length} conversations from ${file.name}`);
            }
        } catch (error) {
            console.error('Error importing file:', error);
            showNotification(`Error importing ${file.name}: ${error.message}`, 'error');
        }
    }
    
    // Reset file input
    event.target.value = '';
}

// Read file content
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

// Parse generic export format
function parseGenericExport(data) {
    const messages = data.messages.map(msg => ({
        role: msg.role || (msg.sender === 'human' ? 'user' : 'assistant'),
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || msg.created_at
    }));
    
    return [{
        id: generateId(),
        title: data.title || 'Imported Conversation',
        messages: messages,
        source: data.source || 'Unknown',
        createdAt: data.created_at || Date.now(),
        folderId: 'all'
    }];
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Render folders
function renderFolders() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';
    
    folders.forEach(folder => {
        const folderItem = createFolderElement(folder);
        folderList.appendChild(folderItem);
    });
}

// Create folder element
function createFolderElement(folder) {
    const div = document.createElement('div');
    div.className = `folder-item ${folder.id === currentFolderId ? 'active' : ''}`;
    div.dataset.folderId = folder.id;
    
    const chatCount = folder.id === 'all' 
        ? chats.length 
        : chats.filter(chat => chat.folderId === folder.id).length;
    
    div.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            ${folder.id === 'all' 
                ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>'
                : '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>'
            }
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
    document.querySelectorAll('.folder-item').forEach(item => {
        item.classList.toggle('active', item.dataset.folderId === folderId);
    });
    renderChatList();
}

// Render chat list
function renderChatList(searchQuery = '') {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    let filteredChats = chats;
    
    // Filter by folder
    if (currentFolderId !== 'all') {
        filteredChats = filteredChats.filter(chat => chat.folderId === currentFolderId);
    }
    
    // Filter by search query
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredChats = filteredChats.filter(chat => {
            return chat.title.toLowerCase().includes(query) ||
                   chat.messages.some(msg => msg.content.toLowerCase().includes(query));
        });
    }
    
    // Sort by creation date (newest first)
    filteredChats.sort((a, b) => b.createdAt - a.createdAt);
    
    // Render chat items
    filteredChats.forEach(chat => {
        const chatItem = createChatElement(chat);
        chatList.appendChild(chatItem);
    });
    
    if (filteredChats.length === 0) {
        chatList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No conversations found</div>';
    }
}

// Create chat element
function createChatElement(chat) {
    const div = document.createElement('div');
    div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
    div.dataset.chatId = chat.id;
    
    const preview = chat.messages.length > 0 
        ? chat.messages[0].content.substring(0, 100) + '...'
        : 'No messages';
    
    const date = new Date(chat.createdAt).toLocaleDateString();
    
    div.innerHTML = `
        <div class="chat-item-title">${chat.title}</div>
        <div class="chat-item-preview">${preview}</div>
        <div class="chat-item-meta">
            <span>${chat.source}</span>
            <span>${date}</span>
        </div>
    `;
    
    div.addEventListener('click', () => selectChat(chat.id));
    
    return div;
}

// Select chat
function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chatId === chatId);
    });
    
    // Update header
    document.getElementById('chatTitle').textContent = chat.title;
    document.getElementById('editTitleBtn').style.display = 'inline-flex';
    document.getElementById('moveToFolderBtn').style.display = 'inline-flex';
    document.getElementById('deleteChatBtn').style.display = 'inline-flex';
    
    // Render messages
    renderMessages(chat);
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
        ? new Date(message.timestamp * 1000).toLocaleString()
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
        
        currentChatId = null;
        showNotification('Conversation deleted');
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