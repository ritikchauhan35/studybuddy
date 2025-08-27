import { useState, useEffect, useCallback } from 'react';
import { usePusher } from './usePusher';
import { User, MatchSession, ChatMessage } from '@/types';

interface UseStudyBuddyMatchingReturn {
  isConnected: boolean;
  isMatching: boolean;
  currentSession: MatchSession | null;
  messages: ChatMessage[];
  startMatching: (user: User) => void;
  stopMatching: () => void;
  sendMessage: (content: string) => void;
  leaveSession: () => void;
}

export const useStudyBuddyMatching = (): UseStudyBuddyMatchingReturn => {
  const { isConnected, subscribeToChannel, unsubscribeFromChannel, triggerEvent, disconnect } = usePusher();
  const [isMatching, setIsMatching] = useState(false);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [matchingChannel, setMatchingChannel] = useState<any>(null);
  const [sessionChannel, setSessionChannel] = useState<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (matchingChannel) {
        unsubscribeFromChannel('matching-queue');
      }
      if (sessionChannel && currentSession) {
        unsubscribeFromChannel(`session-${currentSession.id}`);
      }
      disconnect();
    };
  }, [matchingChannel, sessionChannel, currentSession, unsubscribeFromChannel, disconnect]);

  const startMatching = useCallback((user: User) => {
    if (!isConnected) {
      console.warn('Not connected to Pusher');
      return;
    }

    setCurrentUser(user);
    setIsMatching(true);
    setMessages([]);

    // Subscribe to matching queue channel
    const channel = subscribeToChannel('matching-queue');
    setMatchingChannel(channel);

    if (channel) {
      // Listen for match found events
      channel.bind('client-match-found', (data: { session: MatchSession }) => {
        console.log('Match found:', data);
        setIsMatching(false);
        setCurrentSession(data.session);
        
        // Unsubscribe from matching queue
        unsubscribeFromChannel('matching-queue');
        setMatchingChannel(null);
        
        // Subscribe to session channel
        const sessionCh = subscribeToChannel(`session-${data.session.id}`);
        setSessionChannel(sessionCh);
        
        if (sessionCh) {
          sessionCh.bind('client-message', (messageData: ChatMessage) => {
            setMessages(prev => [...prev, messageData]);
          });
          
          sessionCh.bind('client-user-left', () => {
            setCurrentSession(null);
            setMessages([]);
          });
        }
      });

      // Announce user looking for match
      triggerEvent('matching-queue', 'user-looking', {
        user,
        timestamp: Date.now()
      });

      // Simple client-side matching logic
      setTimeout(() => {
        if (isMatching) {
          // Create a mock session for demo purposes
          const mockSession: MatchSession = {
            id: `session-${Date.now()}`,
            users: [user, {
              id: 'demo-partner',
              name: 'Study Partner',
              tags: user.tags,
              avatar: '👨‍🎓'
            }],
            subject: user.tags[0] || 'General',
            startTime: new Date(),
            status: 'active'
          };

          triggerEvent('matching-queue', 'match-found', { session: mockSession });
        }
      }, 3000); // Match after 3 seconds for demo
    }
  }, [isConnected, subscribeToChannel, triggerEvent, isMatching]);

  const stopMatching = useCallback(() => {
    setIsMatching(false);
    if (matchingChannel) {
      unsubscribeFromChannel('matching-queue');
      setMatchingChannel(null);
    }
  }, [matchingChannel, unsubscribeFromChannel]);

  const sendMessage = useCallback((content: string) => {
    if (!currentSession || !currentUser || !sessionChannel) return;

    const message: ChatMessage = {
      id: `msg-${Date.now()}`,
      content,
      senderId: currentUser.id,
      senderName: currentUser.name,
      timestamp: new Date(),
      sessionId: currentSession.id
    };

    // Add to local messages immediately
    setMessages(prev => [...prev, message]);
    
    // Send to other users
    triggerEvent(`session-${currentSession.id}`, 'message', message);
  }, [currentSession, currentUser, sessionChannel, triggerEvent]);

  const leaveSession = useCallback(() => {
    if (currentSession && sessionChannel) {
      triggerEvent(`session-${currentSession.id}`, 'user-left', {
        userId: currentUser?.id
      });
      
      unsubscribeFromChannel(`session-${currentSession.id}`);
      setSessionChannel(null);
    }
    
    setCurrentSession(null);
    setMessages([]);
  }, [currentSession, sessionChannel, currentUser, triggerEvent, unsubscribeFromChannel]);

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