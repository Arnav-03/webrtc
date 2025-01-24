import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER = 'http://localhost:4000';

const Broadcaster = () => {
  const [socket, setSocket] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const setupWebRTC = async () => {
      try {
        // Check for media devices support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Media devices not supported in this browser');
          return;
        }

        // Request camera and microphone access
        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user' // Prefer front camera on mobile
          },
          audio: true
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
          .catch((err) => {
            // Detailed error handling
            switch(err.name) {
              case 'NotAllowedError':
                setError('Camera/Microphone access denied. Please check permissions.');
                break;
              case 'NotFoundError':
                setError('No camera or microphone found on this device.');
                break;
              case 'OverconstrainedError':
                setError('Unable to find matching camera constraints.');
                break;
              default:
                setError(`Error accessing media devices: ${err.message}`);
            }
            throw err;
          });

        // Verify stream has tracks
        if (!stream.getVideoTracks().length) {
          setError('No video track available');
          return;
        }

        localStreamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Additional checks for video playback
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(playErr => {
              setError(`Unable to play video: ${playErr.message}`);
            });
          };
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            // Add TURN servers for better connectivity
            // { 
            //   urls: 'turn:your-turn-server.com',
            //   username: 'your-username',
            //   credential: 'your-password'
            // }
          ],
        });

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        peerConnectionRef.current = peerConnection;

        socket.emit('broadcaster-ready');

        socket.on('viewer-request', async (viewerSocketId) => {
          try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.emit('offer', { offer, viewerSocketId });
          } catch (offerError) {
            console.error('Error creating offer:', offerError);
            setError(`Offer creation failed: ${offerError.message}`);
          }
        });

        socket.on('answer', async (answer) => {
          try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (answerError) {
            console.error('Error setting remote description:', answerError);
            setError(`Failed to set remote description: ${answerError.message}`);
          }
        });

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { 
              candidate: event.candidate, 
              targetSocketId: socket.id 
            });
          }
        };

        setIsStreaming(true);
      } catch (setupError) {
        console.error('Error setting up broadcaster:', setupError);
        setError(`Setup failed: ${setupError.message}`);
      }
    };

    setupWebRTC();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [socket]);

  return (
    <div className="broadcaster-container">
      <h2>Broadcaster Stream</h2>
      {error && (
        <div 
          style={{
            color: 'red', 
            backgroundColor: '#ffeeee', 
            padding: '10px', 
            borderRadius: '5px',
            margin: '10px 0'
          }}
        >
          {error}
        </div>
      )}
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline  // Important for mobile devices
        className="broadcaster-video" 
        style={{ 
          maxWidth: '100%', 
          backgroundColor: error ? '#f0f0f0' : 'transparent' 
        }}
      />
      <p>{isStreaming ? 'Streaming Live' : 'Setting up Stream...'}</p>
    </div>
  );
};

export default Broadcaster;