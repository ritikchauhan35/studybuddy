/**
 * WebSocket configuration utility
 * Handles dynamic WebSocket URLs based on environment
 */

export const getWebSocketURL = (): string => {
  const host = window.location.host;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  // For local development
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'ws://localhost:3001/ws';
  }
  
  // For ngrok tunnels
  if (host.includes('ngrok-free.app')) {
    // For ngrok, we need to use the same host but with wss protocol
    // The ngrok tunnel must be configured to forward to the WebSocket server port (3001)
    // Important: You must run ngrok with: ngrok http --subdomain=your-subdomain 3001
    console.log('Using ngrok WebSocket URL');
    return `wss://${host}/ws`;
  }
  
  // For Vercel deployment
  if (host.includes('vercel.app')) {
    // Use a separate backend service that supports WebSockets
    // This could be a service like Render, Heroku, or a custom server
    // For now, we'll use the HTTP fallback method when deployed to Vercel
    return '';
  }
  
  // Default fallback - use relative path with appropriate protocol
  return `${protocol}//${host}/ws`;
};