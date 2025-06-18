// server.js - THE ENTIRE NEW CODE FOR YOUR GITHUB REPO

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path'); // Added for serving static files

const app = express();
const server = http.createServer(app);

const io = new socketIo.Server(server, {
    cors: {
        origin: "*", // Allows connections from any origin (will be less critical when frontend is served by same server)
        methods: ["GET", "POST"]
    }
});

// --- Serve Static Frontend Files ---
// This tells Express to serve files like index.html, script.js, style.css
// from the root directory of your project (where server.js is located).
app.use(express.static(__dirname));

// For any other route, serve index.html (useful for single-page applications)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// --- Room Configuration ---
const ROOMS = {
    ROOM1: 'Room 1',
    ROOM2: 'Room 2',
    ADMIN_ROOM: 'Admin Room',
    PRIVATE1: 'Private 1',    // New Room
    PRIVATE2: 'Private 2'     // New Room
};
const ADMIN_PASSWORD = 'red';
const PRIVATE1_PASSWORD = 'personal'; // Password for Private 1
const PRIVATE2_PASSWORD = 'link';     // Password for Private 2

// In-memory storage for message history per room
const roomsHistory = {
    [ROOMS.ROOM1]: [],
    [ROOMS.ROOM2]: [],
    [ROOMS.ADMIN_ROOM]: [],
    [ROOMS.PRIVATE1]: [], // Initialize history for new room
    [ROOMS.PRIVATE2]: []  // Initialize history for new room
};
const MAX_MESSAGES_PER_ROOM = 25; // Keep only the last 25 messages per room

io.on('connection', (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // Store the current room the socket is in (useful for tracking disconnections)
    socket.currentRoom = null;

    // Handle joining a room
    socket.on('joinRoom', (data) => {
        const { roomName, password } = data;

        // Leave previous room if any
        if (socket.currentRoom && socket.currentRoom !== roomName) {
            socket.leave(socket.currentRoom);
            io.to(socket.currentRoom).emit('chat message', {
                username: 'System',
                text: `${socket.username || 'A user'} left the room.`,
                room: socket.currentRoom,
                id: 'system' // System message ID
            });
            console.log(`${socket.id} left room: ${socket.currentRoom}`);
        }

        // Password checks for specific rooms
        if (roomName === ROOMS.ADMIN_ROOM && password !== ADMIN_PASSWORD) {
            console.log(`${socket.id} failed to join Admin Room: Incorrect password`);
            socket.emit('roomJoinFailed', 'Incorrect password for Admin Room.');
            return;
        }
        if (roomName === ROOMS.PRIVATE1 && password !== PRIVATE1_PASSWORD) {
            console.log(`${socket.id} failed to join Private 1: Incorrect password`);
            socket.emit('roomJoinFailed', 'Incorrect password for Private 1.');
            return;
        }
        if (roomName === ROOMS.PRIVATE2 && password !== PRIVATE2_PASSWORD) {
            console.log(`${socket.id} failed to join Private 2: Incorrect password`);
            socket.emit('roomJoinFailed', 'Incorrect password for Private 2.');
            return;
        }

        // Ensure the requested room is one of our defined rooms
        if (!Object.values(ROOMS).includes(roomName)) {
            console.warn(`${socket.id} attempted to join an invalid room: ${roomName}`);
            socket.emit('roomJoinFailed', 'Invalid room name.');
            return;
        }

        // Join the new room
        socket.join(roomName);
        socket.currentRoom = roomName;

        // Optional, store username on socket for easier access
        if (data.username) {
            socket.username = data.username;
        }

        // Send confirmation and history to the client that just joined
        socket.emit('roomJoined', {
            roomName: roomName,
            history: roomsHistory[roomName] || [] // Send specific room history
        });
        console.log(`${socket.id} joined room: ${roomName}`);

        // Notify others in the room (and the sender) that a user joined
        io.to(roomName).emit('chat message', {
            username: 'System',
            text: `${socket.username || 'A user'} joined ${roomName}.`,
            room: roomName,
            id: 'system' // System message ID
        });
    });

    // Listen for 'chat message' events from the client
    socket.on('chat message', (msg) => {
        // Basic validation: ensure msg is an object and has required properties
        if (typeof msg === 'object' && msg.text && msg.username && msg.room) {
            console.log(`[${msg.room}] ${msg.username} (${msg.id}): ${msg.text}`);

            // Add message object to history for the specific room
            if (!roomsHistory[msg.room]) {
                console.warn(`Attempted to save message to non-existent room history: ${msg.room}`);
                roomsHistory[msg.room] = [];
            }
            roomsHistory[msg.room].push(msg);

            // Trim history if it exceeds MAX_MESSAGES_PER_ROOM
            if (roomsHistory[msg.room].length > MAX_MESSAGES_PER_ROOM) {
                roomsHistory[msg.room].shift(); // Remove the oldest message
            }

            // Broadcast the message object to all connected clients IN THAT ROOM
            io.to(msg.room).emit('chat message', msg);
        } else {
            console.warn('Received invalid message format:', msg);
        }
    });

    // Listen for 'disconnect' events
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Notify others if the user was in a room
        if (socket.currentRoom) {
            io.to(socket.currentRoom).emit('chat message', {
                username: 'System',
                text: `${socket.username || 'A user'} left the room.`,
                room: socket.currentRoom,
                id: 'system' // System message ID
            });
        }
    });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`BlipChat server listening on port ${PORT}`);
});
