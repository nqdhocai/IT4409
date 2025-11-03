// server.js (simple Socket.IO)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST']
  }
});

const rooms = {}; // { roomId: [socketId,...] }
const ROOM_ID_REGEX = /^[a-z0-9]{6}$/; // match our generator pattern

function generateRoomId() {
  // regenerate until unique (extremely unlikely to loop)
  let id;
  do {
    id = Math.random().toString(36).slice(2, 8);
  } while (rooms[id]);
  return id;
}

io.on('connection', (socket) => {
  socket.on('create-room', (cb) => {
    const roomId = generateRoomId();
    rooms[roomId] = [socket.id];
    socket.join(roomId);
    cb({ roomId });
  });

  socket.on('join-room', ({ roomId }, cb) => {
    try {
      if (!roomId || typeof roomId !== 'string' || !ROOM_ID_REGEX.test(roomId)) {
        return cb?.({ error: 'invalid-room-id' });
      }

      const arr = rooms[roomId];
      if (!arr) {
        return cb?.({ error: 'room-not-found' });
      }
      if (arr.length >= 2) {
        return cb?.({ error: 'room-full' });
      }

      arr.push(socket.id);
      rooms[roomId] = arr;
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', { socketId: socket.id });
      cb?.({ ok: true });
    } catch (e) {
      cb?.({ error: 'join-failed' });
    }
  });

  socket.on('offer', ({ roomId, sdp }) => socket.to(roomId).emit('offer', { sdp }));
  socket.on('answer', ({ roomId, sdp }) => socket.to(roomId).emit('answer', { sdp }));
  socket.on('ice-candidate', ({ roomId, candidate }) => socket.to(roomId).emit('ice-candidate', { candidate }));

  socket.on('leave-room', ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { socketId: socket.id });
    if (rooms[roomId]) rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
  });

  socket.on('disconnect', () => {
    // Cleanup: remove this socket from any joined rooms we track
    Object.keys(rooms).forEach((rid) => {
      const arr = rooms[rid];
      if (!Array.isArray(arr)) return;
      if (arr.includes(socket.id)) {
        // inform remaining peers in room
        socket.to(rid).emit('user-left', { socketId: socket.id });
        rooms[rid] = arr.filter((id) => id !== socket.id);
        // delete room if empty
        if (rooms[rid].length === 0) {
          delete rooms[rid];
        }
      }
    });
  });
});

server.listen(3000, () => console.log('Signaling server on :3000'));
