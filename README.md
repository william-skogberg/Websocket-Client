# WebSocket browser client

Browser-based WS Pastebin client. Log in through the [VirtualBoard Auth API](https://github.com/william-skogberg/VirtualBoard) and send text through the [Socket.IO server](https://github.com/william-skogberg/Websocket).

## Run

Open `index.html` with a local development web server (such as VS Code Live Server). The authentication API and WebSocket server must also be running. Their URLs are currently configured at the top of `app.js` and may need updating.

Log in to obtain tokens, connect, and send or receive text in your user-specific WebSocket room.

**Scope:** learning/demo app, not intended for sensitive data. The browser client keeps access and refresh tokens in localStorage; this is not recommended for production authentication. Also review CORS and configure real environment-specific endpoints before deployment.

Related project: [Electron client](https://github.com/william-skogberg/Websocket-Client-Electron).
