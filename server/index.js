const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors(
  {
    origin: "*",
    methods: ["GET", "POST"]
  }
));

const broadcasters = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Handle broadcaster signaling
  socket.on('broadcaster-ready', () => {
    console.log('Broadcaster is ready:', socket.id);
    broadcasters.set(socket.id, socket);
    io.emit('broadcaster-available', socket.id); // Notify all viewers
  });

  // Viewer requesting to connect to a broadcaster
  socket.on('view-request', (broadcasterSocketId) => {
    const broadcasterSocket = broadcasters.get(broadcasterSocketId);
    if (broadcasterSocket) {
      broadcasterSocket.emit('viewer-request', socket.id);
    } else {
      console.error('Broadcaster not found:', broadcasterSocketId);
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    console.log('Forwarding offer to viewer:', data.viewerSocketId);
    io.to(data.viewerSocketId).emit('offer', data.offer);
  });

  socket.on('answer', (data) => {
    console.log('Forwarding answer to broadcaster:', data.broadcasterSocketId);
    const broadcasterSocket = broadcasters.get(data.broadcasterSocketId);
    if (broadcasterSocket) {
      broadcasterSocket.emit('answer', data.answer);
    } else {
      console.error('Broadcaster not found for answer:', data.broadcasterSocketId);
    }
  });

  socket.on('ice-candidate', (data) => {
    console.log('Relaying ICE candidate:', data);
    io.to(data.targetSocketId).emit('ice-candidate', data.candidate);
  });

  socket.on('disconnect', () => {
    if (broadcasters.has(socket.id)) {
      broadcasters.delete(socket.id);
      console.log('Broadcaster disconnected:', socket.id);
    }
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
