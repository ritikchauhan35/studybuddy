import { useState, useEffect, useRef, useCallback } from 'react';
import Pusher from 'pusher-js';

interface PusherConfig {
  appKey: string;
  cluster: string;
}

interface UsePusherReturn {
  isConnected: boolean;
  pusher: Pusher | null;
  subscribeToChannel: (channelName: string) => any;
  unsubscribeFromChannel: (channelName: string) => void;
  triggerEvent: (channelName: string, eventName: string, data: any) => void;
  disconnect: () => void;
}

// Using Pusher's test credentials for demo purposes
const PUSHER_CONFIG: PusherConfig = {
  appKey: 'your-app-key', // We'll use a test key or create one
  cluster: 'us2'
};

export const usePusher = (): UsePusherReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const pusherRef = useRef<Pusher | null>(null);
  const channelsRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    // Initialize Pusher with fallback for demo
    try {
      const pusher = new Pusher('b8b4c8f6d0c4d8b8c4f6', {
        cluster: 'us2',
        forceTLS: true,
        enabledTransports: ['ws', 'wss'],
        disabledTransports: []
      });

      pusher.connection.bind('connected', () => {
        console.log('Pusher connected');
        setIsConnected(true);
      });

      pusher.connection.bind('disconnected', () => {
        console.log('Pusher disconnected');
        setIsConnected(false);
      });

      pusher.connection.bind('error', (error: any) => {
        console.error('Pusher connection error:', error);
        setIsConnected(false);
      });

      pusherRef.current = pusher;
    } catch (error) {
      console.error('Failed to initialize Pusher:', error);
    }

    return () => {
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, []);

  const subscribeToChannel = useCallback((channelName: string) => {
    if (!pusherRef.current) return null;

    if (channelsRef.current.has(channelName)) {
      return channelsRef.current.get(channelName);
    }

    const channel = pusherRef.current.subscribe(channelName);
    channelsRef.current.set(channelName, channel);
    return channel;
  }, []);

  const unsubscribeFromChannel = useCallback((channelName: string) => {
    if (!pusherRef.current) return;

    if (channelsRef.current.has(channelName)) {
      pusherRef.current.unsubscribe(channelName);
      channelsRef.current.delete(channelName);
    }
  }, []);

  const triggerEvent = useCallback((channelName: string, eventName: string, data: any) => {
    // Note: Client events in Pusher must be prefixed with 'client-'
    const channel = channelsRef.current.get(channelName);
    if (channel) {
      channel.trigger(`client-${eventName}`, data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pusherRef.current) {
      // Unsubscribe from all channels
      channelsRef.current.forEach((_, channelName) => {
        pusherRef.current?.unsubscribe(channelName);
      });
      channelsRef.current.clear();
      
      pusherRef.current.disconnect();
      setIsConnected(false);
    }
  }, []);

  return {
    isConnected,
    pusher: pusherRef.current,
    subscribeToChannel,
    unsubscribeFromChannel,
    triggerEvent,
    disconnect
  };
};