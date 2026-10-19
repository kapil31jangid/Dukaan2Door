import asyncio
import logging
import math
import time
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.delivery import Delivery, DeliveryStatus, DeliveryTracking
from app.services.delivery_service import record_location_update
from app.services.geo_service import calculate_distance_km, has_valid_coordinates
from app.services.realtime_service import manager
from app.services.routing_service import get_route


logger = logging.getLogger(__name__)
ROUTE_PLAYBACK_SOURCE = "ROUTE_PLAYBACK"


def _route_points(geometry: Any) -> list[tuple[float, float]]:
    coordinates = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if not isinstance(coordinates, list):
        return []
    points: list[tuple[float, float]] = []
    for coordinate in coordinates:
        if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2:
            continue
        lng, lat = float(coordinate[0]), float(coordinate[1])
        if has_valid_coordinates(lat, lng):
            points.append((lat, lng))
    return points


def _segments(points: list[tuple[float, float]]) -> tuple[list[float], float]:
    lengths = [
        calculate_distance_km(start[0], start[1], end[0], end[1]) * 1000
        for start, end in zip(points, points[1:])
    ]
    return lengths, sum(lengths)


def _sample(points: list[tuple[float, float]], lengths: list[float], distance_m: float) -> tuple[float, float]:
    remaining = max(0.0, distance_m)
    for index, length in enumerate(lengths):
        if remaining <= length:
            ratio = 0.0 if length <= 0 else remaining / length
            start, end = points[index], points[index + 1]
            return (
                start[0] + (end[0] - start[0]) * ratio,
                start[1] + (end[1] - start[1]) * ratio,
            )
        remaining -= length
    return points[-1]


def _nearest_distance_along_route(
    points: list[tuple[float, float]],
    lengths: list[float],
    latitude: float,
    longitude: float,
) -> float:
    best_distance = float("inf")
    best_along = 0.0
    traversed = 0.0
    for index, length in enumerate(lengths):
        samples = max(1, min(20, math.ceil(length / 25)))
        for step in range(samples + 1):
            ratio = step / samples
            start, end = points[index], points[index + 1]
            candidate_lat = start[0] + (end[0] - start[0]) * ratio
            candidate_lng = start[1] + (end[1] - start[1]) * ratio
            distance = calculate_distance_km(latitude, longitude, candidate_lat, candidate_lng)
            if distance < best_distance:
                best_distance = distance
                best_along = traversed + length * ratio
        traversed += length
    return best_along


class RoutePlaybackManager:
    def __init__(self) -> None:
        self._tasks: dict[int, asyncio.Task] = {}

    async def start(self, delivery_id: int) -> None:
        if not settings.route_playback_enabled:
            return
        await self.stop(delivery_id)
        self._tasks[delivery_id] = asyncio.create_task(
            self._run(delivery_id),
            name=f"delivery-route-{delivery_id}",
        )

    async def stop(self, delivery_id: int) -> None:
        task = self._tasks.pop(delivery_id, None)
        if task and task is not asyncio.current_task() and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def resume_active(self) -> None:
        if not settings.route_playback_enabled:
            return

        def active_ids() -> list[int]:
            with SessionLocal() as db:
                return [
                    delivery_id
                    for (delivery_id,) in db.query(Delivery.id).filter(
                        Delivery.status.in_([DeliveryStatus.ACCEPTED, DeliveryStatus.OUT_FOR_DELIVERY])
                    )
                ]

        for delivery_id in await asyncio.to_thread(active_ids):
            await self.start(delivery_id)

    async def shutdown(self) -> None:
        for delivery_id in list(self._tasks):
            await self.stop(delivery_id)

    def _load_leg(self, delivery_id: int) -> dict[str, Any] | None:
        with SessionLocal() as db:
            delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
            if not delivery or not delivery.delivery_partner:
                return None
            if delivery.status == DeliveryStatus.ACCEPTED:
                origin = (
                    float(delivery.delivery_partner.current_lat),
                    float(delivery.delivery_partner.current_lng),
                ) if has_valid_coordinates(
                    delivery.delivery_partner.current_lat,
                    delivery.delivery_partner.current_lng,
                ) else (delivery.pickup_lat, delivery.pickup_lng)
                destination = (delivery.pickup_lat, delivery.pickup_lng)
            elif delivery.status == DeliveryStatus.OUT_FOR_DELIVERY:
                origin = (delivery.pickup_lat, delivery.pickup_lng)
                destination = (delivery.destination_lat, delivery.destination_lng)
            else:
                return None

            latest = (
                db.query(DeliveryTracking)
                .filter(
                    DeliveryTracking.delivery_id == delivery.id,
                    DeliveryTracking.source == ROUTE_PLAYBACK_SOURCE,
                    DeliveryTracking.status == delivery.status,
                )
                .order_by(DeliveryTracking.recorded_at.desc(), DeliveryTracking.id.desc())
                .first()
            )
            return {
                "status": delivery.status,
                "partner_id": delivery.delivery_partner_id,
                "origin": origin,
                "destination": destination,
                "latest": (latest.lat, latest.lng) if latest else None,
            }

    def _record_point(
        self,
        delivery_id: int,
        expected_status: DeliveryStatus,
        latitude: float,
        longitude: float,
    ) -> dict[str, Any] | None:
        with SessionLocal() as db:
            delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
            if not delivery or delivery.status != expected_status or not delivery.delivery_partner:
                return None
            update = record_location_update(
                db,
                delivery,
                delivery.delivery_partner,
                latitude,
                longitude,
                accuracy_m=5,
                captured_at=datetime.now(timezone.utc),
                source=ROUTE_PLAYBACK_SOURCE,
            )
            return {
                "delivery_id": delivery_id,
                "delivery_partner_id": delivery.delivery_partner_id,
                "latitude": update.lat,
                "longitude": update.lng,
                "accuracy_m": update.accuracy_m,
                "source": update.source,
                "status": update.status.value if update.status else None,
                "recorded_at": update.recorded_at.replace(tzinfo=timezone.utc).isoformat(),
                "sequence": update.id,
            }

    async def _run(self, delivery_id: int) -> None:
        try:
            leg = await asyncio.to_thread(self._load_leg, delivery_id)
            if not leg:
                return
            route = await asyncio.to_thread(
                get_route,
                leg["origin"][0],
                leg["origin"][1],
                leg["destination"][0],
                leg["destination"][1],
            )
            points = _route_points(route.get("geometry"))
            if len(points) < 2:
                logger.warning("OSRM returned no usable geometry for delivery %s", delivery_id)
                return
            lengths, total_length = _segments(points)
            if total_length <= 0:
                return

            travelled = 0.0
            if leg["latest"] and leg["status"] == DeliveryStatus.OUT_FOR_DELIVERY:
                travelled = _nearest_distance_along_route(points, lengths, *leg["latest"])
            last_tick = time.monotonic()
            interval = max(1.0, float(settings.ROUTE_PLAYBACK_UPDATE_SECONDS))

            while travelled < total_length:
                now = time.monotonic()
                elapsed = max(0.0, now - last_tick)
                last_tick = now
                progress = travelled / total_length
                speed_factor = 0.9 + 0.12 * math.sin(now / 7.0)
                if progress > 0.9:
                    speed_factor *= max(0.35, (1.0 - progress) / 0.1)
                speed_mps = max(2.0, settings.ROUTE_PLAYBACK_SPEED_KMH * speed_factor / 3.6)
                travelled = min(total_length, travelled + speed_mps * elapsed)
                latitude, longitude = _sample(points, lengths, travelled)
                payload = await asyncio.to_thread(
                    self._record_point,
                    delivery_id,
                    leg["status"],
                    latitude,
                    longitude,
                )
                if payload is None:
                    return
                await manager.broadcast(delivery_id, "delivery_location_updated", payload)
                if travelled < total_length:
                    await asyncio.sleep(interval)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Route playback failed for delivery %s", delivery_id)
        finally:
            current = self._tasks.get(delivery_id)
            if current is asyncio.current_task():
                self._tasks.pop(delivery_id, None)


route_playback_manager = RoutePlaybackManager()
