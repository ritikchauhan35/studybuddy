export interface User {
  id: string;
  tags: string[];
  sessionId?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  timestamp: number;
  type: 'message' | 'system';
}

export interface MatchSession {
  id: string;
  users: User[];
  sharedTags: string[];
  createdAt: number;
  messages: ChatMessage[];
  videoRequested?: {
    requesterId: string;
    status: 'pending' | 'accepted' | 'declined';
  };
}

export interface WSMessage {
  type: 'match_found' | 'chat_message' | 'video_request' | 'video_response' | 'user_disconnected' | 'session_ended' | 'error';
  payload?: unknown;
}

export const STUDY_TAGS = [
  'Computer Science',
  'Mathematics',
  'Artificial Intelligence',
  'Coding',
  'Calculus',
  'Physics',
  'Chemistry',
  'Biology',
  'Statistics',
  'Data Science',
  'Machine Learning',
  'Web Development',
  'Software Engineering',
  'Algorithms',
  'Database Systems',
  'Operating Systems',
  'Networks',
  'Cybersecurity',
  'Mobile Development',
  'Game Development'
];