import { useState, useEffect } from 'react';
import { TagSelector } from '@/components/TagSelector';
import { MatchingQueue } from '@/components/MatchingQueue';
import { ChatInterface } from '@/components/ChatInterface';
import { VideoCall } from '@/components/VideoCall';
import { useHTTPMatching } from '@/hooks/useHTTPMatching';
import { useWebSocketMatching } from '@/hooks/useWebSocketMatching';
import { useWebRTC } from '@/hooks/useWebRTC';
import { User } from '@/types';
import { toast } from 'sonner';

type AppState = 'tag_selection' | 'matching' | 'chatting' | 'video_call';

export default function StudyBuddy() {
  const [appState, setAppState] = useState<AppState>('tag_selection');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // WebSocket-based matching (primary method)
  const wsMatching = useWebSocketMatching();
  
  // HTTP polling-based matching (fallback)
  const httpMatching = useHTTPMatching();
  
  // Use WebSocket if connected, otherwise fall back to HTTP
  const { 
    isConnected, 
    isMatching, 
    currentSession, 
    messages, 
    startMatching, 
    stopMatching, 
    sendMessage, 
    leaveSession 
  } = wsMatching.isConnected ? wsMatching : httpMatching;
  
  // Show toast notification when connection method changes
  useEffect(() => {
    if (wsMatching.isConnected) {
      toast.success('Using WebSocket connection');
    } else {
      toast.info('Using HTTP fallback connection');
    }
  }, [wsMatching.isConnected]);

  // WebRTC for video calling
  const { 
    localStream, 
    remoteStream, 
    isCallActive, 
    startCall, 
    endCall, 
    createAnswer, 
    handleAnswer, 
    handleIceCandidate 
  } = useWebRTC();

  // Generate or retrieve user info
  useEffect(() => {
    const storedUser = localStorage.getItem('study-buddy-user');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    } else {
      const newUser: User = {
        id: `user-${Math.random().toString(36).substr(2, 9)}`,
        name: `Student ${Math.floor(Math.random() * 1000)}`,
        tags: [],
        avatar: ['👨‍🎓', '👩‍🎓', '🧑‍💻', '👨‍💻', '👩‍💻'][Math.floor(Math.random() * 5)]
      };
      setCurrentUser(newUser);
      localStorage.setItem('study-buddy-user', JSON.stringify(newUser));
    }
  }, []);

  // Update app state based on matching status
  useEffect(() => {
    if (isMatching) {
      setAppState('matching');
    } else if (currentSession) {
      setAppState('chatting');
    }
  }, [isMatching, currentSession]);

  const handleStartMatching = () => {
    if (!currentUser || selectedTags.length === 0) return;

    const userWithTags = { ...currentUser, tags: selectedTags };
    setCurrentUser(userWithTags);
    localStorage.setItem('study-buddy-user', JSON.stringify(userWithTags));
    
    startMatching(userWithTags);
    toast.info('Looking for a study partner...');
  };

  const handleCancelMatching = () => {
    stopMatching();
    setAppState('tag_selection');
    toast.info('Matching cancelled');
  };

  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };

  const handleStartVideoCall = () => {
    if (!currentSession) return;
    
    setAppState('video_call');
    startCall().then((offer) => {
      if (offer && currentSession) {
        // In a real implementation, you'd send this via Pusher
        // For now, we'll just start the video call locally
        toast.info('Video call started');
      }
    });
  };

  const handleEndVideoCall = () => {
    setAppState('chatting');
    endCall();
    toast.info('Video call ended');
  };

  const handleLeaveSession = () => {
    leaveSession();
    setAppState('tag_selection');
    toast.info('Left study session');
  };

  // Report and block functions (placeholder implementations)
  const handleReport = (reason: string) => {
    toast.info(`Reported: ${reason}`);
    handleLeaveSession();
  };

  const handleBlock = () => {
    toast.info('User blocked');
    handleLeaveSession();
  };

  // Render based on current app state
  if (appState === 'video_call' && (localStream || remoteStream)) {
    return (
      <VideoCall
        localStream={localStream}
        remoteStream={remoteStream}
        onEndCall={handleEndVideoCall}
      />
    );
  }

  if (appState === 'chatting' && currentSession && currentUser) {
    return (
      <ChatInterface
        session={currentSession}
        currentUserId={currentUser.id}
        messages={messages}
        onSendMessage={handleSendMessage}
        onRequestVideo={handleStartVideoCall}
        onAcceptVideo={() => handleStartVideoCall()}
        onDeclineVideo={() => toast.info('Video call declined')}
        onReport={handleReport}
        onBlock={handleBlock}
        onEndSession={handleLeaveSession}
        isVideoCallActive={isCallActive}
      />
    );
  }

  if (appState === 'matching') {
    return (
      <MatchingQueue
        selectedTags={selectedTags}
        onCancel={handleCancelMatching}
      />
    );
  }

  return (
    <TagSelector
      selectedTags={selectedTags}
      onTagsChange={setSelectedTags}
      onStartMatching={handleStartMatching}
      isLoading={isMatching}
    />
  );
}