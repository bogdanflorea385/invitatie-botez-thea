from flask import Flask, request, jsonify, redirect, send_from_directory
from datetime import datetime
from pathlib import Path
import json
import os

app = Flask(__name__)
app.secret_key = "Thea2025"

# === responses.json este la rădăcina proiectului (un nivel mai sus de /backend) ===
BASE_DIR = Path(__file__).resolve().parents[1]   # folderul proiectului
DATA_FILE = BASE_DIR / "responses.json"


# ---------- utilitare fișier ----------
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


# ---------- CORS (pentru file:// și localhost) ----------
@app.after_request
def add_cors_headers(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


# ---------- UX: / și /favicon.ico ca să nu mai vezi 404 ----------
@app.route("/")
def root():
    return redirect("/lista")

@app.route("/favicon.ico")
def favicon():
    ico_dir = BASE_DIR / "img"
    ico_path = ico_dir / "favicon.ico"
    if ico_path.exists():
        return send_from_directory(ico_dir, "favicon.ico",
                                   mimetype="image/vnd.microsoft.icon")
    return ("", 204)


# ---------- API ----------
@app.route("/rsvp", methods=["POST", "OPTIONS"])
def rsvp():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}

    nume = (payload.get("nume") or "").strip()
    prezenta = (payload.get("prezenta") or "").strip().lower()   # ex: "particip" / "nu_particip" / "da" / "nu"
    persoane = int(payload.get("persoane") or 0)

    if not nume:
        return jsonify({"error": "Numele este obligatoriu"}), 400

    # Normalizează valori diverse spre cele folosite în admin.html
    if prezenta in ("da", "vin", "particip"):
        prezenta = "particip"
        if persoane <= 0:
            persoane = 1
    elif prezenta in ("nu", "nu_vin", "nu_particip"):
        prezenta = "nu_particip"
        persoane = 0
    else:
        prezenta = "particip"
        if persoane <= 0:
            persoane = 1

    data = load_data()
    data.append({
        "nume": nume,
        "prezenta": prezenta,      # "particip" | "nu_particip"
        "persoane": persoane,      # întreg
        "timestamp": datetime.now().isoformat(timespec="seconds")
    })
    save_data(data)

    # răspuns simplu; front-end-ul tău tratează oricum ok pe status 200
    return jsonify({"ok": True, "message": "Multumim! Am inregistrat confirmarea ta ❤️"}), 200


@app.route("/lista", methods=["GET"])
def lista():
    # IMPORTANT: returnăm DOAR lista, nu un obiect cu statistici
    return jsonify(load_data())


@app.route("/delete", methods=["POST", "OPTIONS"])
def delete_entry():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    idx = payload.get("index")

    data = load_data()
    if idx is None or not isinstance(idx, int) or idx < 0 or idx >= len(data):
        return jsonify({"error": "index invalid"}), 400

    deleted = data.pop(idx)
    save_data(data)
    return jsonify({"ok": True, "deleted": deleted}), 200


if __name__ == "__main__":
    # rulează pe 5000 (așa vrei tu) și fără reloader ca să nu dubleze procesele
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
