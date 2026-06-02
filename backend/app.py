import json
from datetime import date, time, datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import check_password_hash, generate_password_hash

from db import init_db, execute_query, get_db_connection

app = Flask(__name__)
# Enable CORS for frontend development
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Helper to serialize datetime/date/time objects to string for JSON responses
def serialize_row(row):
    if not row:
        return row
    serialized = {}
    for key, value in row.items():
        if isinstance(value, (date, datetime)):
            serialized[key] = value.isoformat()
        elif isinstance(value, time):
            # Format time as HH:MM
            serialized[key] = value.strftime("%H:%M")
        elif isinstance(value, timedelta):
            # Format timedelta (often returned for TIME columns in MySQL)
            total_seconds = int(value.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            serialized[key] = f"{hours:02d}:{minutes:02d}"
        else:
            serialized[key] = value
    return serialized

def serialize_rows(rows):
    return [serialize_row(row) for row in rows]

# ==========================================
# AUTH ENDPOINTS
# ==========================================

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "").strip()
    
    if not username or not password or not role:
        return jsonify({"error": "Username, password, and role are required"}), 400
    
    # Query user from DB
    user = execute_query(
        "SELECT * FROM users WHERE username = %s AND role = %s",
        (username, role),
        fetch_one=True
    )
    
    if not user:
        return jsonify({"error": "Invalid username or role"}), 401
    
    # Verify password (support both hashed and plain text for easy XAMPP setup)
    is_valid = False
    if check_password_hash(user["password_hash"], password):
        is_valid = True
    elif user["plain_password"] == password:
        is_valid = True
        
    if not is_valid:
        return jsonify({"error": "Invalid password"}), 401
        
    session = {
        "userId": user["username"].lower().replace(" ", "."),
        "fullName": user["full_name"],
        "role": user["role"],
        "clinicName": user["clinic_name"],
        "workNumber": user["work_number"],
        "personalNumber": user["personal_number"]
    }
    
    return jsonify({"ok": True, "session": session})


# ==========================================
# TELECALLER CRM ENDPOINTS
# ==========================================

@app.route("/api/telecaller/entries", methods=["GET"])
def get_telecaller_entries():
    # Fetch all entries sorted by creation date descending
    entries = execute_query(
        "SELECT * FROM telecaller_entries ORDER BY created_at DESC"
    )
    
    # Map database snake_case to frontend camelCase
    formatted = []
    for entry in serialize_rows(entries):
        formatted.append({
            "id": entry["id"],
            "createdBy": entry["created_by"],
            "city": entry["city"],
            "patientName": entry["patient_name"],
            "mobileNumber": entry["mobile_number"],
            "whatsappNumber": entry["whatsapp_number"],
            "leadType": entry["lead_type"],
            "responseType": entry["response_type"],
            "callConnected": bool(entry["call_connected"]),
            "callNotes": entry["call_notes"],
            "callOutcome": entry["call_outcome"],
            "followUpRequired": bool(entry["follow_up_required"]),
            "followUpReason": entry["follow_up_reason"],
            "followUpDate": entry["follow_up_date"],
            "followUpTime": entry["follow_up_time"],
            "appointmentBooked": bool(entry["appointment_booked"]),
            "clinicName": entry["clinic_name"],
            "appointmentDate": entry["appointment_date"],
            "appointmentSlot": entry["appointment_slot"],
            "qrToken": entry["qr_token"],
            "qrPayload": entry["qr_payload"],
            "createdAt": entry["created_at"]
        })
    return jsonify(formatted)

@app.route("/api/telecaller/entries", methods=["POST"])
def create_telecaller_entry():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    # Generate unique ID if not provided
    entry_id = data.get("id")
    if not entry_id:
        import uuid
        entry_id = str(uuid.uuid4())
        
    # Insert entry into database
    query = """
        INSERT INTO telecaller_entries (
            id, created_by, city, patient_name, mobile_number, whatsapp_number,
            lead_type, response_type, call_connected, call_notes, call_outcome,
            follow_up_required, follow_up_reason, follow_up_date, follow_up_time,
            appointment_booked, clinic_name, appointment_date, appointment_slot,
            qr_token, qr_payload, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
    """
    
    created_at = data.get("createdAt") or datetime.utcnow().isoformat()
    
    params = (
        entry_id,
        data.get("createdBy", "system"),
        data.get("city", ""),
        data.get("patientName", ""),
        data.get("mobileNumber", ""),
        data.get("whatsappNumber"),
        data.get("leadType", "new_enquiry"),
        data.get("responseType", "positive"),
        data.get("callConnected", True),
        data.get("callNotes", ""),
        data.get("callOutcome", "not_interested"),
        data.get("followUpRequired", False),
        data.get("followUpReason"),
        data.get("followUpDate") or None,
        data.get("followUpTime") or None,
        data.get("appointmentBooked", False),
        data.get("clinicName"),
        data.get("appointmentDate") or None,
        data.get("appointmentSlot"),
        data.get("qrToken"),
        data.get("qrPayload"),
        created_at
    )
    
    try:
        execute_query(query, params, fetch_all=False)
        return jsonify({"ok": True, "id": entry_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/telecaller/entries/<id>", methods=["PUT"])
def update_telecaller_entry(id):
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    query = """
        UPDATE telecaller_entries SET
            created_by = %s, city = %s, patient_name = %s, mobile_number = %s, whatsapp_number = %s,
            lead_type = %s, response_type = %s, call_connected = %s, call_notes = %s, call_outcome = %s,
            follow_up_required = %s, follow_up_reason = %s, follow_up_date = %s, follow_up_time = %s,
            appointment_booked = %s, clinic_name = %s, appointment_date = %s, appointment_slot = %s,
            qr_token = %s, qr_payload = %s
        WHERE id = %s
    """
    
    params = (
        data.get("createdBy", "system"),
        data.get("city", ""),
        data.get("patientName", ""),
        data.get("mobileNumber", ""),
        data.get("whatsappNumber"),
        data.get("leadType", "new_enquiry"),
        data.get("responseType", "positive"),
        data.get("callConnected", True),
        data.get("callNotes", ""),
        data.get("callOutcome", "not_interested"),
        data.get("followUpRequired", False),
        data.get("followUpReason"),
        data.get("followUpDate") or None,
        data.get("followUpTime") or None,
        data.get("appointmentBooked", False),
        data.get("clinicName"),
        data.get("appointmentDate") or None,
        data.get("appointmentSlot"),
        data.get("qrToken"),
        data.get("qrPayload"),
        id
    )
    
    try:
        rows_affected = execute_query(query, params, fetch_all=False)
        if rows_affected == 0:
            # Check if it actually exists
            exists = execute_query("SELECT id FROM telecaller_entries WHERE id = %s", (id,), fetch_one=True)
            if not exists:
                return jsonify({"error": "Entry not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/telecaller/by-mobile/<mobile_number>", methods=["GET"])
def get_entry_by_mobile(mobile_number):
    entry = execute_query(
        "SELECT * FROM telecaller_entries WHERE mobile_number = %s ORDER BY created_at DESC LIMIT 1",
        (mobile_number.strip(),),
        fetch_one=True
    )
    if not entry:
        return jsonify({"found": False})
        
    serialized = serialize_row(entry)
    formatted = {
        "id": serialized["id"],
        "createdBy": serialized["created_by"],
        "city": serialized["city"],
        "patientName": serialized["patient_name"],
        "mobileNumber": serialized["mobile_number"],
        "whatsappNumber": serialized["whatsapp_number"],
        "leadType": serialized["lead_type"],
        "responseType": serialized["response_type"],
        "callConnected": bool(serialized["call_connected"]),
        "callNotes": serialized["call_notes"],
        "callOutcome": serialized["call_outcome"],
        "followUpRequired": bool(serialized["follow_up_required"]),
        "followUpReason": serialized["follow_up_reason"],
        "followUpDate": serialized["follow_up_date"],
        "followUpTime": serialized["follow_up_time"],
        "appointmentBooked": bool(serialized["appointment_booked"]),
        "clinicName": serialized["clinic_name"],
        "appointmentDate": serialized["appointment_date"],
        "appointmentSlot": serialized["appointment_slot"],
        "qrToken": serialized["qr_token"],
        "qrPayload": serialized["qr_payload"],
        "createdAt": serialized["created_at"]
    }
    return jsonify({"found": True, "entry": formatted})

def _patient_from_telecaller_row(serialized):
    payload_raw = serialized.get("qr_payload")
    if payload_raw:
        try:
            data = json.loads(payload_raw)
            if isinstance(data, dict) and data.get("qrToken"):
                return data
        except (json.JSONDecodeError, TypeError):
            pass

    clinic = serialized.get("clinic_name") or serialized.get("city") or "Delhi Gate"
    branch_defaults = {
        "phone": "+91 98101 23456",
        "address": "12, Netaji Subhash Marg, Daryaganj, near Delhi Gate Metro Station, New Delhi, 110002",
        "locationLink": "https://maps.google.com/?q=Delhi+Gate+Metro+Station",
    }

    appt_date = serialized.get("appointment_date")
    appt_slot = serialized.get("appointment_slot")
    if appt_date and hasattr(appt_date, "isoformat"):
        appt_date = appt_date.isoformat()[:10]
    if appt_slot and hasattr(appt_slot, "strftime"):
        appt_slot = appt_slot.strftime("%H:%M")

    return {
        "type": "softone_patient",
        "version": 1,
        "qrToken": serialized.get("qr_token") or serialized.get("id"),
        "patientId": serialized.get("id"),
        "patientName": serialized.get("patient_name"),
        "mobileNumber": serialized.get("mobile_number"),
        "city": serialized.get("city"),
        "status": "appointment_booked" if serialized.get("appointment_booked") else "callback_requested",
        "appointmentStatus": "booked" if serialized.get("appointment_booked") else "none",
        "assignedBranch": clinic,
        "appointmentDate": appt_date,
        "appointmentSlot": appt_slot,
        "notes": serialized.get("call_notes"),
        "branchPhone": branch_defaults["phone"],
        "branchAddress": branch_defaults["address"],
        "googleLocation": branch_defaults["locationLink"],
        "generatedAt": datetime.utcnow().isoformat() + "Z",
    }


@app.route("/api/public/patient/<qr_token>", methods=["GET"])
def public_patient_by_token(qr_token):
    token = qr_token.strip()
    if not token:
        return jsonify({"found": False}), 400

    entry = execute_query(
        "SELECT * FROM telecaller_entries WHERE UPPER(qr_token) = UPPER(%s) LIMIT 1",
        (token,),
        fetch_one=True,
    )
    if entry:
        patient = _patient_from_telecaller_row(serialize_row(entry))
        return jsonify({"found": True, "patient": patient})

    appt = execute_query(
        "SELECT * FROM appointments WHERE UPPER(id) = UPPER(%s) LIMIT 1",
        (token,),
        fetch_one=True,
    )
    if appt:
        row = serialize_row(appt)
        appt_date = row.get("date")
        if appt_date and hasattr(appt_date, "isoformat"):
            appt_date = appt_date.isoformat()[:10]
        patient = {
            "type": "softone_patient",
            "version": 1,
            "qrToken": row.get("id"),
            "patientId": row.get("id"),
            "patientName": row.get("patient_name"),
            "mobileNumber": row.get("mobile_number"),
            "city": row.get("clinic_name"),
            "assignedBranch": row.get("clinic_name"),
            "appointmentDate": appt_date,
            "appointmentSlot": row.get("slot"),
            "appointmentStatus": row.get("status"),
            "generatedAt": datetime.utcnow().isoformat() + "Z",
        }
        return jsonify({"found": True, "patient": patient})

    return jsonify({"found": False})


@app.route("/api/telecaller/by-token/<qr_token>", methods=["GET"])
def get_entry_by_token(qr_token):
    entry = execute_query(
        "SELECT * FROM telecaller_entries WHERE UPPER(qr_token) = UPPER(%s) LIMIT 1",
        (qr_token.strip(),),
        fetch_one=True
    )
    if not entry:
        return jsonify({"found": False})
        
    serialized = serialize_row(entry)
    formatted = {
        "id": serialized["id"],
        "createdBy": serialized["created_by"],
        "city": serialized["city"],
        "patientName": serialized["patient_name"],
        "mobileNumber": serialized["mobile_number"],
        "whatsappNumber": serialized["whatsapp_number"],
        "leadType": serialized["lead_type"],
        "responseType": serialized["response_type"],
        "callConnected": bool(serialized["call_connected"]),
        "callNotes": serialized["call_notes"],
        "callOutcome": serialized["call_outcome"],
        "followUpRequired": bool(serialized["follow_up_required"]),
        "followUpReason": serialized["follow_up_reason"],
        "followUpDate": serialized["follow_up_date"],
        "followUpTime": serialized["follow_up_time"],
        "appointmentBooked": bool(serialized["appointment_booked"]),
        "clinicName": serialized["clinic_name"],
        "appointmentDate": serialized["appointment_date"],
        "appointmentSlot": serialized["appointment_slot"],
        "qrToken": serialized["qr_token"],
        "qrPayload": serialized["qr_payload"],
        "createdAt": serialized["created_at"]
    }
    return jsonify({"found": True, "entry": formatted})


# ==========================================
# APPOINTMENT ENDPOINTS
# ==========================================

@app.route("/api/appointments", methods=["GET"])
def get_appointments():
    appointments = execute_query(
        "SELECT * FROM appointments ORDER BY created_at DESC"
    )
    
    formatted = []
    for appt in serialize_rows(appointments):
        formatted.append({
            "id": appt["id"],
            "patientName": appt["patient_name"],
            "mobileNumber": appt["mobile_number"],
            "clinicName": appt["clinic_name"],
            "date": appt["date"],
            "slot": appt["slot"],
            "source": appt["source"],
            "status": appt["status"],
            "bookedBy": appt["booked_by"],
            "createdAt": appt["created_at"]
        })
    return jsonify(formatted)

@app.route("/api/appointments/slots", methods=["GET"])
def check_slots():
    clinic_name = request.args.get("clinicName")
    date_val = request.args.get("date")
    
    if not clinic_name or not date_val:
        return jsonify({"error": "clinicName and date are required"}), 400
        
    # Get booked slots for this clinic on this date
    booked = execute_query(
        "SELECT slot FROM appointments WHERE clinic_name = %s AND date = %s AND status NOT IN ('completed', 'no_show')",
        (clinic_name, date_val)
    )
    
    booked_slots = [b["slot"] for b in booked]
    
    all_slots = ["10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]
    available_slots = [s for s in all_slots if s not in booked_slots]
    
    return jsonify({
        "clinicName": clinic_name,
        "date": date_val,
        "bookedSlots": booked_slots,
        "availableSlots": available_slots
    })

@app.route("/api/appointments", methods=["POST"])
def create_appointment():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    clinic_name = data.get("clinicName")
    date_val = data.get("date")
    slot = data.get("slot")
    
    if not clinic_name or not date_val or not slot:
        return jsonify({"error": "clinicName, date, and slot are required"}), 400
        
    # Check if slot is available
    existing = execute_query(
        "SELECT id FROM appointments WHERE clinic_name = %s AND date = %s AND slot = %s AND status NOT IN ('completed', 'no_show')",
        (clinic_name, date_val, slot),
        fetch_one=True
    )
    
    if existing:
        return jsonify({"ok": False, "reason": "Selected slot is already packed/booked."})
        
    # Generate sequential ID (ST-001, ST-002...)
    count_row = execute_query("SELECT COUNT(*) as cnt FROM appointments", fetch_one=True)
    next_num = (count_row["cnt"] if count_row else 0) + 1
    appt_id = f"ST-{next_num:03d}"
    
    query = """
        INSERT INTO appointments (
            id, patient_name, mobile_number, clinic_name, date, slot, source, status, booked_by, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    created_at = data.get("createdAt") or datetime.utcnow().isoformat()
    
    params = (
        appt_id,
        data.get("patientName", ""),
        data.get("mobileNumber", ""),
        clinic_name,
        date_val,
        slot,
        data.get("source", "appointments_page"),
        data.get("status", "booked"),
        data.get("bookedBy", "system"),
        created_at
    )
    
    try:
        execute_query(query, params, fetch_all=False)
        return jsonify({"ok": True, "id": appt_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/appointments/<id>/status", methods=["PUT"])
def update_appt_status(id):
    data = request.json
    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400
        
    status = data.get("status")
    
    try:
        rows_affected = execute_query(
            "UPDATE appointments SET status = %s WHERE id = %s",
            (status, id),
            fetch_all=False
        )
        if rows_affected == 0:
            return jsonify({"error": "Appointment not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# QUEUE ENDPOINTS
# ==========================================

@app.route("/api/queue", methods=["GET"])
def get_queue():
    entries = execute_query(
        "SELECT * FROM queue_entries ORDER BY waiting_since_iso DESC"
    )
    
    formatted = []
    for entry in serialize_rows(entries):
        formatted.append({
            "id": entry["id"],
            "patientName": entry["patient_name"],
            "clinicName": entry["clinic_name"],
            "status": entry["status"],
            "waitingSinceIso": entry["waiting_since_iso"],
            "mobileNumber": entry["mobile_number"],
            "arrivalType": entry["arrival_type"]
        })
    return jsonify(formatted)

@app.route("/api/queue", methods=["POST"])
def add_queue_entry():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
        
    # Generate sequential ID (Q-0001, Q-0002...)
    count_row = execute_query("SELECT COUNT(*) as cnt FROM queue_entries", fetch_one=True)
    next_num = (count_row["cnt"] if count_row else 0) + 1
    queue_id = f"Q-{next_num:04d}"
    
    query = """
        INSERT INTO queue_entries (
            id, patient_name, clinic_name, status, waiting_since_iso, mobile_number, arrival_type
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    
    waiting_since = data.get("waitingSinceIso") or datetime.utcnow().isoformat()
    
    params = (
        queue_id,
        data.get("patientName", ""),
        data.get("clinicName", ""),
        data.get("status", "waiting"),
        waiting_since,
        data.get("mobileNumber"),
        data.get("arrivalType", "walk_in")
    )
    
    try:
        execute_query(query, params, fetch_all=False)
        return jsonify({"ok": True, "id": queue_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/queue/<id>/status", methods=["PUT"])
def update_queue_entry_status(id):
    data = request.json
    if not data or "status" not in data:
        return jsonify({"error": "Status is required"}), 400
        
    status = data.get("status")
    
    try:
        rows_affected = execute_query(
            "UPDATE queue_entries SET status = %s WHERE id = %s",
            (status, id),
            fetch_all=False
        )
        if rows_affected == 0:
            return jsonify({"error": "Queue entry not found"}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# RECEPTION DAY SUMMARY ENDPOINTS
# ==========================================

@app.route("/api/reception/summary", methods=["GET"])
def get_reception_summary():
    date_val = request.args.get("date")
    if not date_val:
        return jsonify({"error": "Date is required"}), 400
        
    summary = execute_query(
        "SELECT * FROM reception_day_summaries WHERE date = %s",
        (date_val,),
        fetch_one=True
    )
    
    if not summary:
        return jsonify({"found": False})
        
    serialized = serialize_row(summary)
    formatted = {
        "date": serialized["date"],
        "expectedCash": float(serialized["expected_cash"]),
        "physicalCash": float(serialized["physical_cash"]),
        "onlineCollected": float(serialized["online_collected"]),
        "footfall": int(serialized["footfall"]),
        "trials": int(serialized["trials"]),
        "sales": int(serialized["sales"]),
        "pendingFollowUps": int(serialized["pending_follow_ups"])
    }
    return jsonify({"found": True, "summary": formatted})

@app.route("/api/reception/summary", methods=["POST"])
def save_reception_summary():
    data = request.json
    if not data or "date" not in data:
        return jsonify({"error": "Date and summary details are required"}), 400
        
    query = """
        INSERT INTO reception_day_summaries (
            date, expected_cash, physical_cash, online_collected, footfall, trials, sales, pending_follow_ups
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            expected_cash = VALUES(expected_cash),
            physical_cash = VALUES(physical_cash),
            online_collected = VALUES(online_collected),
            footfall = VALUES(footfall),
            trials = VALUES(trials),
            sales = VALUES(sales),
            pending_follow_ups = VALUES(pending_follow_ups)
    """
    
    params = (
        data.get("date"),
        data.get("expectedCash", 0.00),
        data.get("physicalCash", 0.00),
        data.get("onlineCollected", 0.00),
        data.get("footfall", 0),
        data.get("trials", 0),
        data.get("sales", 0),
        data.get("pendingFollowUps", 0)
    )
    
    try:
        execute_query(query, params, fetch_all=False)
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==========================================
# CLINIC BRANCHES ENDPOINTS
# ==========================================

@app.route("/api/branches", methods=["GET"])
def get_branches():
    branches = execute_query("SELECT * FROM branches ORDER BY id ASC")
    return jsonify(serialize_rows(branches))


# ==========================================
# SERVER STARTUP
# ==========================================

if __name__ == "__main__":
    # Initialize the database (creates database, tables, and inserts seed data)
    init_db()
    
    # Start the Flask development server on port 5000
    print("Starting Softone ERP Flask Backend on http://localhost:5000...")
    app.run(host="0.0.0.0", port=5000, debug=True)
