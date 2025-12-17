from flask import Flask, request, jsonify, session
from flask_cors import CORS
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os, json, uuid, threading
import secrets, string

import psycopg2
import psycopg2.extras

# ================== App & Config ==================
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "Thea2025_secret")

ADMIN_KEY    = os.environ.get("ADMIN_KEY", "Thea2025")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# ================== CORS ==================
# Origini permise (GitHub Pages + domeniul tau)
GHP_ORIGIN     = "https://bogdanflorea385.github.io"
IPV_ORIGIN_1   = "https://impreunainpoveste.ro"
IPV_ORIGIN_2   = "https://www.impreunainpoveste.ro"

ALLOWED_ORIGINS = [GHP_ORIGIN, IPV_ORIGIN_1, IPV_ORIGIN_2]

CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=False,
)

@app.after_request
def add_cors_headers(resp):
    # headers clare pe toate raspunsurile (inclusiv preflight)
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
    else:
        resp.headers["Access-Control-Allow-Origin"] = GHP_ORIGIN

    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,DELETE,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-ADMIN-KEY"
    return resp

# Preflight generic
@app.route("/<path:_any>", methods=["OPTIONS"])
def any_options(_any):
    return ("", 204)

# ================== DB (Neon / Postgres) ==================
def db():
    # DATABASE_URL vine din Render Environment
    return psycopg2.connect(DATABASE_URL, sslmode="require")

# ================== Stocare pe disc (RSVP legacy) ==================
# Preferam /data (disk persistent Render). Daca nu exista, cadem pe repo.
BASE_DIR  = Path(__file__).resolve().parents[1]          # parintele lui /backend
REPO_FILE = BASE_DIR / "responses.json"                  # fallback
DATA_DIR  = Path("/data")

if DATA_DIR.exists():
    DATA_FILE = DATA_DIR / "responses.json"
    # Migrare one-shot din repo -> /data, daca pe /data nu exista inca
    try:
        if (not DATA_FILE.exists()) and REPO_FILE.exists():
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            DATA_FILE.write_text(REPO_FILE.read_text(encoding="utf-8"), encoding="utf-8")
    except Exception as e:
        print("WARN: nu am putut migra responses.json pe /data:", e)
else:
    DATA_FILE = REPO_FILE

_lock = threading.Lock()

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
    tmp = DATA_FILE.with_suffix(DATA_FILE.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)  # atomic replace

# ================== Utilitare (RSVP) ==================
TRUE_SET  = {"true", "1", "y", "yes", "da", "particip", "vin"}
FALSE_SET = {"false", "0", "n", "no", "nu", "nu_particip", "nu_vin"}

def coerce_status(body):
    # 1) bool / numeric pe 'participare' sau 'particip'
    for key in ("participare", "particip"):
        if key in body:
            v = body.get(key)
            if isinstance(v, bool):
                return "particip" if v else "nu"
            if isinstance(v, (int, float)):
                return "particip" if int(v) != 0 else "nu"
            if isinstance(v, str):
                s = v.strip().lower()
                if s in TRUE_SET:  return "particip"
                if s in FALSE_SET: return "nu"
    # 2) string pe 'status' sau 'prezenta'
    for key in ("status", "prezenta"):
        if isinstance(body.get(key), str):
            s = body.get(key, "").strip().lower()
            if s in TRUE_SET:  return "particip"
            if s in FALSE_SET: return "nu"
    return ""

def coerce_int(v, default=1, min_value=0):
    try:
        n = int(v)
        return n if n >= min_value else min_value
    except Exception:
        return default

# ================== Health ==================
@app.get("/")
def root_health():
    return jsonify({"status": "ok", "service": "invitatie-botez-thea-backend", "ts": datetime.utcnow().isoformat()})

@app.get("/health")
def health():
    # optional: scriem un mic log pe /data ca sa vedem ca discul e montat
    try:
        if DATA_DIR.exists():
            Path(DATA_DIR / "health.txt").write_text(datetime.utcnow().isoformat(), encoding="utf-8")
    except Exception:
        pass
    return jsonify({"ok": True, "ts": datetime.utcnow().isoformat(), "data_file": str(DATA_FILE)})

@app.get("/api/ping")
def ping():
    return jsonify({"pong": True, "ts": datetime.utcnow().isoformat()})

# ================== Auth (admin) ==================
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

# ================== RSVP ==================
@app.route("/rsvp", methods=["POST", "OPTIONS"])
def rsvp():
    if request.method == "OPTIONS":
        return ("", 204)

    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Content-Type application/json lipsa sau JSON invalid"}), 400

    nume     = (body.get("nume") or body.get("name") or "").strip()
    status   = coerce_status(body)
    persoane = coerce_int(body.get("persoane", body.get("persons", 1)), default=1, min_value=0)
    phone    = (body.get("phone")  or body.get("telefon") or "").strip()
    note     = (body.get("note")   or body.get("mesaj")   or "").strip()

    if not nume:
        return jsonify({"error": "camp 'nume' lipsa"}), 400
    if status not in {"particip", "nu"}:
        return jsonify({
            "error": "camp 'status/participare' lipsa sau invalid",
            "detalii_acceptate": {"participare": "bool/str", "particip": "bool/str", "status": "particip/nu", "prezenta": "da/nu"}
        }), 400

    entry = {
        "id": str(uuid.uuid4()),
        "nume": nume,
        "status": status,
        "persoane": persoane,
        "phone": phone,
        "note": note,
        "timestamp": datetime.utcnow().isoformat()
    }

    with _lock:
        data = load_data()
        data.append(entry)
        save_data(data)

    return jsonify({"ok": True, "item": entry}), 201

# ================== Lista / Stergere / Statistici ==================
@app.get("/lista")
def lista():
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    return jsonify(load_data())

@app.delete("/sterge/<item_id>")
def sterge(item_id):
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    with _lock:
        data = load_data()
        new_data = [x for x in data if x.get("id") != item_id]
        if len(new_data) == len(data):
            return jsonify({"error": "id inexistent"}), 404
        save_data(new_data)
    return jsonify({"ok": True})

@app.get("/stats")
def stats():
    if not is_admin():
        return jsonify({"error": "neautorizat"}), 403
    data = load_data()
    confirm        = sum(1 for x in data if x.get("status") == "particip")
    decline        = sum(1 for x in data if x.get("status") == "nu")
    total_persoane = sum(coerce_int(x.get("persoane"), default=0, min_value=0) for x in data if x.get("status") == "particip")
    return jsonify({
        "confirmari": confirm,
        "refuzuri": decline,
        "total_persoane": total_persoane,
        "total_inregistrari": len(data),
    })

# ================== Santa Demo (Pasul 2) ==================
def _gen_code():
    alphabet = string.ascii_uppercase + string.digits
    return "MOS-" + "".join(secrets.choice(alphabet) for _ in range(6))

def _gen_token(n=24):
    return secrets.token_urlsafe(n)

@app.post("/api/santa/demo/create")
def santa_demo_create():
    # protectie admin (header)
    if request.headers.get("X-ADMIN-KEY", "") != ADMIN_KEY:
        return jsonify({"ok": False, "error": "unauthorized"}), 401

    if not DATABASE_URL:
        return jsonify({"ok": False, "error": "missing_database_url"}), 500

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=72)

    for _ in range(10):
        code = _gen_code()
        child_token = _gen_token()
        parent_token = _gen_token()

        try:
            with db() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO orders (code, status, created_at, expires_at, child_token, parent_token)
                    VALUES (%s, 'demo', %s, %s, %s, %s)
                    RETURNING id, code, expires_at, child_token, parent_token
                """, (code, now, expires_at, child_token, parent_token))
                row = cur.fetchone()

            return jsonify({
                "ok": True,
                "order_id": row["id"],
                "code": row["code"],
                "expires_at": row["expires_at"].isoformat(),
                "child_url": f"https://impreunainpoveste.ro/mos/c.html?t={row['child_token']}",
                "parent_url": f"https://impreunainpoveste.ro/mos/p.html?t={row['parent_token']}"
            }), 201

        except psycopg2.Error:
            # daca nimerim un code duplicat (rar), mai incercam
            continue

    return jsonify({"ok": False, "error": "could_not_generate_unique_code"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
