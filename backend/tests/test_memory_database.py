from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.main import create_app


def test_parallel_reads_and_changes_in_memory_database():
    """The browser fetches the order, audit and document concurrently after a mutation."""
    with TestClient(create_app("sqlite://", seed=True)) as client:
        paths = ["/api/orders/demo-order" + suffix for suffix in ("", "/history", "/document")]

        def request(index):
            if index % 4:
                return client.get(paths[index % 3]).status_code
            order = client.get(paths[0]).json()
            proposal = order["proposals"][0]
            return client.post(
                f"/api/proposals/{proposal['id']}/note",
                json={"version": proposal["version"], "comment": f"Попытка связи {index}"},
            ).status_code

        with ThreadPoolExecutor(max_workers=8) as executor:
            statuses = list(executor.map(request, range(32)))
        assert all(status in (200, 409) for status in statuses)
        order = client.get(paths[0]).json()
        assert order["totals"]["confirmed"] == 1850000
        assert len(order["proposals"]) == 1
