import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER = 'https://webrtc-88n6.onrender.com/';

const Viewer = () => {
  const [socket, setSocket] = useState(null);
  const [broadcasters, setBroadcasters] = useState([]);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleBroadcasterAvailable = (broadcasterSocketId) => {
      console.log('Broadcaster available:', broadcasterSocketId);

      setBroadcasters((prev) => {
        if (!prev.includes(broadcasterSocketId)) {
          return [...prev, broadcasterSocketId];
        }
        return prev;
      });
    };

    socket.on('broadcaster-available', handleBroadcasterAvailable);

    return () => {
      socket.off('broadcaster-available', handleBroadcasterAvailable);
    };
  }, [socket]);

  const setupWebRTC = useCallback(async (broadcasterSocketId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnectionRef.current = peerConnection;

    peerConnection.ontrack = (event) => {
      console.log('Received remote stream', event.streams[0]);

      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    socket.emit('view-request', broadcasterSocketId);

    socket.on('offer', async (offer) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', { answer, broadcasterSocketId });
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, targetSocketId: broadcasterSocketId });
      }
    };

    socket.on('ice-candidate', async (candidate) => {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    return () => {
      socket.off('offer');
      socket.off('ice-candidate');
      peerConnection.close();
    };
  }, [socket]);

  const handleViewBroadcaster = (broadcasterSocketId) => {
    setupWebRTC(broadcasterSocketId);
  };

  return (
    <div className="viewer-container">
      <h2>Viewer Stream</h2>
      <div>
        <h3>Available Broadcasters:</h3>
        {broadcasters.map((id) => (
          <button key={id} onClick={() => handleViewBroadcaster(id)}>
            View Broadcaster {id}
          </button>
        ))}
      </div>
      <video ref={videoRef} autoPlay className="viewer-video" />
    </div>
  );
};

export default Viewer;
