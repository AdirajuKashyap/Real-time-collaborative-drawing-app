

const Canvas = (() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  let tool = 'brush';
  let color = '#3b82f6';
  let width = 4;
  let drawing = false;
  let currentOpId = null;
  let localQueueBeforeOpId = [];

  const otherCursors = new Map(); 

  const state = {
    operations: [],
  };

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    const prev = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = clientWidth;
    canvas.height = clientHeight;
    
    renderAll();
  }

  function setTool(t) { tool = t; }
  function setColor(c) { color = c; }
  function setWidth(w) { width = Number(w); }

  function canvasPoint(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left);
    const y = (evt.clientY - rect.top);
    return { x, y, t: Date.now() };
  }

  function drawSegmentSegment(p0, p1, brush) {
    if (!p0 || !p1) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush.width;
    if (brush.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brush.color;
    }
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  function renderOperation(op) {
    if (!op.active) return;
    const brush = { tool: op.tool, color: op.color, width: op.width };
    for (let i = 1; i < op.points.length; i++) {
      drawSegmentSegment(op.points[i - 1], op.points[i], brush);
    }
  }

  function renderAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const op of state.operations) renderOperation(op);
  }

  
  let localBatch = [];
  let lastSentAt = 0;

  function onPointerDown(evt) {
    if (!WS) return;
    drawing = true;
    const start = canvasPoint(evt);
    try { canvas.setPointerCapture(evt.pointerId); } catch (_) {}
    if (evt.cancelable) evt.preventDefault();
    WS.emitStrokeStart({ tool, color, width, start });
    localQueueBeforeOpId = [start];
    
  }

  function onPointerMove(evt) {
    const pt = canvasPoint(evt);
    queueCursor(pt);
    if (!drawing) return;
    localBatch.push(pt);
    if (localBatch.length >= 2) {
      drawSegmentSegment(localBatch[localBatch.length - 2], localBatch[localBatch.length - 1], { tool, color, width });
    }
    const now = Date.now();
    if (now - lastSentAt > 16 && currentOpId) {
      WS.emitStrokePoints({ opId: currentOpId, points: localBatch.splice(0) });
      lastSentAt = now;
    }
  }

  function onPointerUp(evt) {
    if (!drawing) return;
    drawing = false;
    const end = canvasPoint(evt);
    if (currentOpId) {
      if (localBatch.length) WS.emitStrokePoints({ opId: currentOpId, points: localBatch.splice(0) });
      WS.emitStrokeEnd({ opId: currentOpId, end });
      currentOpId = null;
    }
  }

  let pendingCursor = null;
  function queueCursor(pt) {
    pendingCursor = pt;
  }
  function updateCursorRAF() {
    if (pendingCursor) {
      WS.emitCursor({ x: pendingCursor.x, y: pendingCursor.y });
      pendingCursor = null;
    }
    requestAnimationFrame(updateCursorRAF);
  }

  function ensureCursorEl(user) {
    let el = otherCursors.get(user.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'cursor';
      el.style.border = `1px solid ${user.color}`;
      el.textContent = user.name || user.id.slice(0,4);
      canvas.parentElement.appendChild(el);
      otherCursors.set(user.id, el);
    }
    return el;
  }

  function removeCursorEl(userId) {
    const el = otherCursors.get(userId);
    if (el) {
      el.remove();
      otherCursors.delete(userId);
    }
  }

  WS.on('room:state', ({ users, ops }) => {
    populateUsers(users);
    state.operations = ops.slice();
    renderAll();
  });

  WS.on('room:ops', (ops) => {
    state.operations = ops.slice();
    renderAll();
  });

  WS.on('presence:join', (user) => {
    addUser(user);
  });

  WS.on('presence:leave', ({ userId }) => {
    removeUser(userId);
    removeCursorEl(userId);
  });

  WS.on('stroke:start', ({ opId, userId, tool: t, color: c, width: w, start }) => {
    if (WS.id && userId === WS.id()) {
      currentOpId = opId;
      if (localQueueBeforeOpId && localQueueBeforeOpId.length > 0) {
        WS.emitStrokePoints({ opId, points: localQueueBeforeOpId.slice(1) }); 
        localQueueBeforeOpId = [];
      }
      if (localBatch && localBatch.length > 0) {
        WS.emitStrokePoints({ opId, points: localBatch.splice(0) });
      }
    }
    state.operations.push({ opId, userId, tool: t, color: c, width: w, points: [start], active: true });
  });

  WS.on('stroke:points', ({ opId, points }) => {
    const op = state.operations.find(o => o.opId === opId);
    if (!op) return;
    op.points.push(...points);
     const brush = { tool: op.tool, color: op.color, width: op.width };
    for (let i = Math.max(1, op.points.length - points.length); i < op.points.length; i++) {
      drawSegmentSegment(op.points[i - 1], op.points[i], brush);
    }
  });

  WS.on('stroke:end', ({ opId, end }) => {
    const op = state.operations.find(o => o.opId === opId);
    if (!op) return;
    op.points.push(end);
  });

  WS.on('history:applied', () => {
  });

  WS.on('cursor:update', ({ userId, x, y }) => {
    const user = Users.get(userId);
    if (!user) return;
    const el = ensureCursorEl(user);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.outline = `1px solid ${user.color}`;
  });

  const Users = new Map();
  const userListEl = document.getElementById('userList');
  function populateUsers(users) {
    Users.clear();
    userListEl.innerHTML = '';
    users.forEach(addUser);
  }
  function addUser(u) {
    Users.set(u.id, u);
    const li = document.createElement('li');
    li.id = `u-${u.id}`;
    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = u.color;
    li.appendChild(sw);
    const name = document.createElement('span');
    name.textContent = u.name;
    li.appendChild(name);
    userListEl.appendChild(li);
  }
  function removeUser(userId) {
    Users.delete(userId);
    const li = document.getElementById(`u-${userId}`);
    if (li) li.remove();
  }

  function setActiveTool(nextTool) { setTool(nextTool); }
  function setActiveColor(nextColor) { setColor(nextColor); }
  function setStrokeWidth(nextWidth) { setWidth(nextWidth); }
  function undo() { WS.undo(); }
  function redo() { WS.redo(); }
  function clear() { WS.clear(); }

  function init() {
    const stage = canvas.parentElement;
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(resize);

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    requestAnimationFrame(updateCursorRAF);
  }

  return {
    init,
    setActiveTool,
    setActiveColor,
    setStrokeWidth,
    undo,
    redo,
    clear,
  };
})();


