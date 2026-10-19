import pytest

from app.services.route_playback_service import (
    _nearest_distance_along_route,
    _route_points,
    _sample,
    _segments,
)


def test_route_playback_samples_only_from_osrm_geometry():
    geometry = {
        "type": "LineString",
        "coordinates": [
            [72.5000, 23.0000],
            [72.5100, 23.0000],
            [72.5100, 23.0100],
        ],
    }
    points = _route_points(geometry)
    lengths, total_length = _segments(points)

    assert points == [
        (23.0000, 72.5000),
        (23.0000, 72.5100),
        (23.0100, 72.5100),
    ]
    assert total_length > 2000
    midpoint = _sample(points, lengths, total_length / 2)
    assert midpoint[1] == pytest.approx(72.5100, abs=0.0002)
    assert 23.0000 <= midpoint[0] <= 23.0100
    assert _sample(points, lengths, total_length) == points[-1]


def test_route_resume_projects_saved_position_onto_same_polyline():
    points = [(23.0000, 72.5000), (23.0000, 72.5100), (23.0100, 72.5100)]
    lengths, total_length = _segments(points)
    distance = _nearest_distance_along_route(points, lengths, 23.0048, 72.5101)
    resumed = _sample(points, lengths, distance)

    assert total_length > distance > lengths[0]
    assert resumed[0] == pytest.approx(23.0050, abs=0.0003)
    assert resumed[1] == pytest.approx(72.5100, abs=0.0002)
