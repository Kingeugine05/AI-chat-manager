# AI Chat Archive Manager

A web-based application for importing, viewing, and organizing your exported conversations from various AI platforms like ChatGPT, Claude, and others.

## Features

- **Import Multiple Formats**: Supports ChatGPT and Claude export formats (JSON, HTML, Markdown) and a generic JSON format.
- **Organized Folder System**: Create custom folders to organize your conversations.
- **Search Functionality**: Search through all your conversations by title or content.
- **Clean Chat Interface**: View conversations in a familiar chat-like interface.
- **Local Storage**: All data is stored locally in your browser for privacy.
- **Ollama Integration**: Connects to Ollama for dynamic model selection and streaming responses.

## Getting Started

To run this application locally, follow these steps:

1.  **Clone the repository** (if applicable, otherwise ensure all files are in a single directory).
2.  **Install dependencies**: Navigate to the project root in your terminal and run:

    ```bash
    npm install
    ```

3.  **Start the server**: Run the following command:

    ```bash
    npm start
    ```

    This will start a Node.js server, typically on `http://localhost:3000`.

4.  **Open in browser**: Open your web browser and navigate to `http://localhost:3000`.

## Export Format Support

### Generic Format
You can also import a generic format:

```json
{
  "title": "Conversation Title",
  "messages": [
    {
      "role": "user",
      "content": "User message",
      "timestamp": 1704067200
    },
    {
      "role": "assistant", 
      "content": "AI response",
      "timestamp": 1704067260
    }
  ],
  "source": "AI Platform Name",
  "created_at": 1704067200
}
```