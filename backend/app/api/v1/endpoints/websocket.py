from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.core.security import decode_access_token
from app.models.delivery import DeliveryTracking
from app.models.user import User
from app.services.delivery_service import authorize_delivery_access, get_delivery_or_404
from app.services.realtime_service import manager

router = APIRouter(tags=["Delivery WebSockets"])


@router.websocket("/ws/deliveries/{delivery_id}")
async def delivery_websocket(
    delivery_id: int,
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        user_id = int(payload.get("sub", ""))
        role = payload.get("role")
        user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
        delivery = get_delivery_or_404(db, delivery_id)
        if not user or user.role.value != role:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        try:
            authorize_delivery_access(db, delivery, user_id, role)
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except (TypeError, ValueError):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(delivery_id, websocket)
    latest = db.query(DeliveryTracking).filter(
        DeliveryTracking.delivery_id == delivery_id,
    ).order_by(DeliveryTracking.recorded_at.desc(), DeliveryTracking.id.desc()).first()
    if latest:
        await websocket.send_json({
            "event": "delivery_location_snapshot",
            "data": {
                "delivery_id": delivery_id,
                "delivery_partner_id": delivery.delivery_partner_id,
                "latitude": latest.lat,
                "longitude": latest.lng,
                "accuracy_m": latest.accuracy_m,
                "source": latest.source,
                "status": latest.status.value if latest.status else None,
                "recorded_at": latest.recorded_at.isoformat() + "Z",
                "sequence": latest.id,
            },
        })
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(delivery_id, websocket)
