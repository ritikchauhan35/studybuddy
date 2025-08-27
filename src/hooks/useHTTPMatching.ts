import { useState, useEffect, useRef, useCallback } from 'react';
import { User, MatchSession, ChatMessage } from '@/types';

interface UseHTTPMatchingReturn {
  isConnected: boolean;
  isMatching: boolean;
  currentSession: MatchSession | null;
  messages: ChatMessage[];
  startMatching: (user: User) => void;
  stopMatching: () => void;
  sendMessage: (content: string) => void;
  leaveSession: () => void;
}

// Local storage keys
const MATCHING_QUEUE_KEY = 'study-buddy-matching-queue';
const SESSION_KEY = 'study-buddy-current-session';
const MESSAGES_KEY = 'study-buddy-messages';

export const useHTTPMatching = (): UseHTTPMatchingReturn => {
  const [isConnected, setIsConnected] = useState(true); // Always connected for HTTP
  const [isMatching, setIsMatching] = useState(false);
  const [currentSession, setCurrentSession] = useState<MatchSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    const savedSession = localStorage.getItem(SESSION_KEY);
    const savedMessages = localStorage.getItem(MESSAGES_KEY);
    
    if (savedSession) {
      setCurrentSession(JSON.parse(savedSession));
    }
    
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, []);

  // Save session and messages to localStorage
  useEffect(() => {
    if (currentSession) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentSession]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Polling function to check for matches and messages
  const poll = useCallback(() => {
    if (isMatching) {
      // Check matching queue for potential matches
      const queueData = localStorage.getItem(MATCHING_QUEUE_KEY);
      const queue: { user: User; timestamp: number }[] = queueData ? JSON.parse(queueData) : [];
      
      if (currentUser && queue.length > 0) {
        // Find a match based on shared tags
        const potentialMatch = queue.find(entry => 
          entry.user.id !== currentUser.id &&
          entry.user.tags.some(tag => currentUser.tags.includes(tag)) &&
          Date.now() - entry.timestamp < 60000 // Within 1 minute
        );

        if (potentialMatch) {
          // Create a session
          const session: MatchSession = {
            id: `session-${Date.now()}`,
            users: [currentUser, potentialMatch.user],
            subject: currentUser.tags.find(tag => potentialMatch.user.tags.includes(tag)) || 'General',
            startTime: new Date(),
            status: 'active'
          };

          // Remove matched users from queue
          const updatedQueue = queue.filter(entry => 
            entry.user.id !== currentUser.id && entry.user.id !== potentialMatch.user.id
          );
          localStorage.setItem(MATCHING_QUEUE_KEY, JSON.stringify(updatedQueue));

          setCurrentSession(session);
          setIsMatching(false);
          setMessages([]);
        }
      }
    }

    if (currentSession) {
      // Check for new messages in the session
      const sessionMessagesKey = `messages-${currentSession.id}`;
      const sessionMessages = localStorage.getItem(sessionMessagesKey);
      
      if (sessionMessages) {
        const parsedMessages: ChatMessage[] = JSON.parse(sessionMessages);
        const newMessages = parsedMessages.filter(msg => 
          !messages.some(existingMsg => existingMsg.id === msg.id)
        );
        
        if (newMessages.length > 0) {
          setMessages(prev => [...prev, ...newMessages]);
        }
      }
    }
  }, [isMatching, currentSession, currentUser, messages]);

  // Start polling when matching or in session
  useEffect(() => {
    if (isMatching || currentSession) {
      pollingIntervalRef.current = setInterval(poll, 2000); // Poll every 2 seconds
    } else {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isMatching, currentSession, poll]);

  const startMatching = useCallback((user: User) => {
    setCurrentUser(user);
    setIsMatching(true);
    setMessages([]);

    // Add user to matching queue
    const queueData = localStorage.getItem(MATCHING_QUEUE_KEY);
    const queue: { user: User; timestamp: number }[] = queueData ? JSON.parse(queueData) : [];
    
    // Remove any existing entries for this user
    const filteredQueue = queue.filter(entry => entry.user.id !== user.id);
    filteredQueue.push({ user, timestamp: Date.now() });
    
    localStorage.setItem(MATCHING_QUEUE_KEY, JSON.stringify(filteredQueue));

    // Set a timeout for matching (demo: auto-match after 5 seconds if no real match)
    matchingTimeoutRef.current = setTimeout(() => {
      if (isMatching) {
        // Create a demo partner
        const demoPartner: User = {
          id: 'demo-partner',
          name: 'Study Partner',
          tags: user.tags,
          avatar: '👨‍🎓'
        };

        const session: MatchSession = {
          id: `session-${Date.now()}`,
          users: [user, demoPartner],
          subject: user.tags[0] || 'General',
          startTime: new Date(),
          status: 'active'
        };

        setCurrentSession(session);
        setIsMatching(false);
        setMessages([]);
      }
    }, 5000);
  }, [isMatching]);

  const stopMatching = useCallback(() => {
    setIsMatching(false);
    
    if (matchingTimeoutRef.current) {
      clearTimeout(matchingTimeoutRef.current);
      matchingTimeoutRef.current = null;
    }

    // Remove user from matching queue
    if (currentUser) {
      const queueData = localStorage.getItem(MATCHING_QUEUE_KEY);
      const queue: { user: User; timestamp: number }[] = queueData ? JSON.parse(queueData) : [];
      const filteredQueue = queue.filter(entry => entry.user.id !== currentUser.id);
      localStorage.setItem(MATCHING_QUEUE_KEY, JSON.stringify(filteredQueue));
    }
  }, [currentUser]);

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

    // Add to local messages immediately
    setMessages(prev => [...prev, message]);

    // Store in session-specific messages for other users to see
    const sessionMessagesKey = `messages-${currentSession.id}`;
    const existingMessages = localStorage.getItem(sessionMessagesKey);
    const messages: ChatMessage[] = existingMessages ? JSON.parse(existingMessages) : [];
    messages.push(message);
    localStorage.setItem(sessionMessagesKey, JSON.stringify(messages));
  }, [currentSession, currentUser]);

  const leaveSession = useCallback(() => {
    if (currentSession) {
      // Clean up session data
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(MESSAGES_KEY);
      localStorage.removeItem(`messages-${currentSession.id}`);
    }
    
    setCurrentSession(null);
    setMessages([]);
  }, [currentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (matchingTimeoutRef.current) {
        clearTimeout(matchingTimeoutRef.current);
      }
    };
  }, []);

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