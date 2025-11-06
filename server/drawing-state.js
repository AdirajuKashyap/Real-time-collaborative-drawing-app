'use strict';

const { v4: uuidv4 } = require('uuid');

// An operation represents a complete stroke
// { opId, userId, tool, color, width, points: [{x,y,t}], active: boolean, startedAt, endedAt }

function createDrawingState() {
	const operations = []; // authoritative ordered list
	const opIndex = new Map(); // opId -> index
	const pending = new Map(); // opId -> partial op while streaming
	const history = []; // stack of opIds for undo/redo order
	const redoStack = []; // stack for redo

	function beginStroke(op) {
		const created = {
			opId: op.opId || uuidv4(),
			userId: op.userId,
			tool: op.tool,
			color: op.color,
			width: op.width,
			points: Array.isArray(op.points) ? op.points.slice() : [],
			active: true,
			startedAt: Date.now(),
			endedAt: null,
		};
		pending.set(created.opId, created);
		return created.opId;
	}

	function appendPoints(opId, points) {
		const p = pending.get(opId);
		if (!p) return false;
		for (const pt of points) {
			if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
				p.points.push({ x: pt.x, y: pt.y, t: pt.t || Date.now() });
			}
		}
		return true;
	}

	function endStroke(opId, endPoint) {
		const p = pending.get(opId);
		if (!p) return null;
		if (endPoint && typeof endPoint.x === 'number' && typeof endPoint.y === 'number') {
			p.points.push({ x: endPoint.x, y: endPoint.y, t: endPoint.t || Date.now() });
		}
		p.endedAt = Date.now();
		pending.delete(opId);
		opIndex.set(opId, operations.length);
		operations.push(p);
		history.push(opId);
		redoStack.length = 0; // clear redo on new op
		return p;
	}

	function undo() {
		// Find the last active operation
		for (let i = history.length - 1; i >= 0; i--) {
			const opId = history[i];
			const idx = opIndex.get(opId);
			if (idx == null) continue;
			const op = operations[idx];
			if (op && op.active) {
				op.active = false;
				redoStack.push(opId);
				return { opId };
			}
		}
		return null;
	}

	function redo() {
		while (redoStack.length) {
			const opId = redoStack.pop();
			const idx = opIndex.get(opId);
			const op = idx != null ? operations[idx] : null;
			if (op && !op.active) {
				op.active = true;
				return { opId };
			}
		}
		return null;
	}

	function clear() {
		operations.length = 0;
		opIndex.clear();
		pending.clear();
		history.length = 0;
		redoStack.length = 0;
	}

	return {
		operations,
		beginStroke,
		appendPoints,
		endStroke,
		undo,
		redo,
		clear,
	};
}

module.exports = { createDrawingState };


