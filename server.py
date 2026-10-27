import os
import secrets
import sqlite3
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

import gemini_service
from gemini_service import GeminiError

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get('FLASK_SECRET_KEY') or secrets.token_hex(32)

# Only these files are served to the browser; the database and Python sources are never exposed.
PUBLIC_FILES = {'index.html', 'app.js', 'gemini-api.js', 'mock-data.js', 'styles.css', 'hero_travel_bg.png'}

DB_FILE = 'travel_planner.db'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL
        )
    ''')
    
    # Create trips table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            destination TEXT NOT NULL,
            duration INTEGER NOT NULL,
            budget TEXT NOT NULL,
            style TEXT NOT NULL,
            itinerary_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if path not in PUBLIC_FILES:
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', path)

# AI Endpoints
@app.route('/api/config', methods=['GET'])
def get_config():
    return jsonify({'ai_enabled': gemini_service.has_api_key()})

@app.route('/api/plan', methods=['POST'])
def generate_plan():
    if not gemini_service.has_api_key():
        return jsonify({'error': 'AI generation is not configured on the server.'}), 503

    data = request.get_json(silent=True) or {}
    destination = str(data.get('destination') or '').strip()
    style = str(data.get('style') or '').strip()
    # Budget is a category ("Budget", "Standard", "Luxury") or free text such as "$150/day".
    budget = str(data.get('budget') or '').strip()
    try:
        duration = int(data.get('duration'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Duration must be a whole number.'}), 400

    if not destination or not style or not budget:
        return jsonify({'error': 'Destination, budget and travel style are required.'}), 400
    if len(destination) > 200:
        return jsonify({'error': 'Destination must be 200 characters or fewer.'}), 400
    if len(budget) > 100 or len(style) > 100:
        return jsonify({'error': 'Budget and travel style must be 100 characters or fewer.'}), 400
    if not 1 <= duration <= 30:
        return jsonify({'error': 'Duration must be between 1 and 30 days.'}), 400
    try:
        if float(budget) <= 0:
            return jsonify({'error': 'Budget must be greater than 0.'}), 400
    except ValueError:
        pass

    try:
        plan = gemini_service.generate_plan(destination, duration, budget, style)
    except GeminiError as e:
        return jsonify({'error': str(e)}), 502
    return jsonify({'plan': plan})

# Authentication Endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    name = data.get('name', '').strip()
    
    if not username or not password or not name:
        return jsonify({'error': 'Missing required fields'}), 400
        
    password_hash = generate_password_hash(password)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)',
            (username, password_hash, name)
        )
        conn.commit()
        return jsonify({'message': 'Registration successful'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 409
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['name'] = user['name']
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': user['id'],
                'username': user['username'],
                'name': user['name']
            }
        })
    else:
        return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'logged_in': False}), 200
        
    return jsonify({
        'logged_in': True,
        'user': {
            'id': session['user_id'],
            'username': session['username'],
            'name': session['name']
        }
    })

# Trip Endpoints
@app.route('/api/trips', methods=['POST'])
def save_trip():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized. Please login to save trips.'}), 401
        
    data = request.get_json() or {}
    destination = data.get('destination', '').strip()
    duration = data.get('duration')
    budget = data.get('budget', '').strip()
    style = data.get('style', '').strip()
    itinerary_data = data.get('itinerary_data')
    
    if not destination or not duration or not budget or not style or not itinerary_data:
        return jsonify({'error': 'Missing required trip fields'}), 400
        
    # If itinerary_data is passed as a dict, serialize it to string
    if isinstance(itinerary_data, (dict, list)):
        itinerary_data_str = json.dumps(itinerary_data)
    else:
        itinerary_data_str = str(itinerary_data)
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        '''INSERT INTO trips (user_id, destination, duration, budget, style, itinerary_data)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (session['user_id'], destination, duration, budget, style, itinerary_data_str)
    )
    conn.commit()
    trip_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'message': 'Trip saved successfully',
        'trip_id': trip_id
    }), 201

@app.route('/api/trips', methods=['GET'])
def get_trips():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'SELECT * FROM trips WHERE user_id = ? ORDER BY created_at DESC',
        (session['user_id'],)
    )
    rows = cursor.fetchall()
    conn.close()
    
    trips = []
    for row in rows:
        try:
            itinerary_json = json.loads(row['itinerary_data'])
        except Exception:
            itinerary_json = row['itinerary_data']
            
        trips.append({
            'id': row['id'],
            'destination': row['destination'],
            'duration': row['duration'],
            'budget': row['budget'],
            'style': row['style'],
            'itinerary_data': itinerary_json,
            'created_at': row['created_at']
        })
        
    return jsonify({'trips': trips})

@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check ownership
    cursor.execute('SELECT user_id FROM trips WHERE id = ?', (trip_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Trip not found'}), 404
        
    if row['user_id'] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Forbidden. You do not own this trip.'}), 403
        
    cursor.execute('DELETE FROM trips WHERE id = ?', (trip_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Trip deleted successfully'})

if __name__ == '__main__':
    # Running on local interface
    app.run(host='127.0.0.1', port=5000, debug=os.environ.get('FLASK_DEBUG') == '1')
