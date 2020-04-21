// Requires
require('dotenv').config();
const express = require('express');
const http = require('http');
const helmet = require('helmet');
const socketio = require('socket.io');
const NodeCache = require("node-cache");
const Sentry = require('@sentry/node');
const enforce = require('express-sslify');

// Inits
const app = express();
const server = http.createServer(app)
const io = socketio(server);
const roomCache = new NodeCache({
    stdTTL: 7200
});

// Check for production env and upgrade to https
if (process.env.NODE_ENV === 'production') {
    app.use(enforce.HTTPS({
        trustProtoHeader: true
    }));
}
// Use helmet middleware
app.use(helmet());

// Sentry Init
Sentry.init({
    dsn: process.env.SENTRY_DSN
});

// //// Sentry Error reporting ///////
app.use(Sentry.Handlers.requestHandler());

// Normal route handlers. 

app.get('/room', (req, res) => {
    let room = req.query.r;
    let exists = roomCache.has(room);
    res.json({
        exists: exists
    });
})

// Node-Cache stats
app.get('/cache-stats', (req, res) => {
    res.json(roomCache.getStats());
})

app.use(Sentry.Handlers.errorHandler());

// Socket io server handler
io.on('connection', (socket) => {

    // TODO: maintain a list of hosted rooms
    // user hosts a room
    let isHost = false;
    let hostID = null;
    socket.on('host-room', (reply) => {
        let roomID = Date.now().toString(36);
        socket.leave(socket.id);
        socket.join(roomID);
        hostID = roomID;
        isHost = true;
        roomCache.set(roomID, true);
        reply(roomID);
    });

    // user joins a room
    socket.on('join-room', (roomID, reply) => {
        socket.join(roomID);
        reply(`${socket.id} joined ${roomID}`);
    });

    // Actual color message
    socket.on('color', (color) => {
        for (key in socket.rooms) {
            io.to(key).emit('color', color);
        }
    });

    // TODO: remove from the list of hosted rooms
    socket.on('disconnect', () => {
        if (isHost)
            roomCache.del(hostID);
    })
})

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
    console.log(`Server started at port:${PORT}`);
});