'use strict';

const { createDrawingState } = require('./drawing-state');

const rooms = new Map();

const USER_COLORS = [
	'#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#22c55e', '#84cc16', '#eab308'
];

function getOrCreateRoom(roomId) {
	if (!rooms.has(roomId)) {
		const users = new Map();
		const assignedColors = new Map();
		const state = createDrawingState();
		rooms.set(roomId, {
			id: roomId,
			users,
			assignedColors,
			state,
			assignUserColor(userId) {
				if (assignedColors.has(userId)) return assignedColors.get(userId);
				const taken = new Set(assignedColors.values());
				const color = USER_COLORS.find(c => !taken.has(c)) || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
				assignedColors.set(userId, color);
				return color;
			}
		});
	}
	return rooms.get(roomId);
}

function removeClientFromRooms(clientId) {
	for (const room of rooms.values()) {
		if (room.users.has(clientId)) {
			room.users.delete(clientId);
			room.assignedColors.delete(clientId);
		}
	}
}

module.exports = { getOrCreateRoom, removeClientFromRooms };


