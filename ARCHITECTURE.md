# Architecture

## Data Flow
1. User draws on canvas → high-frequency pointer events are batched client-side.
2. Client emits `stroke:start` once, then `stroke:points` batches, then `stroke:end`.
3. Server assigns an `opId`, finalizes stroke on `end`, and appends to the room's operation log.
4. Server broadcasts stroke events to all clients for immediate streaming rendering.
5. On undo/redo, server updates operation `active` flags and broadcasts the full ops snapshot for consistent re-render.

```
[Canvas Pointer] -> [Client Batch] -> (WebSocket) -> [Server Room State]
                                              |             |
                                              v             v
                                       [Broadcast Stream] [Ops Log]
```

## WebSocket Protocol
- room:join { roomId, username }
- room:state { users, ops }
- presence:join { id, name, color }
- presence:leave { userId }
- cursor:update { userId, x, y }
- stroke:start { opId, userId, tool, color, width, start }
- stroke:points { opId, points[] }
- stroke:end { opId, end }
- history:undo {}
- history:redo {}
- history:applied { type: 'undo' | 'redo', opId }
- room:ops [ operations ]  // full snapshot for re-render after history changes

Operations:
```
{
  opId: string,
  userId: string,
  tool: 'brush' | 'eraser',
  color: string,
  width: number,
  points: [{ x, y, t }],
  active: boolean,
  startedAt?: number,
  endedAt?: number,
}
```

## Undo/Redo Strategy (Global)
- Server is the source of truth with an ordered operations log per room.
- Undo: find the last active operation in history order, mark `active=false` and push its id to redo stack.
- Redo: pop from redo stack and mark `active=true`.
- After any history change, server emits a full `room:ops` snapshot; clients re-render deterministically in server order applying only `active` operations.
- Conflict resolution: last-writer-wins in visual layering; later operations draw over earlier ones.

## Performance Decisions
- Stream points during drawing to achieve low-latency visual updates.
- Client-side batching at ~60fps (`~16ms`) to limit network chatter.
- Incremental drawing on incoming `stroke:points`; full re-render only on history changes.
- Use Canvas compositing for eraser (`destination-out`) to avoid expensive readbacks.
- Simple presence cursors updated via RAF-throttled messages.

## Future Improvements
- Periodic snapshots or tile-based layers to avoid full replays on large histories.
- Persistence (e.g., Redis or DB) and room eviction policies.
- CRDT-based vector model for richer conflict resolution.
- Mobile touch support and pressure sensitivity.
- Latency/fps overlays, metrics collection.


