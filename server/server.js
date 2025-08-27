import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import Filter from 'bad-words';
import { createClient } from 'redis';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Initialize profanity filter
const filter = new Filter();

// Redis client (fallback to in-memory if Redis not available)
let redisClient;
let useRedis = false;

try {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  await redisClient.connect();
  useRedis = true;
  console.log('Connected to Redis');
} catch (error) {
  console.log('Redis not available, using in-memory storage');
  useRedis = false;
}

// In-memory storage fallback
const memoryStore = {
  sessions: new Map(),
  queue: [],
  blockedPairs: new Set(),
  userSessions: new Map(),
  reports: []
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// Configure CORS to allow ngrok connections
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const createRateLimit = (windowMs, max) => rateLimit({
  windowMs,
  max,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', createRateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes
app.use('/api/match', createRateLimit(5 * 60 * 1000, 10)); // 10 match requests per 5 minutes
app.use('/api/report', createRateLimit(60 * 60 * 1000, 5)); // 5 reports per hour

// Storage helpers
const getFromStore = async (key) => {
  if (useRedis) {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }
  return memoryStore.sessions.get(key);
};

const setInStore = async (key, value, expireSeconds = null) => {
  if (useRedis) {
    const serialized = JSON.stringify(value);
    if (expireSeconds) {
      await redisClient.setEx(key, expireSeconds, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  } else {
    memoryStore.sessions.set(key, value);
    if (expireSeconds) {
      setTimeout(() => {
        memoryStore.sessions.delete(key);
      }, expireSeconds * 1000);
    }
  }
};

const addToQueue = async (user) => {
  if (useRedis) {
    await redisClient.lPush('matchingQueue', JSON.stringify(user));
  } else {
    memoryStore.queue.push(user);
  }
};

const removeFromQueue = async (userId) => {
  if (useRedis) {
    // Get all users from Redis queue
    const queueLength = await redisClient.lLen('matchingQueue');
    for (let i = 0; i < queueLength; i++) {
      const user = await redisClient.rPop('matchingQueue');
      const parsedUser = JSON.parse(user);
      
      // If not the user we want to remove, push back to queue
      if (parsedUser.id !== userId) {
        await redisClient.lPush('matchingQueue', user);
      }
    }
  } else {
    // Fallback to memory store
    const index = memoryStore.queue.findIndex(user => user.id === userId);
    if (index !== -1) {
      memoryStore.queue.splice(index, 1);
    }
  }
};

const getFromQueue = async () => {
  if (useRedis) {
    const user = await redisClient.rPop('matchingQueue');
    return user ? JSON.parse(user) : null;
  } else {
    return memoryStore.queue.pop();
  }
};

const getQueueLength = async () => {
  if (useRedis) {
    return await redisClient.lLen('matchingQueue');
  } else {
    return memoryStore.queue.length;
  }
};

// Utility functions
const calculateMatchScore = (tags1, tags2) => {
  const set1 = new Set(tags1.map(tag => tag.toLowerCase()));
  const set2 = new Set(tags2.map(tag => tag.toLowerCase()));
  const intersection = new Set([...set1].filter(tag => set2.has(tag)));
  return intersection.size;
};

const getSharedTags = (tags1, tags2) => {
  const set1 = new Set(tags1.map(tag => tag.toLowerCase()));
  const set2 = new Set(tags2.map(tag => tag.toLowerCase()));
  const shared = [...set1].filter(tag => set2.has(tag));
  
  // Return original casing from tags1
  return tags1.filter(tag => shared.includes(tag.toLowerCase()));
};

const isBlocked = async (userId1, userId2) => {
  const blockKey = `blocked:${userId1}:${userId2}`;
  const reverseBlockKey = `blocked:${userId2}:${userId1}`;
  
  if (useRedis) {
    const blocked1 = await redisClient.exists(blockKey);
    const blocked2 = await redisClient.exists(reverseBlockKey);
    return blocked1 || blocked2;
  } else {
    return memoryStore.blockedPairs.has(`${userId1}:${userId2}`) || 
           memoryStore.blockedPairs.has(`${userId2}:${userId1}`);
  }
};

const blockUser = async (userId1, userId2) => {
  const blockKey = `blocked:${userId1}:${userId2}`;
  if (useRedis) {
    await redisClient.setEx(blockKey, 30 * 24 * 60 * 60, 'true'); // 30 days
  } else {
    memoryStore.blockedPairs.add(`${userId1}:${userId2}`);
    setTimeout(() => {
      memoryStore.blockedPairs.delete(`${userId1}:${userId2}`);
    }, 30 * 24 * 60 * 60 * 1000);
  }
};

const findMatch = async (user) => {
  const queueLength = await getQueueLength();
  const matches = [];
  
  console.log(`Finding match for user ${user.id} with tags:`, user.tags);
  console.log(`Current queue length: ${queueLength}`);

  // Check all users in queue for matches
  for (let i = 0; i < queueLength; i++) {
    const potentialMatch = await getFromQueue();
    if (!potentialMatch) {
      console.log('No potential match found in queue');
      break;
    }
    
    console.log(`Checking potential match: ${potentialMatch.id} with tags:`, potentialMatch.tags);

    // Skip self-matching and blocked users
    if (potentialMatch.id === user.id || await isBlocked(user.id, potentialMatch.id)) {
      console.log(`Skipping user ${potentialMatch.id} (self-match or blocked)`);
      await addToQueue(potentialMatch); // Put back in queue
      continue;
    }

    const score = calculateMatchScore(user.tags, potentialMatch.tags);
    console.log(`Match score between ${user.id} and ${potentialMatch.id}: ${score}`);
    
    if (score > 0) {
      matches.push({ user: potentialMatch, score });
      console.log(`Added potential match with score ${score}`);
    } else {
      console.log(`No tag match, returning ${potentialMatch.id} to queue`);
      await addToQueue(potentialMatch); // Put back in queue
    }
  }

  if (matches.length > 0) {
    // Sort by match score (highest first)
    matches.sort((a, b) => b.score - a.score);
    console.log(`Found best match: ${matches[0].user.id} with score ${matches[0].score}`);
    return matches[0].user;
  }
  
  console.log(`No matches found for user ${user.id}, adding to queue`);
  return null;
};

const moderateContent = (content) => {
  // Basic profanity filtering
  const cleaned = filter.clean(content);
  
  // Additional checks for personal info patterns
  const personalInfoPatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
    /\bhttps?:\/\/[^\s]+\b/g, // URLs
    /\b(?:instagram|snapchat|discord|telegram|whatsapp|facebook|twitter|tiktok)\b/i // Social platforms
  ];

  let flagged = false;
  for (const pattern of personalInfoPatterns) {
    if (pattern.test(content)) {
      flagged = true;
      break;
    }
  }

  return {
    content: cleaned,
    flagged: flagged || cleaned !== content,
    original: content
  };
};

// WebSocket connection handling
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, { ws, userId: null, sessionId: null });

  // Log connection details for debugging
  const connectionInfo = {
    clientId,
    remoteAddress: req.socket.remoteAddress,
    headers: req.headers,
    url: req.url
  };
  console.log('WebSocket connection established:', connectionInfo);
  console.log(`Client ${clientId} connected`);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleWebSocketMessage(clientId, message);
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Invalid message format' }
      }));
    }
  });

  ws.on('close', async () => {
    console.log(`Client ${clientId} disconnected`);
    
    const client = clients.get(clientId);
    if (client && client.sessionId) {
      // Notify other user in session
      const session = await getFromStore(`session:${client.sessionId}`);
      if (session) {
        const otherUser = session.users.find(u => u.id !== client.userId);
        if (otherUser) {
          const otherClient = [...clients.values()].find(c => c.userId === otherUser.id);
          if (otherClient) {
            otherClient.ws.send(JSON.stringify({
              type: 'user_disconnected',
              payload: {}
            }));
          }
        }
      }
    }
    
    clients.delete(clientId);
  });
});

const handleWebSocketMessage = async (clientId, message) => {
  const client = clients.get(clientId);
  if (!client) return;

  switch (message.type) {
    case 'join_queue':
      await handleJoinQueue(clientId, message.payload);
      break;
      
    case 'leave_queue':
      await handleLeaveQueue(clientId);
      break;
      
    case 'chat_message':
      await handleChatMessage(clientId, message.payload);
      break;
      
    case 'video_request':
      await handleVideoRequest(clientId, message.payload);
      break;
      
    case 'video_response':
      await handleVideoResponse(clientId, message.payload);
      break;
      
    case 'session_ended':
      await handleSessionEnd(clientId);
      break;
      
    default:
      client.ws.send(JSON.stringify({
        type: 'error',
        payload: { message: 'Unknown message type' }
      }));
  }
};

const handleJoinQueue = async (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client) return;

  const user = payload.user;
  client.userId = user.id;
  
  console.log(`User ${user.id} joined matching queue with tags:`, user.tags);

  // Try to find a match
  const match = await findMatch(user);

  if (match) {
    // Create session
    const sessionId = uuidv4();
    const sharedTags = getSharedTags(user.tags, match.tags);
    
    const session = {
      id: sessionId,
      users: [user, match],
      sharedTags,
      createdAt: Date.now(),
      messages: [{
        id: uuidv4(),
        content: `You've been matched! You both study: ${sharedTags.join(', ')}`,
        userId: 'system',
        timestamp: Date.now(),
        type: 'system'
      }]
    };

    await setInStore(`session:${sessionId}`, session, 3600); // 1 hour TTL

    // Update client sessions
    client.sessionId = sessionId;
    
    const matchClient = [...clients.values()].find(c => c.userId === match.id);
    if (matchClient) {
      matchClient.sessionId = sessionId;
    }

    // Notify both users
    const matchMessage = {
      type: 'match_found',
      payload: session
    };

    client.ws.send(JSON.stringify(matchMessage));
    if (matchClient) {
      matchClient.ws.send(JSON.stringify(matchMessage));
    }
  } else {
    // Add to queue
    await addToQueue(user);
    
    // Set timeout for queue waiting
    setTimeout(async () => {
      const stillWaiting = clients.get(clientId);
      if (stillWaiting && !stillWaiting.sessionId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          payload: { 
            message: 'No matches found. Try selecting more subjects or try again later.',
            code: 'MATCHING_TIMEOUT'
          }
        }));
      }
    }, 60000); // 60 second timeout
  }
};

const handleLeaveQueue = async (clientId) => {
  const client = clients.get(clientId);
  if (!client || !client.userId) return;

  console.log(`User ${client.userId} left matching queue`);
  
  // Remove from queue
  await removeFromQueue(client.userId);
  
  // Confirm to client
  client.ws.send(JSON.stringify({
    type: 'queue_left',
    payload: { success: true }
  }));
};

const handleChatMessage = async (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client || !client.sessionId) return;

  const session = await getFromStore(`session:${client.sessionId}`);
  if (!session) return;

  // Moderate content
  const moderated = moderateContent(payload.content);
  
  if (moderated.flagged) {
    // Log for review
    console.log('Flagged message:', {
      sessionId: client.sessionId,
      userId: client.userId,
      original: moderated.original,
      cleaned: moderated.content
    });
  }

  const message = {
    ...payload,
    content: moderated.content,
    timestamp: Date.now()
  };

  // Add message to session
  session.messages.push(message);
  await setInStore(`session:${client.sessionId}`, session, 3600);

  // Broadcast to other user
  const otherUser = session.users.find(u => u.id !== client.userId);
  if (otherUser) {
    const otherClient = [...clients.values()].find(c => c.userId === otherUser.id);
    if (otherClient) {
      otherClient.ws.send(JSON.stringify({
        type: 'chat_message',
        payload: message
      }));
    }
  }
};

const handleVideoRequest = async (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client || !client.sessionId) return;

  const session = await getFromStore(`session:${client.sessionId}`);
  if (!session) return;

  // Update session with video request
  session.videoRequested = {
    requesterId: payload.requesterId,
    status: 'pending'
  };
  await setInStore(`session:${client.sessionId}`, session, 3600);

  // Notify other user
  const otherUser = session.users.find(u => u.id !== client.userId);
  if (otherUser) {
    const otherClient = [...clients.values()].find(c => c.userId === otherUser.id);
    if (otherClient) {
      otherClient.ws.send(JSON.stringify({
        type: 'video_request',
        payload: {
          requesterId: payload.requesterId,
          offer: payload.offer
        }
      }));
    }
  }
};

const handleVideoResponse = async (clientId, payload) => {
  const client = clients.get(clientId);
  if (!client || !client.sessionId) return;

  const session = await getFromStore(`session:${client.sessionId}`);
  if (!session) return;

  // Update session
  if (payload.accepted !== undefined) {
    session.videoRequested = payload.accepted ? 
      { ...session.videoRequested, status: 'accepted' } : 
      undefined;
  }
  await setInStore(`session:${client.sessionId}`, session, 3600);

  // Forward response to requester
  const otherUser = session.users.find(u => u.id !== client.userId);
  if (otherUser) {
    const otherClient = [...clients.values()].find(c => c.userId === otherUser.id);
    if (otherClient) {
      otherClient.ws.send(JSON.stringify({
        type: 'video_response',
        payload
      }));
    }
  }
};

const handleSessionEnd = async (clientId) => {
  const client = clients.get(clientId);
  if (!client || !client.sessionId) return;

  const session = await getFromStore(`session:${client.sessionId}`);
  if (!session) return;

  // Notify other user
  const otherUser = session.users.find(u => u.id !== client.userId);
  if (otherUser) {
    const otherClient = [...clients.values()].find(c => c.userId === otherUser.id);
    if (otherClient) {
      otherClient.ws.send(JSON.stringify({
        type: 'session_ended',
        payload: {}
      }));
      otherClient.sessionId = null;
    }
  }

  // Clean up session
  client.sessionId = null;
};

// API Routes
app.post('/api/report', async (req, res) => {
  try {
    const { sessionId, reason, messages } = req.body;
    
    const report = {
      id: uuidv4(),
      sessionId,
      reason,
      messages: messages || [],
      timestamp: Date.now(),
      ip: req.ip
    };

    // Store report
    if (useRedis) {
      await redisClient.lPush('reports', JSON.stringify(report));
    } else {
      memoryStore.reports.push(report);
    }

    console.log('Report received:', report);
    
    res.json({ success: true, message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

app.post('/api/block', async (req, res) => {
  try {
    const { sessionId, blockedUserId } = req.body;
    
    const session = await getFromStore(`session:${sessionId}`);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const blockerUser = session.users.find(u => u.id !== blockedUserId);
    if (!blockerUser) {
      return res.status(400).json({ error: 'Invalid user' });
    }

    await blockUser(blockerUser.id, blockedUserId);
    
    console.log(`User ${blockerUser.id} blocked ${blockedUserId}`);
    
    res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: Date.now(),
    redis: useRedis ? 'connected' : 'not available',
    activeConnections: clients.size
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Study Buddy server running on port ${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});