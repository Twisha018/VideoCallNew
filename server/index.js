 

// // server.js - Node.js/Express server with Socket.io (Optimized for Audio Calling)
// require('dotenv').config(); // MUST BE AT THE VERY TOP to load environment variables

// const express = require('express');
// const http = require('http');
// const socketIo = require('socket.io');
// const cors = require('cors');
// const path = require('path');
// const os = require('os');

// const app = express();
// const server = http.createServer(app);

// // --- CORS Configuration ---
// // Define allowed origins from environment variables or defaults
// // const allowedOrigins = [
// //     'http://localhost:3000',                              // Local development client
// //     process.env.FRONTEND_URL                              // Dynamically from environment variable
// // ].filter(Boolean); // Remove any undefined/null values

// // CORS for Express API routes
// app.use(cors({
//     origin:true,
//     credentials:true
// }));

// // Socket.io CORS configuration
// const io = socketIo(server, {
//     cors: {
//         origin:true,
//         methods: ['GET', 'POST'],
//         credentials: true
//     },
//     allowEIO3: true, // For compatibility with older Socket.IO clients if needed
//     maxHttpBufferSize: 1e8 // Increase buffer size for large SDPs or binary data
// });

// // --- Data Stores ---
// const rooms = new Map(); // Stores general room information and a map of users currently in it.
// const users = new Map(); // Stores global user information by their socket.id.

// // --- Utility Functions ---
// function getServerIPs() {
//     const interfaces = os.networkInterfaces();
//     const ips = [];
//     for (const name of Object.keys(interfaces)) {
//         for (const iface of interfaces[name]) {
//             if (iface.family === 'IPv4' && !iface.internal) {
//                 ips.push(iface.address);
//             }
//         }
//     }
//     return ips;
// }

// // --- API Routes (for Express) ---
// app.get('/api/health', (req, res) => {
//     res.json({ status: 'Server is running!', version: '1.0.0', timestamp: new Date() });
// });

// app.get('/api/server-info', (req, res) => {
//     res.json({
//         serverIPs: getServerIPs(),
//         port: process.env.PORT || 3001,
//         timestamp: new Date(),
//         activeRooms: rooms.size,
//         activeUsers: users.size
//     });
// });

// app.get('/health', (req, res) => {
//     res.json({
//         status: 'healthy',
//         timestamp: new Date(),
//         uptime: process.uptime()
//     });
// });

// // --- Socket.io Connection Handling ---
// io.on('connection', (socket) => {
//     console.log(`User connected: ${socket.id}`);

//     // Initialize user data when they connect
//     users.set(socket.id, {
//         id: socket.id,
//         name: null,         // Will be set on 'join-room'
//         roomId: null,       // Will be set on 'join-room'
//         joinedAt: new Date(),
//         isAudioEnabled: true,
//         isVideoEnabled: false, // Default to false for audio calls
//         isScreenSharing: false
//     });

//     /**
//      * Handles a user leaving their current room and cleans up.
//      * This function is called on 'leave-room' and 'disconnect' events.
//      * @param {Socket} socket - The Socket.IO socket object of the user.
//      */
//     function handleUserLeave(socket) {
//         const user = users.get(socket.id);
//         if (user && user.roomId) {
//             const roomId = user.roomId;
//             const room = rooms.get(roomId);

//             if (room) {
//                 room.users.delete(socket.id); // Remove user from the room's user map

//                 // Notify other users in the room that this user has left
//                 socket.to(roomId).emit('user-left', {
//                     userId: socket.id,
//                     userName: user.name,
//                     userCount: room.users.size
//                 });
//                 console.log(`User ${user.name} (${socket.id}) left room ${roomId}`);

//                 // Clean up empty room
//                 if (room.users.size === 0) {
//                     rooms.delete(roomId);
//                     io.emit('room-deleted', roomId); // Notify all clients that a room was deleted
//                     console.log(`Room ${roomId} deleted (empty)`);
//                 } else {
//                     io.emit('room-updated', { // Update room info for remaining users
//                         id: roomId,
//                         userCount: room.users.size,
//                         createdAt: room.createdAt
//                     });
//                 }
//             }
//         }
//         users.delete(socket.id); // Always remove from global users map
//     }

//     // --- Socket.io Event Listeners ---

//     // Event: `join-room` - A user requests to join a specific room.
//     socket.on('join-room', ({ roomId, userName, roomType = 'audio' }) => { // Default roomType to 'audio'
//         try {
//             console.log(`User ${userName} (${socket.id}) attempting to join room: ${roomId}`);

//             const user = users.get(socket.id);
//             if (!user) {
//                 console.warn(`User ${socket.id} not found in global map on join-room attempt.`);
//                 socket.emit('error', { message: 'User data not initialized. Please refresh.' });
//                 return;
//             }

//             // If user is already in a room, make them leave it first
//             if (user.roomId && user.roomId !== roomId) {
//                 console.log(`User ${user.name} (${socket.id}) leaving old room: ${user.roomId}`);
//                 // Use a temporary socket object for handleUserLeave to prevent infinite recursion
//                 const tempSocket = { id: socket.id, roomId: user.roomId, to: socket.to, leave: socket.leave };
//                 handleUserLeave(tempSocket); // Clean up from the old room
//                 socket.leave(user.roomId); // Ensure socket leaves the old room
//             }

//             // Update user's current room ID and name
//             user.roomId = roomId;
//             user.name = userName;
//             user.isAudioEnabled = true;
//             user.isVideoEnabled = (roomType === 'video'); // Only enable video if roomType is 'video'
//             user.isScreenSharing = false;
//             users.set(socket.id, user); // Save updated user info

//             socket.join(roomId); // Join the Socket.IO room

//             // Initialize room if it doesn't exist
//             if (!rooms.has(roomId)) {
//                 rooms.set(roomId, {
//                     id: roomId,
//                     users: new Map(), // Map of users in this specific room
//                     createdAt: new Date(),
//                     roomType: roomType // Store room type
//                 });
//                 io.emit('new-room-created', { id: roomId, roomType, createdAt: new Date() }); // Notify all of new room
//             }

//             const room = rooms.get(roomId);

//             // Notify existing users in the room about the new user joining
//             Array.from(room.users.values()).forEach(existingUser => {
//                 if (existingUser.id !== socket.id) {
//                     socket.to(existingUser.id).emit('user-joined', {
//                         userId: socket.id,
//                         userName: user.name,
//                         isAudioEnabled: user.isAudioEnabled,
//                         isVideoEnabled: user.isVideoEnabled
//                     });
//                 }
//             });

//             room.users.set(socket.id, user); // Add current user to room's user map (after notifying existing users)

//             // Send information about existing users to the newly joined user
//             const existingUsersInRoom = Array.from(room.users.values())
//                                         .filter(u => u.id !== socket.id)
//                                         .map(u => ({
//                                             id: u.id,
//                                             name: u.name,
//                                             isAudioEnabled: u.isAudioEnabled,
//                                             isVideoEnabled: u.isVideoEnabled
//                                         }));

//             socket.emit('joined-room', {
//                 roomId,
//                 userId: socket.id,
//                 userName: user.name,
//                 roomType: room.roomType,
//                 users: existingUsersInRoom // Send info about existing peers
//             });

//             console.log(`User ${user.name} (${socket.id}) successfully joined room ${roomId}. Room now has ${room.users.size} users.`);

//             // Broadcast updated room info (user count changes)
//             io.emit('room-updated', {
//                 id: roomId,
//                 userCount: room.users.size,
//                 createdAt: room.createdAt,
//                 roomType: room.roomType
//             });

//         } catch (error) {
//             console.error(`Error for user ${socket.id} joining room ${roomId}:`, error);
//             socket.emit('error', { message: `Failed to join room ${roomId}.` });
//         }
//     });

//     // Event: `offer` - WebRTC signaling offer from one peer to another.
//     socket.on('offer', ({ offer, targetUserId }) => {
//         const fromUser = users.get(socket.id);
//         if (fromUser) {
//             const targetSocket = io.sockets.sockets.get(targetUserId);
//             const targetUser = users.get(targetUserId);

//             if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
//                 console.log(`Forwarding offer from ${fromUser.name} (${socket.id}) to ${targetUser.name} (${targetUserId})`);
//                 targetSocket.emit('offer', {
//                     offer,
//                     fromUserId: socket.id,
//                     fromUserName: fromUser.name
//                 });
//             } else {
//                 console.warn(`Offer: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
//                 socket.emit('error', { message: `Could not send offer to ${targetUserId}. User not available or in a different room.` });
//             }
//         }
//     });

//     // Event: `answer` - WebRTC signaling answer from one peer to another.
//     socket.on('answer', ({ answer, targetUserId }) => {
//         const fromUser = users.get(socket.id);
//         if (fromUser) {
//             const targetSocket = io.sockets.sockets.get(targetUserId);
//             const targetUser = users.get(targetUserId);

//             if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
//                 console.log(`Forwarding answer from ${fromUser.name} (${socket.id}) to ${targetUser.name} (${targetUserId})`);
//                 targetSocket.emit('answer', {
//                     answer,
//                     fromUserId: socket.id,
//                     fromUserName: fromUser.name
//                 });
//             } else {
//                 console.warn(`Answer: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
//                 socket.emit('error', { message: `Could not send answer to ${targetUserId}. User not available or in a different room.` });
//             }
//         }
//     });

//     // Event: `ice-candidate` - WebRTC ICE candidate from one peer to another.
//     socket.on('ice-candidate', ({ candidate, targetUserId }) => {
//         const fromUser = users.get(socket.id);
//         if (fromUser) {
//             const targetSocket = io.sockets.sockets.get(targetUserId);
//             const targetUser = users.get(targetUserId);

//             if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
//                 targetSocket.emit('ice-candidate', {
//                     candidate,
//                     fromUserId: socket.id
//                 });
//             } else {
//                 console.warn(`ICE Candidate: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
//             }
//         }
//     });

//     // Event: `audio-toggle` - User toggles their microphone.
//     socket.on('audio-toggle', ({ isEnabled }) => {
//         const user = users.get(socket.id);
//         if (user && user.roomId && rooms.has(user.roomId)) {
//             user.isAudioEnabled = isEnabled;
//             rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
//             console.log(`User ${user.name} (${socket.id}) audio toggled to: ${isEnabled}`);
//             socket.to(user.roomId).emit('user-audio-toggle', {
//                 userId: socket.id,
//                 isEnabled
//             });
//         }
//     });

//     // Event: `video-toggle` - User toggles their camera. (Relevant even for audio-only if video is later enabled)
//     socket.on('video-toggle', ({ isEnabled }) => {
//         const user = users.get(socket.id);
//         if (user && user.roomId && rooms.has(user.roomId)) {
//             user.isVideoEnabled = isEnabled;
//             rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
//             console.log(`User ${user.name} (${socket.id}) video toggled to: ${isEnabled}`);
//             socket.to(user.roomId).emit('user-video-toggle', {
//                 userId: socket.id,
//                 isEnabled
//             });
//         }
//     });

//     // Event: `screen-share-toggle` - User starts/stops screen sharing.
//     socket.on('screen-share-toggle', ({ isEnabled }) => {
//         const user = users.get(socket.id);
//         if (user && user.roomId && rooms.has(user.roomId)) {
//             user.isScreenSharing = isEnabled;
//             rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
//             console.log(`User ${user.name} (${socket.id}) screen share toggled to: ${isEnabled}`);
//             socket.to(user.roomId).emit('user-screen-share-toggle', {
//                 userId: socket.id,
//                 isEnabled
//             });
//         }
//     });

//     // Event: `chat-message` - User sends a chat message.
//     socket.on('chat-message', ({ message, roomId }) => {
//         const user = users.get(socket.id);
//         if (user && user.roomId === roomId) {
//             const messageData = {
//                 id: Date.now(), // Simple unique ID
//                 userId: socket.id,
//                 userName: user.name,
//                 message,
//                 timestamp: new Date().toISOString()
//             };
//             io.to(roomId).emit('chat-message', messageData); // Emit to all in room, including sender
//             console.log(`Chat in room ${roomId} from ${user.name}: "${message}"`);
//         } else {
//             console.warn(`Attempted chat message from ${socket.id} in wrong room or user not found.`);
//         }
//     });

//     // Event: `leave-room` - User explicitly leaves a room.
//     socket.on('leave-room', () => {
//         handleUserLeave(socket);
//     });

//     // Event: `disconnect` - User connection drops unexpectedly.
//     socket.on('disconnect', (reason) => {
//         console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);
//         handleUserLeave(socket); // Use the common cleanup function
//     });
// });

// // --- Serve Static Frontend in Production ---
// if (process.env.NODE_ENV === 'production') {
//     const possibleClientPaths = [
//         path.join(__dirname, '../client/build'),
//         path.join(__dirname, 'client/build'),
//         path.join(__dirname, 'build')
//     ];

//     let clientBuildPath;
//     for (const p of possibleClientPaths) {
//         if (require('fs').existsSync(p) && require('fs').existsSync(path.join(p, 'index.html'))) {
//             clientBuildPath = p;
//             break;
//         }
//     }

//     if (clientBuildPath) {
//         console.log(`Serving static client files from: ${clientBuildPath}`);
//         app.use(express.static(clientBuildPath));

//         app.get('*', (req, res) => {
//             res.sendFile(path.join(clientBuildPath, 'index.html'));
//         });
//     } else {
//         console.error('ERROR: Client build directory not found for production server!');
//         app.get('*', (req, res) => {
//             res.status(500).send('<h1>Server Error: Frontend not found</h1><p>Please ensure the client build is correctly deployed.</p>');
//         });
//     }
// } else {
//     app.get('*', (req, res) => {
//         res.json({
//             message: 'Server running in development mode.',
//             info: 'Frontend is expected to be served by React development server (e.g., on port 3000).'
//         });
//     });
// }

// // --- Start Server ---
// const PORT = process.env.PORT || 3001;
// server.listen(PORT, '0.0.0.0', () => { // Listen on '0.0.0.0' to be accessible externally
//     const serverIPs = getServerIPs();
//     console.log(`\n🚀 Video Call Signaling Server is listening on port ${PORT}`);
//     console.log(`Local Client URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
//     console.log(`\n📡 Server accessible at:`);
//     console.log(`   - Local: http://localhost:${PORT}`);
//     serverIPs.forEach(ip => {
//         console.log(`   - Network: http://${ip}:${PORT}`);
//     });
//     console.log(`\n💡 Ensure firewall allows connections on port ${PORT} for network access.`);
//     console.log(`🌐 For Vercel deployment, ensure your FRONTEND_URL is correctly set and CORS is configured.`);
// });

// // --- Graceful Shutdown ---
// process.on('SIGTERM', () => {
//     console.log('SIGTERM signal received: Closing HTTP server.');
//     server.close(() => {
//         console.log('HTTP server closed.');
//         process.exit(0);
//     });
// });

// process.on('SIGINT', () => {
//     console.log('SIGINT signal received: Closing HTTP server.');
//     server.close(() => {
//         console.log('HTTP server closed.');
//         process.exit(0);
//     });
// });


// server.js - Node.js/Express server with Socket.io (Optimized for Audio/Video Calling)
require('dotenv').config(); // MUST BE AT THE VERY TOP to load environment variables

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

// --- CORS Configuration ---
// CORS for Express API routes
app.use(cors({
    origin: true,
    credentials: true
}));

// Socket.io CORS configuration
const io = socketIo(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true
    },
    allowEIO3: true, // For compatibility with older Socket.IO clients if needed
    maxHttpBufferSize: 1e8 // Increase buffer size for large SDPs or binary data
});

// --- Data Stores ---
const rooms = new Map(); // Stores general room information and a map of users currently in it.
const users = new Map(); // Stores global user information by their socket.id.

// --- Utility Functions ---
function getServerIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

// --- API Routes (for Express) ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running!', version: '1.0.0', timestamp: new Date() });
});

app.get('/api/server-info', (req, res) => {
    res.json({
        serverIPs: getServerIPs(),
        port: process.env.PORT || 3001,
        timestamp: new Date(),
        activeRooms: rooms.size,
        activeUsers: users.size
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// --- Socket.io Connection Handling ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Initialize user data when they connect
    users.set(socket.id, {
        id: socket.id,
        name: null,         // Will be set on 'join-room'
        roomId: null,       // Will be set on 'join-room'
        joinedAt: new Date(),
        isAudioEnabled: true,
        isVideoEnabled: false, // Default to false for audio calls
        isScreenSharing: false
    });

    /**
     * Handles a user leaving their current room and cleans up.
     * This function is called on 'leave-room' and 'disconnect' events.
     * @param {Socket} socket - The Socket.IO socket object of the user.
     */
    function handleUserLeave(socket) {
        const user = users.get(socket.id);
        if (user && user.roomId) {
            const roomId = user.roomId;
            const room = rooms.get(roomId);

            if (room) {
                room.users.delete(socket.id); // Remove user from the room's user map

                // Notify other users in the room that this user has left
                socket.to(roomId).emit('user-left', {
                    userId: socket.id,
                    userName: user.name,
                    userCount: room.users.size
                });
                console.log(`User ${user.name} (${socket.id}) left room ${roomId}`);

                // Clean up empty room
                if (room.users.size === 0) {
                    rooms.delete(roomId);
                    io.emit('room-deleted', roomId); // Notify all clients that a room was deleted
                    console.log(`Room ${roomId} deleted (empty)`);
                } else {
                    io.emit('room-updated', { // Update room info for remaining users
                        id: roomId,
                        userCount: room.users.size,
                        createdAt: room.createdAt
                    });
                }
            }
        }
        users.delete(socket.id); // Always remove from global users map
    }

    // --- Socket.io Event Listeners ---

    // Event: `join-room` - A user requests to join a specific room.
    socket.on('join-room', ({ roomId, userName, roomType = 'audio' }) => { // Default roomType to 'audio'
        try {
            console.log(`User ${userName} (${socket.id}) attempting to join room: ${roomId}`);

            const user = users.get(socket.id);
            if (!user) {
                console.warn(`User ${socket.id} not found in global map on join-room attempt.`);
                socket.emit('error', { message: 'User data not initialized. Please refresh.' });
                return;
            }

            // If user is already in a room, make them leave it first
            if (user.roomId && user.roomId !== roomId) {
                console.log(`User ${user.name} (${socket.id}) leaving old room: ${user.roomId}`);
                socket.leave(user.roomId); // Ensure socket leaves the old room
                handleUserLeave(socket); // Clean up from the old room
            }

            // Update user's current room ID and name
            user.roomId = roomId;
            user.name = userName;
            user.isAudioEnabled = true;
            user.isVideoEnabled = (roomType === 'video'); // Only enable video if roomType is 'video'
            user.isScreenSharing = false;
            users.set(socket.id, user); // Save updated user info

            socket.join(roomId); // Join the Socket.IO room

            // Initialize room if it doesn't exist
            if (!rooms.has(roomId)) {
                rooms.set(roomId, {
                    id: roomId,
                    users: new Map(), // Map of users in this specific room
                    createdAt: new Date(),
                    roomType: roomType // Store room type
                });
                io.emit('new-room-created', { id: roomId, roomType, createdAt: new Date() }); // Notify all of new room
            }

            const room = rooms.get(roomId);

            // Send information about existing users to the newly joined user FIRST
            const existingUsersInRoom = Array.from(room.users.values())
                                        .filter(u => u.id !== socket.id)
                                        .map(u => ({
                                            id: u.id,
                                            name: u.name,
                                            isAudioEnabled: u.isAudioEnabled,
                                            isVideoEnabled: u.isVideoEnabled
                                        }));

            // Add current user to room's user map BEFORE notifying others
            room.users.set(socket.id, user);

            // Send join confirmation to the new user
            socket.emit('joined-room', {
                roomId,
                userId: socket.id,
                userName: user.name,
                roomType: room.roomType,
                users: existingUsersInRoom // Send info about existing peers
            });

            // Notify existing users in the room about the new user joining
            socket.to(roomId).emit('user-joined', {
                userId: socket.id,
                userName: user.name,
                isAudioEnabled: user.isAudioEnabled,
                isVideoEnabled: user.isVideoEnabled
            });

            console.log(`User ${user.name} (${socket.id}) successfully joined room ${roomId}. Room now has ${room.users.size} users.`);

            // Broadcast updated room info (user count changes)
            io.emit('room-updated', {
                id: roomId,
                userCount: room.users.size,
                createdAt: room.createdAt,
                roomType: room.roomType
            });

            // IMPORTANT: Trigger WebRTC connection initiation for existing users
            // This ensures that existing users create peer connections to the new user
            if (existingUsersInRoom.length > 0) {
                console.log(`Triggering peer connections for ${existingUsersInRoom.length} existing users`);
                setTimeout(() => {
                    existingUsersInRoom.forEach(existingUser => {
                        socket.to(existingUser.id).emit('initiate-peer-connection', {
                            targetUserId: socket.id,
                            targetUserName: user.name,
                            shouldCreateOffer: true // Existing users should create offers to new user
                        });
                    });
                    
                    // New user should prepare to receive offers
                    socket.emit('prepare-for-offers', {
                        expectedOffers: existingUsersInRoom.map(u => ({ id: u.id, name: u.name }))
                    });
                }, 1000); // Small delay to ensure room setup is complete
            }

        } catch (error) {
            console.error(`Error for user ${socket.id} joining room ${roomId}:`, error);
            socket.emit('error', { message: `Failed to join room ${roomId}.` });
        }
    });

    // Event: `initiate-call` - Explicitly initiate WebRTC connection between two users
    socket.on('initiate-call', ({ targetUserId }) => {
        const fromUser = users.get(socket.id);
        const targetUser = users.get(targetUserId);
        
        if (fromUser && targetUser && fromUser.roomId === targetUser.roomId) {
            console.log(`Initiating call between ${fromUser.name} (${socket.id}) and ${targetUser.name} (${targetUserId})`);
            
            // Tell the initiating user to create an offer
            socket.emit('create-offer', {
                targetUserId: targetUserId,
                targetUserName: targetUser.name
            });
        } else {
            console.warn(`Cannot initiate call: users not in same room or not found`);
            socket.emit('call-failed', { error: 'Target user not available or not in same room' });
        }
    });

    // Event: `offer` - WebRTC signaling offer from one peer to another.
    socket.on('offer', ({ offer, targetUserId }) => {
        const fromUser = users.get(socket.id);
        if (fromUser) {
            const targetSocket = io.sockets.sockets.get(targetUserId);
            const targetUser = users.get(targetUserId);

            if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
                console.log(`Forwarding offer from ${fromUser.name} (${socket.id}) to ${targetUser.name} (${targetUserId})`);
                targetSocket.emit('offer', {
                    offer,
                    fromUserId: socket.id,
                    fromUserName: fromUser.name
                });
            } else {
                console.warn(`Offer: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
                socket.emit('call-failed', { error: `Could not send offer to ${targetUserId}. User not available or in a different room.` });
            }
        }
    });

    // Event: `answer` - WebRTC signaling answer from one peer to another.
    socket.on('answer', ({ answer, targetUserId }) => {
        const fromUser = users.get(socket.id);
        if (fromUser) {
            const targetSocket = io.sockets.sockets.get(targetUserId);
            const targetUser = users.get(targetUserId);

            if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
                console.log(`Forwarding answer from ${fromUser.name} (${socket.id}) to ${targetUser.name} (${targetUserId})`);
                targetSocket.emit('answer', {
                    answer,
                    fromUserId: socket.id,
                    fromUserName: fromUser.name
                });
            } else {
                console.warn(`Answer: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
                socket.emit('call-failed', { error: `Could not send answer to ${targetUserId}. User not available or in a different room.` });
            }
        }
    });

    // Event: `ice-candidate` - WebRTC ICE candidate from one peer to another.
    socket.on('ice-candidate', ({ candidate, targetUserId }) => {
        const fromUser = users.get(socket.id);
        if (fromUser) {
            const targetSocket = io.sockets.sockets.get(targetUserId);
            const targetUser = users.get(targetUserId);

            if (targetSocket && targetUser && fromUser.roomId === targetUser.roomId) {
                console.log(`Forwarding ICE candidate from ${fromUser.name} (${socket.id}) to ${targetUser.name} (${targetUserId})`);
                targetSocket.emit('ice-candidate', {
                    candidate,
                    fromUserId: socket.id
                });
            } else {
                console.warn(`ICE Candidate: Target user ${targetUserId} not found or not in same room as ${socket.id}.`);
            }
        }
    });

    // Event: `audio-toggle` - User toggles their microphone.
    socket.on('audio-toggle', ({ isEnabled }) => {
        const user = users.get(socket.id);
        if (user && user.roomId && rooms.has(user.roomId)) {
            user.isAudioEnabled = isEnabled;
            rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
            console.log(`User ${user.name} (${socket.id}) audio toggled to: ${isEnabled}`);
            socket.to(user.roomId).emit('user-audio-toggle', {
                userId: socket.id,
                isEnabled
            });
        }
    });

    // Event: `video-toggle` - User toggles their camera.
    socket.on('video-toggle', ({ isEnabled }) => {
        const user = users.get(socket.id);
        if (user && user.roomId && rooms.has(user.roomId)) {
            user.isVideoEnabled = isEnabled;
            rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
            console.log(`User ${user.name} (${socket.id}) video toggled to: ${isEnabled}`);
            socket.to(user.roomId).emit('user-video-toggle', {
                userId: socket.id,
                isEnabled
            });
        }
    });

    // Event: `screen-share-toggle` - User starts/stops screen sharing.
    socket.on('screen-share-toggle', ({ isEnabled }) => {
        const user = users.get(socket.id);
        if (user && user.roomId && rooms.has(user.roomId)) {
            user.isScreenSharing = isEnabled;
            rooms.get(user.roomId).users.set(socket.id, user); // Update user in room's map
            console.log(`User ${user.name} (${socket.id}) screen share toggled to: ${isEnabled}`);
            socket.to(user.roomId).emit('user-screen-share-toggle', {
                userId: socket.id,
                isEnabled
            });
        }
    });

    // Event: `chat-message` - User sends a chat message.
    socket.on('chat-message', ({ message, roomId }) => {
        const user = users.get(socket.id);
        if (user && user.roomId === roomId) {
            const messageData = {
                id: Date.now(), // Simple unique ID
                userId: socket.id,
                userName: user.name,
                message,
                timestamp: new Date().toISOString()
            };
            io.to(roomId).emit('chat-message', messageData); // Emit to all in room, including sender
            console.log(`Chat in room ${roomId} from ${user.name}: "${message}"`);
        } else {
            console.warn(`Attempted chat message from ${socket.id} in wrong room or user not found.`);
        }
    });

    // Add connection test handlers
    socket.on('connection-test', (data) => {
        console.log('📡 Connection test received:', data);
        socket.emit('connection-test-response', { 
            ...data, 
            response: 'Connection test successful',
            serverTimestamp: Date.now()
        });
    });

    // Event: `leave-room` - User explicitly leaves a room.
    socket.on('leave-room', () => {
        handleUserLeave(socket);
    });

    // Event: `disconnect` - User connection drops unexpectedly.
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);
        handleUserLeave(socket); // Use the common cleanup function
    });

    // Add error handling for malformed events
    socket.on('error', (error) => {
        console.error(`Socket error from ${socket.id}:`, error);
    });
});

// --- Serve Static Frontend in Production ---
if (process.env.NODE_ENV === 'production') {
    const possibleClientPaths = [
        path.join(__dirname, '../client/build'),
        path.join(__dirname, 'client/build'),
        path.join(__dirname, 'build')
    ];

    let clientBuildPath;
    for (const p of possibleClientPaths) {
        if (require('fs').existsSync(p) && require('fs').existsSync(path.join(p, 'index.html'))) {
            clientBuildPath = p;
            break;
        }
    }

    if (clientBuildPath) {
        console.log(`Serving static client files from: ${clientBuildPath}`);
        app.use(express.static(clientBuildPath));

        app.get('*', (req, res) => {
            res.sendFile(path.join(clientBuildPath, 'index.html'));
        });
    } else {
        console.error('ERROR: Client build directory not found for production server!');
        app.get('*', (req, res) => {
            res.status(500).send('<h1>Server Error: Frontend not found</h1><p>Please ensure the client build is correctly deployed.</p>');
        });
    }
} else {
    app.get('*', (req, res) => {
        res.json({
            message: 'Server running in development mode.',
            info: 'Frontend is expected to be served by React development server (e.g., on port 3000).'
        });
    });
}

// --- Start Server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => { // Listen on '0.0.0.0' to be accessible externally
    const serverIPs = getServerIPs();
    console.log(`\n🚀 Video Call Signaling Server is listening on port ${PORT}`);
    console.log(`Local Client URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
    console.log(`\n📡 Server accessible at:`);
    console.log(`   - Local: http://localhost:${PORT}`);
    serverIPs.forEach(ip => {
        console.log(`   - Network: http://${ip}:${PORT}`);
    });
    console.log(`\n💡 Ensure firewall allows connections on port ${PORT} for network access.`);
    console.log(`🌐 For production deployment, ensure your FRONTEND_URL is correctly set and CORS is configured.`);
});

// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: Closing HTTP server.');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: Closing HTTP server.');
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
});