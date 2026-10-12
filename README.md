# Skipline

Waiting in a line can take time away from work, rest, and family. Skipline lets people join from a QR code and see their place while staff call the next person.

## How to run

1. Install Python 3.13 and [uv](https://docs.astral.sh/uv/).
2. From the project folder, run `uv sync`.
3. Start the app with `uv run gunicorn --bind 0.0.0.0:5000 artifacts.queueless.app:app`.
4. Open `http://localhost:5000`.

Queue data is held in memory and clears if the server restarts or staff reset the queue.

## Live URL

Not published yet. Publish Skipline from Replit to create its public URL; the QR page automatically uses the address it is opened from.

## Who pays

Businesses pay Rs 499/month per counter, while hospitals and offices pay a flat annual fee.

## How it spreads

The QR is shown to every customer, so every visit is free distribution.

## Global scale

The same pattern works everywhere: a queue, a counter and a phone, from clinics to airports.

## Social impact

Skipline saves time for the elderly, daily-wage workers and patients.
