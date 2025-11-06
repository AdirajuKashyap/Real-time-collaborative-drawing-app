'use strict';

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { getOrCreateRoom, removeClientFromRooms } = require('./rooms');
const { createDrawingState } = require('./drawing-state');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: '*' }
});

// Static client
app.use('/', express.static(path.join(__dirname, '..', 'client')));

// Namespace for collaboration
io.on('connection', (socket) => {
	// Client joins a room with { roomId, username }
	socket.on('room:join', ({ roomId, username }) => {
		if (!roomId) return;
		const room = getOrCreateRoom(roomId);

		socket.join(roomId);
		const userId = socket.id;
		const color = room.assignUserColor(userId);
		room.users.set(userId, { id: userId, name: username || `User-${userId.slice(0, 4)}`, color });

		// Send initial state to the joining user
		socket.emit('room:state', {
			users: Array.from(room.users.values()),
			ops: room.state.operations,
		});

		// Notify others
		socket.to(roomId).emit('presence:join', room.users.get(userId));

		// Cursor updates
		socket.on('cursor:update', (payload) => {
			io.to(roomId).emit('cursor:update', {
				userId,
				...payload,
			});
		});

		// Stroke start: allocate opId, register pending stroke
		socket.on('stroke:start', (msg) => {
			const { tool, color: strokeColor, width, start } = msg || {};
			const opId = uuidv4();
			room.state.beginStroke({
				opId,
				userId,
				tool: tool === 'eraser' ? 'eraser' : 'brush',
				color: strokeColor || color,
				width: Math.max(1, Math.min(64, Number(width) || 4)),
				points: [start],
			});
			io.to(roomId).emit('stroke:start', { opId, userId, tool: tool === 'eraser' ? 'eraser' : 'brush', color: strokeColor || color, width, start });
		});

		// Stroke continue: stream points (batched)
		socket.on('stroke:points', ({ opId, points }) => {
			if (!opId || !Array.isArray(points) || points.length === 0) return;
			room.state.appendPoints(opId, points);
			io.to(roomId).emit('stroke:points', { opId, points });
		});

		// Stroke end: finalize operation
		socket.on('stroke:end', ({ opId, end }) => {
			if (!opId) return;
			const op = room.state.endStroke(opId, end);
			if (op) {
				io.to(roomId).emit('stroke:end', { opId, end });
			}
		});

		// Global undo/redo
		socket.on('history:undo', () => {
			const result = room.state.undo();
			if (result) {
				io.to(roomId).emit('history:applied', { type: 'undo', opId: result.opId });
				// For simplicity and consistency, broadcast full ops list snapshot to re-render reliably
				io.to(roomId).emit('room:ops', room.state.operations);
			}
		});

		socket.on('history:redo', () => {
			const result = room.state.redo();
			if (result) {
				io.to(roomId).emit('history:applied', { type: 'redo', opId: result.opId });
				io.to(roomId).emit('room:ops', room.state.operations);
			}
		});

		// Clear canvas (optional safety)
		socket.on('canvas:clear', () => {
			room.state.clear();
			io.to(roomId).emit('room:ops', room.state.operations);
		});

		// Disconnect handling
		socket.on('disconnect', () => {
			removeClientFromRooms(socket.id);
			io.to(roomId).emit('presence:leave', { userId });
		});
 	});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on http://localhost:${PORT}`);
});


