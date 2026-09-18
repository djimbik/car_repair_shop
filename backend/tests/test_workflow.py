from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest

ORDER = "/api/orders/demo-order"
MANAGER = {"X-Demo-Actor": "manager"}
MECHANIC = {"X-Demo-Actor": "mechanic"}
CASHIER = {"X-Demo-Actor": "cashier"}


def current(client):
    return client.get(ORDER).json()["proposals"][-1]


def path(proposal, suffix):
    return f"/api/proposals/{proposal['id']}/{suffix}"


def decision_payload(proposal, accepted=None):
    accepted = accepted if accepted is not None else [i["id"] for i in proposal["items"]]
    return {
        "version": proposal["version"],
        "channel": "phone",
        "contact": "Клиент",
        "comment": "Клиент подтвердил решение по телефону",
        "decided_at": datetime.now(UTC).isoformat(),
        "decisions": {
            i["id"]: "accepted" if i["id"] in accepted else "declined" for i in proposal["items"]
        },
    }


def decide(client, accepted=None):
    p = current(client)
    response = client.post(path(p, "decision"), json=decision_payload(p, accepted))
    assert response.status_code == 200, response.text
    return response.json()


def release(client, p):
    response = client.post(path(p, "release"), json={"version": p["version"]})
    assert response.status_code == 200, response.text
    return response.json()


def draft_payload():
    return {
        "title": "Дополнительная диагностика",
        "reason": "Обнаружен посторонний звук",
        "items": [
            {
                "id": "test-work",
                "kind": "work",
                "title": "Диагностика",
                "unit_price": 12345,
                "quantity": 3,
                "duration_minutes": 20,
            }
        ],
    }


def test_pending_proposal_does_not_increase_bill_or_due(client):
    order = client.get(ORDER).json()
    assert order["totals"]["confirmed"] == 1850000
    assert order["totals"]["pending_extra"] == 1340000
    assert order["totals"]["due_at"] == order["baseline_due_at"]
    assert client.get(f"{ORDER}/document").json()["approved_items"] == []


def test_partial_approval_recalculates_and_preserves_evidence(client):
    p = decide(client, ["brake-work", "brake-part"])
    assert p["outcome"] == "partial"
    assert p["approved_total"] == 920000
    order = client.get(ORDER).json()
    assert order["totals"]["confirmed"] == 2770000
    assert datetime.fromisoformat(order["totals"]["due_at"]) == (
        datetime.fromisoformat(order["baseline_due_at"]) + timedelta(hours=1)
    )
    document = client.get(f"{ORDER}/document").json()
    assert {i["id"] for i in document["approved_items"]} == {"brake-work", "brake-part"}
    assert document["approved_items"][0]["evidence"]["actor"]["id"] == "advisor"
    assert document["approved_items"][0]["evidence"]["channel"] == "phone"
    history = client.get(f"{ORDER}/history").json()
    assert history[0]["before"]["status"] == "awaiting"
    assert history[0]["after"]["status"] == "decided"


def test_full_approval_accounts_for_supply_delay(client):
    p = decide(client)
    assert p["outcome"] == "full"
    totals = client.get(ORDER).json()["totals"]
    assert totals["confirmed"] == 3190000
    assert totals["extra_minutes"] == 100
    assert totals["supply_days"] == 1


def test_full_rejection_cannot_be_released(client):
    p = decide(client, [])
    assert p["outcome"] == "rejected"
    assert client.get(ORDER).json()["totals"]["confirmed"] == 1850000
    assert client.post(path(p, "release"), json={"version": p["version"]}).status_code == 409


def test_required_part_must_be_approved_and_failure_rolls_back(client):
    p = current(client)
    before_events = client.get(f"{ORDER}/history").json()
    response = client.post(path(p, "decision"), json=decision_payload(p, ["brake-work"]))
    assert response.status_code == 422
    assert current(client)["version"] == p["version"]
    assert current(client)["status"] == "awaiting"
    assert client.get(f"{ORDER}/history").json() == before_events


def test_must_decide_every_line(client):
    p = current(client)
    data = decision_payload(p)
    del data["decisions"]["belt-part"]
    assert client.post(path(p, "decision"), json=data).status_code == 422


@pytest.mark.parametrize("headers", [MECHANIC, CASHIER])
def test_only_advisor_or_manager_can_record_consent(client, headers):
    p = current(client)
    assert (
        client.post(path(p, "decision"), json=decision_payload(p), headers=headers).status_code
        == 403
    )


def test_mechanic_cannot_start_before_consent_or_release(client):
    p = current(client)
    assert (
        client.post(
            path(p, "items/brake-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 409
    )
    p = decide(client)
    assert (
        client.post(
            path(p, "items/brake-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 409
    )


def test_only_approved_available_work_can_start_and_finish(client):
    p = release(client, decide(client, ["brake-work", "brake-part"]))
    assert (
        client.post(
            path(p, "items/belt-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 409
    )
    response = client.post(
        path(p, "items/brake-work/start"), json={"version": p["version"]}, headers=MECHANIC
    )
    assert response.status_code == 200
    p = response.json()
    assert next(i for i in p["items"] if i["id"] == "brake-part")["execution"] == "consumed"
    assert (
        client.post(
            path(p, "items/brake-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 409
    )
    response = client.post(
        path(p, "items/brake-work/complete"), json={"version": p["version"]}, headers=MECHANIC
    )
    assert response.status_code == 200
    assert response.json()["items"][0]["execution"] == "completed"


def test_stock_blocks_work_until_arrival(client):
    p = release(client, decide(client))
    assert (
        client.post(
            path(p, "items/belt-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 409
    )
    response = client.post(
        path(p, "items/belt-part/stock"),
        json={"version": p["version"], "in_stock": True, "comment": "Запчасть принята на склад"},
    )
    assert response.status_code == 200
    p = response.json()
    assert (
        client.post(
            path(p, "items/belt-work/start"), json={"version": p["version"]}, headers=MECHANIC
        ).status_code
        == 200
    )


def test_started_work_cannot_be_cancelled_or_revised(client):
    p = release(client, decide(client))
    p = client.post(
        path(p, "items/brake-work/start"), json={"version": p["version"]}, headers=MECHANIC
    ).json()
    for action in ("cancel", "revise"):
        assert (
            client.post(
                path(p, action),
                json={"version": p["version"], "comment": "Клиент передумал"},
                headers=MANAGER,
            ).status_code
            == 409
        )
    assert client.get(ORDER).json()["totals"]["confirmed"] == 3190000


def test_manager_can_revoke_unstarted_approval_with_history(client):
    p = decide(client)
    data = {"version": p["version"], "comment": "Клиент отозвал согласие до начала работ"}
    assert client.post(path(p, "cancel"), json=data).status_code == 403
    assert client.post(path(p, "cancel"), json=data, headers=MANAGER).status_code == 200
    assert client.get(ORDER).json()["totals"]["confirmed"] == 1850000
    assert client.get(f"{ORDER}/document").json()["approved_items"] == []
    assert client.get(f"{ORDER}/history").json()[0]["before"]["decision"] is not None


def test_price_change_requires_new_revision_and_new_consent(client):
    old = decide(client)
    payload = draft_payload() | {"version": old["version"]}
    assert client.put(path(old, "").rstrip("/"), json=payload).status_code == 409
    response = client.post(
        path(old, "revise"),
        json={
            "version": old["version"],
            "comment": "Поставщик изменил цену, требуется пересогласование",
        },
        headers=MANAGER,
    )
    assert response.status_code == 201
    revised = response.json()
    assert revised["parent_id"] == old["id"] and revised["revision"] == 2
    assert revised["status"] == "draft" and revised["decision"] is None
    assert all(i["decision"] == "pending" for i in revised["items"])
    assert client.get(ORDER).json()["totals"]["confirmed"] == 1850000
    assert client.get(ORDER).json()["proposals"][0]["items"] == old["items"]
    payload["version"] = revised["version"]
    assert client.put(path(revised, "").rstrip("/"), json=payload).status_code == 200


def test_repeated_decision_does_not_double_charge(client):
    old = current(client)
    data = decision_payload(old)
    assert client.post(path(old, "decision"), json=data).status_code == 200
    assert client.post(path(old, "decision"), json=data).status_code == 409
    assert client.get(ORDER).json()["totals"]["confirmed"] == 3190000


def test_two_concurrent_updates_only_one_wins(client):
    p = current(client)

    def write(note):
        return client.post(path(p, "note"), json={"version": p["version"], "comment": note})

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(write, ["Первый сотрудник", "Второй сотрудник"]))
    assert sorted(r.status_code for r in responses) == [200, 409]
    assert current(client)["version"] == p["version"] + 1


def test_exact_money_with_quantity_and_new_proposal(client):
    response = client.post(f"{ORDER}/proposals", json=draft_payload(), headers=MECHANIC)
    assert response.status_code == 201
    p = response.json()
    assert p["total"] == 37035
    assert client.get(ORDER).json()["totals"]["confirmed"] == 1850000
    response = client.post(
        path(p, "submit"),
        json={
            "version": p["version"],
            "channel": "email",
            "contact": "Клиент",
            "comment": "Письмо отправлено клиенту",
        },
    )
    assert response.status_code == 200
    p = response.json()
    assert client.post(path(p, "decision"), json=decision_payload(p)).status_code == 200
    assert client.get(ORDER).json()["totals"]["confirmed"] == 1887035


@pytest.mark.parametrize(
    "field,value",
    [
        ("unit_price", -1),
        ("unit_price", 1.5),
        ("quantity", 0),
        ("quantity", 1.5),
        ("duration_minutes", 0),
    ],
)
def test_invalid_line_values_rejected(client, field, value):
    data = draft_payload()
    data["items"][0][field] = value
    assert client.post(f"{ORDER}/proposals", json=data).status_code == 422


def test_invalid_dependency_rejected(client):
    data = draft_payload()
    data["items"][0]["requires"] = ["missing-part"]
    assert client.post(f"{ORDER}/proposals", json=data).status_code == 422


@pytest.mark.parametrize(
    "timestamp", ["2020-01-01T12:00:00+00:00", "2020-01-01T12:00:00", "2099-01-01T12:00:00+00:00"]
)
def test_invalid_decision_time_rejected(client, timestamp):
    p = current(client)
    data = decision_payload(p) | {"decided_at": timestamp}
    assert client.post(path(p, "decision"), json=data).status_code == 422


def test_cashier_cannot_create_and_unknown_actor_rejected(client):
    assert (
        client.post(f"{ORDER}/proposals", json=draft_payload(), headers=CASHIER).status_code == 403
    )
    assert (
        client.post(
            f"{ORDER}/proposals", json=draft_payload(), headers={"X-Demo-Actor": "outsider"}
        ).status_code
        == 400
    )


def test_restart_preserves_saved_decision(tmp_path):
    from fastapi.testclient import TestClient

    from app.main import create_app

    url = f"sqlite:///{tmp_path / 'persistent.db'}"
    with TestClient(create_app(url, True)) as client:
        decide(client, ["brake-work", "brake-part"])
    with TestClient(create_app(url, True)) as client:
        assert client.get(ORDER).json()["totals"]["confirmed"] == 2770000
        assert len(client.get(ORDER).json()["proposals"]) == 1
