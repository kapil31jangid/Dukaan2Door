import logging

logger = logging.getLogger("dukaan2door.notifier")


def notify_order_status(order_id: int, status: str) -> None:
    """
    Order status notification interface to Kapil's WebSocket service.
    
    This function is called after successful order status state transitions.
    MUST NEVER RAISE AN EXCEPTION to ensure order creation and updates complete cleanly.
    """
    try:
        logger.info(f"[NOTIFIER] Order #{order_id} status updated to: {status}")
        # Kapil will hook WebSocket dispatch / live notifications here.
    except Exception as exc:
        logger.error(f"[NOTIFIER ERROR] Failed to send order status notification for #{order_id}: {exc}")
