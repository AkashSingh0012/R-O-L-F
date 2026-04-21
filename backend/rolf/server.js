const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const sheetUsers = {};
const sheetLocks = {};

const USER_COLORS = [
    "#E53935", "#8E24AA", "#1E88E5", "#00897B",
    "#F4511E", "#6D4C41", "#039BE5", "#7CB342",
];

function getColor(index) {
    return USER_COLORS[index % USER_COLORS.length];
}

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // ── Join a sheet room ──
    socket.on("join-sheet", ({ sheetId, userId, username }) => {
        const room = `sheet:${sheetId}`;
        socket.join(room);

        if (!sheetUsers[sheetId]) sheetUsers[sheetId] = new Map();
        if (!sheetLocks[sheetId]) sheetLocks[sheetId] = new Map();

        const alreadyJoined = [...sheetUsers[sheetId].values()].some(u => u.userId === userId);
        const userCount = sheetUsers[sheetId].size;
        const color = getColor(userCount);

        if (!alreadyJoined) {
            sheetUsers[sheetId].set(socket.id, { userId, username, color });
            socket.to(room).emit("user-joined", { userId, username, color });
            console.log(`${username} joined sheet ${sheetId}`);
        } else {
            sheetUsers[sheetId].set(socket.id, { userId, username, color });
        }

        socket.emit("init", {
            users: Array.from(sheetUsers[sheetId].values()),
            locks: Object.fromEntries(sheetLocks[sheetId]),
        });
    });

    // ── Cell change — broadcast ops to others ──
    socket.on("cell-change", ({ sheetId, ops }) => {
        const user = sheetUsers[sheetId]?.get(socket.id);
        if (!user) return;
        socket.to(`sheet:${sheetId}`).emit("cell-updated", {
            ops,
            userId: user.userId,
        });
    });

    // ── Cell select — broadcast presence position ──
    socket.on("cell-select", ({ sheetId, userId, username, row, col }) => {
        const user = sheetUsers[sheetId]?.get(socket.id);
        if (!user) return;
        socket.to(`sheet:${sheetId}`).emit("cell-presence", {
            userId,
            username,
            color: user.color,
            row,
            col,
        });
    });

    // ── Cell lock ──
    socket.on("cell-lock", ({ sheetId, cellRef }) => {
        if (!sheetLocks[sheetId]) sheetLocks[sheetId] = new Map();
        if (!sheetUsers[sheetId]) return;

        const user = sheetUsers[sheetId].get(socket.id);
        if (!user) return;

        const existing = sheetLocks[sheetId].get(cellRef);
        if (existing && existing.userId !== user.userId) {
            socket.emit("lock-denied", {
                cellRef,
                lockedBy: existing.username,
            });
            return;
        }

        sheetLocks[sheetId].set(cellRef, {
            userId: user.userId,
            username: user.username,
            color: user.color,
        });

        io.to(`sheet:${sheetId}`).emit("cell-locked", {
            cellRef,
            userId: user.userId,
            username: user.username,
            color: user.color,
        });
    });

    // ── Cell unlock ──
    socket.on("cell-unlock", ({ sheetId, cellRef }) => {
        if (!sheetLocks[sheetId]) return;
        const user = sheetUsers[sheetId]?.get(socket.id);
        if (!user) return;

        const lock = sheetLocks[sheetId].get(cellRef);
        if (lock?.userId === user.userId) {
            sheetLocks[sheetId].delete(cellRef);
            io.to(`sheet:${sheetId}`).emit("cell-unlocked", { cellRef });
        }
    });

    // ── Disconnect ──
    socket.on("disconnect", () => {
        for (const sheetId in sheetUsers) {
            const user = sheetUsers[sheetId].get(socket.id);
            if (!user) continue;

            sheetUsers[sheetId].delete(socket.id);

            const stillConnected = [...sheetUsers[sheetId].values()].some(
                u => u.userId === user.userId
            );

            if (sheetLocks[sheetId]) {
                for (const [cellRef, lock] of sheetLocks[sheetId]) {
                    if (lock.userId === user.userId && !stillConnected) {
                        sheetLocks[sheetId].delete(cellRef);
                        io.to(`sheet:${sheetId}`).emit("cell-unlocked", { cellRef });
                    }
                }
            }

            if (!stillConnected) {
                io.to(`sheet:${sheetId}`).emit("user-left", { userId: user.userId });
                console.log(`${user.username} left sheet ${sheetId}`);
            }
        }
    });
});

const PORT = process.env.SOCKET_PORT || 3001;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Socket.io server running on port ${PORT}`);
});