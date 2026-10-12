from __future__ import annotations

import base64
import io
import os
import threading
import time
import uuid
from pathlib import Path
from typing import Any

import qrcode
from flask import Flask, jsonify, render_template, request, url_for
from werkzeug.middleware.proxy_fix import ProxyFix


ROOT = Path(__file__).resolve().parent
app = Flask(
    __name__,
    template_folder=str(ROOT / "templates"),
    static_folder=str(ROOT / "static"),
)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
app.json.sort_keys = False

# Queue state intentionally lives only for the lifetime of this Python process.
lock = threading.RLock()
tickets: dict[str, dict[str, Any]] = {}
next_token = 1
current_id: str | None = None
click_times: list[float] = []


def average_service_minutes() -> float:
    """Mean time between Call Next clicks, with a safe 3-minute starter value."""
    if len(click_times) < 2:
        return 3.0
    gaps = [
        (later - earlier) / 60.0
        for earlier, later in zip(click_times, click_times[1:])
    ]
    mean = sum(gaps) / len(gaps)
    return round(max(0.5, min(15.0, mean)), 1)


def now_serving_token() -> int | None:
    if current_id and current_id in tickets:
        return tickets[current_id]["token"]
    return None


def get_waiting() -> list[dict[str, Any]]:
    return [
        ticket
        for ticket in tickets.values()
        if ticket["state"] == "waiting"
    ]


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/join")
def join_page():
    return render_template("join.html")


@app.get("/admin")
def admin_page():
    return render_template("admin.html")


@app.get("/qr")
def qr_page():
    join_url = url_for("join_page", _external=True)
    image = qrcode.make(join_url)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    qr_data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return render_template("qr.html", qr_data=qr_data, join_url=join_url)


@app.get("/favicon.ico")
def favicon():
    return "", 204


@app.post("/api/join")
def join_queue():
    global next_token
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="Send a JSON object with a name."), 400

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        return jsonify(error="Please enter your name."), 400
    name = name.strip()
    if len(name) > 60:
        return jsonify(error="Name must be 60 characters or fewer."), 400

    with lock:
        ticket_id = uuid.uuid4().hex
        token = next_token
        next_token += 1
        tickets[ticket_id] = {
            "id": ticket_id,
            "token": token,
            "name": name,
            "state": "waiting",
        }
        return jsonify(id=ticket_id, token=token), 201


@app.get("/api/status/<ticket_id>")
def ticket_status(ticket_id: str):
    with lock:
        ticket = tickets.get(ticket_id)
        if ticket is None:
            return jsonify(error="This queue ticket was not found. It may have been reset."), 404

        waiting = get_waiting()
        ahead = 0
        if ticket["state"] == "waiting":
            for waiting_ticket in waiting:
                if waiting_ticket["id"] == ticket_id:
                    break
                ahead += 1

        average = average_service_minutes()
        return jsonify(
            token=ticket["token"],
            ahead=ahead,
            wait_min=round(ahead * average, 1),
            state=ticket["state"],
            now_serving=now_serving_token(),
        )


@app.get("/api/queue")
def queue_status():
    with lock:
        current = tickets.get(current_id) if current_id else None
        average = average_service_minutes()
        return jsonify(
            now_serving=now_serving_token(),
            current_name=current["name"] if current else None,
            avg_min=average,
            learning=len(click_times) < 2,
            click_count=len(click_times),
            waiting=[
                {
                    "id": ticket["id"],
                    "token": ticket["token"],
                    "name": ticket["name"],
                }
                for ticket in get_waiting()
            ],
        )


@app.post("/api/next")
def call_next():
    global current_id
    with lock:
        # Include every button press in the estimate, even if the queue is empty.
        click_times.append(time.time())

        if current_id and current_id in tickets:
            tickets[current_id]["state"] = "done"
            current_id = None

        next_ticket = next(
            (ticket for ticket in tickets.values() if ticket["state"] == "waiting"),
            None,
        )
        if next_ticket:
            next_ticket["state"] = "called"
            current_id = next_ticket["id"]

        waiting_count = len(get_waiting())
        return jsonify(
            now_serving=now_serving_token(),
            avg_min=average_service_minutes(),
            click_count=len(click_times),
            waiting_count=waiting_count,
        )


@app.post("/api/reset")
def reset_queue():
    global next_token, current_id
    with lock:
        tickets.clear()
        next_token = 1
        current_id = None
        click_times.clear()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
