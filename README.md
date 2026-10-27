# voyageAI Travel Planner (Python backend)

Flask + SQLite travel planner. Live itineraries come from Google Gemini, called by the
Python server (`gemini_service.py`). The API key stays on the server and is never sent
to the browser.

## Setup

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill it in:

- `GEMINI_API_KEY` – your key from https://aistudio.google.com/
- `FLASK_SECRET_KEY` – any long random string (keeps logins valid across restarts)

Never commit `.env`.

## Run

```bash
python server.py
```

Open http://127.0.0.1:5000

Without `GEMINI_API_KEY` the app runs in demo mode using the built-in sample cities.
Set `FLASK_DEBUG=1` to enable Flask debug mode during development.
