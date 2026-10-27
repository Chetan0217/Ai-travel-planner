# VoyageAI Travel Planner

An AI travel planner written in **Python** (Flask + SQLite). Every page is rendered on
the server with HTML templates, so the app uses **no JavaScript**. Live itineraries come
from Google Gemini, which the Python server calls. The API key stays on the server.

## Setup

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill it in:

- `GEMINI_API_KEY`: your key from https://aistudio.google.com/
- `FLASK_SECRET_KEY`: any long random string. It keeps logins valid across restarts.

Never commit `.env`.

## Run

```bash
python server.py
```

Then open http://127.0.0.1:5000.

Without `GEMINI_API_KEY`, the app runs in demo mode with 34 pre-loaded cities. Live AI
plans take 45 to 65 seconds. During that time a "Generating…" page refreshes itself every 3 seconds.

## Project layout

| Path | What it does |
| --- | --- |
| `server.py` | Flask routes: planner form, plan pages, login/register, saved trips |
| `gemini_service.py` | Prompt, response schema and the Gemini API call |
| `planner.py` | Demo plans, photo lookup, map coordinates, route map |
| `data/` | Demo city plans and photo/coordinate lookup tables (JSON) |
| `templates/` | Jinja HTML templates |
| `static/` | Stylesheet and background image |

## How it works without JavaScript

- Budget, style and companion choices are radio buttons styled as chips.
- City suggestions use the browser's built-in `<datalist>`.
- Day tabs, login and saved trips are normal links and forms.
- The route map is an SVG drawn by Python. It includes a link that opens the route in Google Maps.
- POST forms are protected with a CSRF token.
