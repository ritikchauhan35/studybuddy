import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { getWebSocketURL } from '@/lib/wsConfig';
import { User, MatchSession, ChatMessage } from '@/types';

interface UseWebSocketMatchingReturn {
  isConnected: boolean;
  isMatching: boolean;
  currentSession: MatchSession | null;
  messages: ChatMessage[];
  startMatching: (user: User) => void;
  stopMatching: () => void;
  sendMessage: (content: string) => void;
  leaveSession: () => void;
}

export const useWebSocketMatching = (): UseWebSocketMatchingReturn => {
  const [isMatching, setIsMatching] = useState(false);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Get dynamic WebSocket URL based on environment
  const wsUrl = getWebSocketURL();
  
  // Initialize WebSocket connection only if URL is available
  const { isConnected, lastMessage, sendMessage: sendWsMessage, disconnect } = useWebSocket(
    wsUrl ? wsUrl : null
  );

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'match_found':
        setIsMatching(false);
        setCurrentSession(lastMessage.payload.session);
        setMessages([]);
        break;
        
      case 'chat_message':
        setMessages(prev => [...prev, lastMessage.payload.message]);
        break;
        
      case 'user_disconnected':
        // Handle user disconnection
        if (currentSession) {
          // You might want to show a notification or handle this differently
          console.log('The other user disconnected');
        }
        break;
    }
  }, [lastMessage, currentSession]);

  // Start matching process
  const startMatching = useCallback((user: User) => {
    setCurrentUser(user);
    setIsMatching(true);
    
    sendWsMessage({
      type: 'join_queue',
      payload: { user }
    });
  }, [sendWsMessage]);

  // Stop matching process
  const stopMatching = useCallback(() => {
    setIsMatching(false);
    
    // No need to send a message to the server if we're not connected
    if (isConnected) {
      sendWsMessage({
        type: 'leave_queue',
        payload: {}
      });
    }
  }, [isConnected, sendWsMessage]);

  // Send chat message
  const sendMessage = useCallback((content: string) => {
    if (!currentSession || !currentUser) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      content,
      senderId: currentUser.id,
      senderName: currentUser.name,
      timestamp: new Date(),
      sessionId: currentSession.id
    };

    // Add to local messages immediately for UI responsiveness
    setMessages(prev => [...prev, message]);
    
    // Send via WebSocket
    sendWsMessage({
      type: 'chat_message',
      payload: { message, sessionId: currentSession.id }
    });
  }, [currentSession, currentUser, sendWsMessage]);

  // Leave current session
  const leaveSession = useCallback(() => {
    if (currentSession) {
      sendWsMessage({
        type: 'session_ended',
        payload: { sessionId: currentSession.id }
      });
    }
    
    setCurrentSession(null);
    setMessages([]);
  }, [currentSession, sendWsMessage]);

  return {
    isConnected,
    isMatching,
    currentSession,
    messages,
    startMatching,
    stopMatching,
    sendMessage,
    leaveSession
  };
};