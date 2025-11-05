// Socket.IO client wrapper

const WS = (() => {
  let socket = null;
  let roomId = null;

  const handlers = new Map();

  function ensure() {
    if (!socket) {
      socket = io();
      socket.onAny((event, ...args) => {
        const list = handlers.get(event);
        if (list) list.forEach((fn) => fn(...args));
      });
    }
    return socket;
  }

  function on(event, fn) {
    const list = handlers.get(event) || [];
    list.push(fn);
    handlers.set(event, list);
  }

  function off(event, fn) {
    const list = handlers.get(event) || [];
    handlers.set(event, list.filter((f) => f !== fn));
  }

  function join(_roomId, username) {
    roomId = _roomId;
    const s = ensure();
    s.emit('room:join', { roomId, username });
  }

  // Emitters
  function emitCursor(payload) { ensure().emit('cursor:update', payload); }
  function emitStrokeStart(payload) { ensure().emit('stroke:start', payload); }
  function emitStrokePoints(payload) { ensure().emit('stroke:points', payload); }
  function emitStrokeEnd(payload) { ensure().emit('stroke:end', payload); }
  function undo() { ensure().emit('history:undo'); }
  function redo() { ensure().emit('history:redo'); }
  function clear() { ensure().emit('canvas:clear'); }

  return {
    join, on, off,
    emitCursor, emitStrokeStart, emitStrokePoints, emitStrokeEnd,
    undo, redo, clear,
    id: () => (socket ? socket.id : null),
  };
})();


