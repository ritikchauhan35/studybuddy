import { useState, useRef, useCallback } from 'react';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export const useWebRTC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoCallActive, setIsVideoCallActive] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const initializePeerConnection = useCallback(() => {
    const peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate to remote peer via WebSocket
        // This will be handled by the parent component
        console.log('ICE candidate generated:', event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Remote stream received');
      setRemoteStream(event.streams[0]);
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'disconnected') {
        endCall();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, []);

  const startCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      setIsVideoCallActive(true);

      const peerConnection = initializePeerConnection();
      
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      return peerConnection;
    } catch (error) {
      console.error('Failed to start call:', error);
      throw error;
    }
  }, [initializePeerConnection]);

  const createOffer = useCallback(async () => {
    if (!peerConnectionRef.current) return null;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return null;

    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      return answer;
    } catch (error) {
      console.error('Failed to create answer:', error);
      return null;
    }
  }, []);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to handle ICE candidate:', error);
    }
  }, []);

  const endCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setRemoteStream(null);
    setIsVideoCallActive(false);
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    isVideoCallActive,
    startCall,
    createOffer,
    createAnswer,
    handleAnswer,
    handleIceCandidate,
    endCall,
  };
};