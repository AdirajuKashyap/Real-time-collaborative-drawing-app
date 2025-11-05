
window.addEventListener('DOMContentLoaded', () => {
  const roomIdInput = document.getElementById('roomId');
  const usernameInput = document.getElementById('username');
  const joinBtn = document.getElementById('joinBtn');
  const colorInput = document.getElementById('color');
  const widthInput = document.getElementById('width');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const clearBtn = document.getElementById('clearBtn');

  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      Canvas.setActiveTool(btn.dataset.tool);
    });
  });

  colorInput.addEventListener('input', () => {
    Canvas.setActiveColor(colorInput.value);
  });

  widthInput.addEventListener('input', () => {
    Canvas.setStrokeWidth(widthInput.value);
  });

  undoBtn.addEventListener('click', () => Canvas.undo());
  redoBtn.addEventListener('click', () => Canvas.redo());
  clearBtn.addEventListener('click', () => Canvas.clear());

  joinBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim() || 'room-1';
    const username = usernameInput.value.trim() || 'Guest';
    WS.join(roomId, username);
  });

  roomIdInput.value = 'room-1';
  usernameInput.value = `Guest-${Math.floor(Math.random()*1000)}`;
  WS.join(roomIdInput.value, usernameInput.value);

  Canvas.init();
});


