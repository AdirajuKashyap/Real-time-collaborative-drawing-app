# Collaborative Canvas

Real-time collaborative drawing app using vanilla JavaScript, HTML5 Canvas, Node.js, and Socket.IO. Multiple users can draw together with live synchronization, presence cursors, and global undo/redo.

## Features
- Brush and eraser tools
- Color picker and stroke width
- Real-time streaming strokes (low-latency)
- User cursors and online user list
- Global undo/redo across all users
- Room support (via `roomId` field)

## Getting Started

Prerequisites: Node.js 18+

```bash
npm install
npm start
```

Then open `http://localhost:3000` in two or more browser windows to test collaboration.

### Testing with Multiple Users
- Open multiple tabs or browsers
- Use the Room input to join the same room id (default `room-1`)
- Draw simultaneously; you should see strokes and cursors in real time
- Use Undo/Redo and observe the global effect across all connected users

## Known Limitations
- Rendering replays all operations when the history changes; for very large histories, a tiling or snapshot system would be more efficient
- Simple conflict resolution: later strokes draw over earlier ones (server order). A full CRDT for vector graphics would be more robust
- No persistence; state resets on server restart
- No authentication; usernames are client-provided

## Time Spent
- Initial scaffolding and implementation: ~4-5 hours
- Documentation: ~45 minutes
- Manual testing and tuning: ~45 minutes

## Scripts
- `npm start` – Start Express + Socket.IO server and serve static client
- `npm run dev` – Start with nodemon for development

## License
MIT


