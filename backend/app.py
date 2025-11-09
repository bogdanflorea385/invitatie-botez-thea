from flask import Flask, request, jsonify, session
from flask_cors import CORS
from datetime import datetime
from pathlib import Path
import os, json, uuid

app = Flask(__name__)

# Secret din env (pe Render l-ai numit SECRET_KEY)
app.secret_key = os.environ.get("SECRET_KEY", "Thea2025_secret")
ADMIN_KEY = os.environ.get("ADMIN_KEY", "Thea2025")

# ===== stocare JSON in radacina repo-ului =====
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
# Pentru inceput permitem de oriunde. Daca vrei, il restrangem la GitHub Pages mai tarziu.
CORS(app, resources={r"/*": {"origins": "*"}})

# ===== Health =====
@app.get("/")
def root_health():
    return jsonify({"status": "ok", "service": "invitatie-botez-thea-backend", "ts": datetime.utcnow().isoformat()})

@app.get("/health")
def health():
    return jsonify({"ok": True, "ts": datetime.utcnow().isoformat()})

@app.get("/api/ping")
def ping():
    return jsonify({"pong": True, "ts": datetime.utcnow().isoformat()})

# ===== Auth admin (optional; folosim si ?key=...) =====
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
    if session.get("admin"):
        return True
    if request.args.get("key") == ADMIN_KEY:
        return True
    return False

# ===== RSVP =====
@app.post("/rsvp")
def rsvp():
    body = request.get_json(silent=True) or {}

    # Acceptam atat schema veche (nume/particip/persoane), cat si cea noua (name/status/persons)
    nume = (body.get("nume") or body.get("name") or "").strip()

    # status din "particip"(bool/str) sau "status" ("particip"/"nu")
    particip_val = body.get("particip")
    status_str = (body.get("status") or "").strip().lower()

    if status_str in {"particip", "da", "yes", "y", "true"}:
        status = "particip"
    elif status_str in {"nu", "no", "n", "false"}:
        status = "nu"
    elif isinstance(particip_val, bool):
        status = "particip" if particip_val else "nu"
    else:
        status = ""

    # persoane/persons
    persoane = body.get("persoane", body.get("persons", 1))
    try:
        persoane = int(persoane)
        if persoane < 0:
            persoane = 0
    except Exception:
        persoane = 1

    note = (body.get("note") or "").strip()
    phone = (body.get("phone") or "").strip()

    if not nume or status not in {"particip", "nu"}:
        return jsonify({"error": "campuri invalide"}), 400

    data = load_data()
    entry = {
        "id": str(uuid.uuid4()),
        "nume": nume,
        "status": status,           # "particip" sau "nu"
        "persoane": persoane,       # cate persoane
        "phone": phone,
        "note": note,
        "timestamp": datetime.utcnow().isoformat()
    }
    data.append(entry)
    save_data(data)
    return jsonify({"ok": True, "item": entry}), 201

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
    total_persons = sum(int(x.get("persoane") or 0) for x in data if x.get("status") == "particip")
    return jsonify({
        "confirmari": confirm,
        "refuzuri": decline,
        "total_persoane": total_persons,
        "total_inregistrari": len(data),
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
