from flask import Flask, request, jsonify, session
from flask_cors import CORS
from datetime import datetime
from pathlib import Path
import os, json, uuid

app = Flask(__name__)
# schimba daca vrei: export FLASK_SECRET=... / pe Render setezi din Dashboard
app.secret_key = os.environ.get("FLASK_SECRET", "Thea2025_secret")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "Thea2025")

# ===== fisier JSON in radacina proiectului =====
# /backend/app.py -> parintele e radacina repo-ului
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "responses.json"

def load_data():
    if not DATA_FILE.exists():
        return []
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []

def save_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ===== CORS =====
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# ===== Health / Keep-alive =====
@app.get("/health")
def health():
    return jsonify({"ok": True, "ts": datetime.utcnow().isoformat()})

@app.get("/api/ping")
def ping():
    return jsonify({"pong": True, "ts": datetime.utcnow().isoformat()})

# ===== Auth admin =====
@app.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    key = body.get("key") or request.form.get("key")
    if key == ADMIN_KEY:
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"error": "parola gresita"}), 403

@app.post("/logout")
def logout():
    session.pop("admin", None)
    return jsonify({"ok": True})

def is_admin():
    # accepta si ?key=Thea2025 ca fallback
    if session.get("admin"):
        return True
    if request.args.get("key") == ADMIN_KEY:
        return True
    return False

# ===== RSVP =====
@app.post("/rsvp")
def rsvp():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    status = (body.get("status") or "").strip().lower()  # "particip" / "nu"
    persons = body.get("persons")
    note = (body.get("note") or "").strip()
    phone = (body.get("phone") or "").strip()

    if not name or status not in {"particip", "nu"}:
        return jsonify({"error": "campuri invalide"}), 400

    try:
        persons = int(persons) if persons is not None else 1
        if persons < 0:
            persons = 0
    except Exception:
        persons = 1

    data = load_data()
    entry = {
        "id": str(uuid.uuid4()),
        "name": name,
        "status": status,          # "particip" sau "nu"
        "persons": persons,        # cate persoane
        "phone": phone,
        "note": note,
        "timestamp": datetime.utcnow().isoformat()
    }
    data.append(entry)
    save_data(data)
    return jsonify({"ok": True, "item": entry})

# ===== Lista admin =====
@app.get("/lista")
def lista():
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    return jsonify(load_data())

# ===== Stergere =====
@app.delete("/sterge/<item_id>")
def sterge(item_id):
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    data = load_data()
    new_data = [x for x in data if x.get("id") != item_id]
    if len(new_data) == len(data):
        return jsonify({"error": "id inexistent"}), 404
    save_data(new_data)
    return jsonify({"ok": True})

# ===== Statistici =====
@app.get("/stats")
def stats():
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    data = load_data()
    confirm = sum(1 for x in data if x.get("status") == "particip")
    decline = sum(1 for x in data if x.get("status") == "nu")
    total_persons = sum(int(x.get("persons") or 0) for x in data if x.get("status") == "particip")
    return jsonify({
        "confirmari": confirm,
        "refuzuri": decline,
        "total_persoane": total_persons,
        "total_inregistrari": len(data),
    })

if __name__ == "__main__":
    # local dev
    app.run(host="0.0.0.0", port=5000, debug=True)
