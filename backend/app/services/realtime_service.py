from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, delivery_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[delivery_id].add(websocket)

    def disconnect(self, delivery_id: int, websocket: WebSocket) -> None:
        connections = self._connections.get(delivery_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(delivery_id, None)

    async def broadcast(self, delivery_id: int, event: str, payload: dict[str, Any]) -> None:
        connections = list(self._connections.get(delivery_id, set()))
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json({"event": event, "data": payload})
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(delivery_id, websocket)


manager = ConnectionManager()
