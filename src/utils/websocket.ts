import { w3cwebsocket } from 'websocket';

// Initialize WebSocket for Kaspa RPC
(global as any).WebSocket = w3cwebsocket; 