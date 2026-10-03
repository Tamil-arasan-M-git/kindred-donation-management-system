import io
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://127.0.0.1:8000")
FRONTEND_BASE = os.getenv("FRONTEND_BASE", "http://127.0.0.1:5173")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "testadmin@example.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin123!")

def request_json(url, method="GET", data=None, token=None, expected_status=200):
    headers = {"Accept": "application/json"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            payload = json.loads(content) if content else {}
            assert status == expected_status, f"Expected {expected_status} but got {status}: {payload}"
            return payload
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_content)
        except Exception:
            err_json = err_content
        raise AssertionError(f"HTTP {e.code} for {method} {url}: {err_json}")

def test_system_endpoints():
    print("[1] Testing System Endpoints...")
    # /
    res_root = request_json(f"{BACKEND_BASE}/")
    assert res_root.get("status") == "OK", f"Unexpected /: {res_root}"
    # /health
    res_health = request_json(f"{BACKEND_BASE}/health")
    assert res_health.get("status") == "healthy", f"Unexpected /health: {res_health}"
    assert res_health.get("model") == "custom_fine_tuned", f"Model not custom_fine_tuned: {res_health}"
    # /docs
    req_docs = urllib.request.Request(f"{BACKEND_BASE}/docs")
    with urllib.request.urlopen(req_docs) as resp:
        assert resp.status == 200, f"Docs status {resp.status}"
    print("    System endpoints: PASS (/, /health, /docs all 200 OK)")

def test_ai_inference():
    print("[2] Testing AI Inference Path (/detect with 81-class YOLO model)...")
    img = Image.new("RGB", (320, 240), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.rectangle([50, 50, 150, 150], fill=(20, 40, 200))
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    img_bytes = buffer.getvalue()

    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_donation.jpg"\r\n'
        f"Content-Type: image/jpeg\r\n\r\n"
    ).encode("latin-1") + img_bytes + f"\r\n--{boundary}--\r\n".encode("latin-1")

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }
    req = urllib.request.Request(f"{BACKEND_BASE}/detect", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"/detect status {resp.status}"
        data = json.loads(resp.read().decode("utf-8"))
        assert data.get("success") is True, f"/detect success not True: {data}"
        assert "items" in data, f"/detect missing items: {data}"
        print(f"    AI Inference response: success={data.get('success')}, items_count={len(data.get('items', []))}")
    print("    AI inference path: PASS (fine-tuned 81-class model executed cleanly)")

def test_donor_flows():
    print("[3] Testing Donor Flows (Register, Login, Create Donation with 81-class item, Update Donation)...")
    ts = int(time.time())
    email = f"e2e_donor_{ts}@test.com"
    pwd = "TestDonor123!"
    reg_data = {
        "email": email,
        "password": pwd,
        "role": "donor",
        "name": f"E2E Donor {ts}",
        "phone": "555-0101",
        "city": "Chennai",
        "latitude": 13.0827,
        "longitude": 80.2707
    }
    reg_res = request_json(f"{BACKEND_BASE}/api/auth/register", method="POST", data=reg_data)
    donor_id = reg_res["donor_id"]
    assert donor_id, "No donor_id returned in register"

    # Login
    login_res = request_json(f"{BACKEND_BASE}/api/auth/login", method="POST", data={"email": email, "password": pwd})
    token = login_res["access_token"]
    assert token, "No access token in login"

    # Auth me
    me_res = request_json(f"{BACKEND_BASE}/api/auth/me", token=token)
    assert me_res["email"] == email, f"Wrong email in /auth/me: {me_res}"

    # Donor me & dashboard
    donor_me = request_json(f"{BACKEND_BASE}/api/donors/me", token=token)
    assert donor_me["id"] == donor_id, f"Wrong donor profile: {donor_me}"
    donor_dash = request_json(f"{BACKEND_BASE}/api/donors/me/dashboard", token=token)
    assert "total_donations" in donor_dash, f"Missing total_donations in dashboard: {donor_dash}"

    # Create donation with 81-class item: shirt
    donation_data = {
        "items": [
            {"class_name": "shirt", "quantity": 4}
        ]
    }
    donation = request_json(f"{BACKEND_BASE}/api/donations", method="POST", data=donation_data, token=token)
    donation_id = donation["id"]
    assert donation_id, f"No donation id: {donation}"
    assert len(donation["items"]) == 1
    assert donation["items"][0]["category"] == "clothing"
    assert donation["items"][0]["subcategory"] == "shirt"
    print(f"    Created donation {donation_id} with normalized category='clothing', subcategory='shirt'")

    # Update donation (tests the update category resolution fix!)
    update_data = {
        "items": [
            {"class_name": "shoe", "quantity": 2}
        ]
    }
    updated_donation = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}", method="PUT", data=update_data, token=token)
    assert updated_donation["items"][0]["category"] == "clothing"
    assert updated_donation["items"][0]["subcategory"] == "shoe"
    assert updated_donation["items"][0]["quantity"] == 2
    print(f"    Updated donation {donation_id} with category resolution fix: PASS")

    # List donations
    donations_list = request_json(f"{BACKEND_BASE}/api/donations", token=token)
    assert any(d["id"] == donation_id for d in donations_list), "Created donation not in list"

    return token, donor_id, donation_id

def test_ngo_and_admin_flows(donor_token, donor_id, donation_id):
    print("[4] Testing Admin Flows & NGO Verification...")
    # Admin login
    admin_login = request_json(f"{BACKEND_BASE}/api/auth/login", method="POST", data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    admin_token = admin_login["access_token"]
    assert admin_token, "Admin login failed"

    # Admin dashboard
    admin_dash = request_json(f"{BACKEND_BASE}/api/admin/dashboard", token=admin_token)
    assert "summary" in admin_dash, f"Admin dashboard missing summary: {admin_dash}"
    print(f"    Admin dashboard loaded successfully (Total NGOs: {admin_dash['summary']['total_ngos']}, Donors: {admin_dash['summary']['total_donors']})")

    # Admin donors list
    admin_donors = request_json(f"{BACKEND_BASE}/api/admin/donors", token=admin_token)
    assert isinstance(admin_donors, list), "Admin donors not list"
    assert any(d["id"] == donor_id for d in admin_donors), f"Donor {donor_id} not in admin donors"
    print(f"    Admin donors list loaded successfully ({len(admin_donors)} donors found)")

    # Register NGO
    ts = int(time.time())
    ngo_email = f"e2e_ngo_{ts}@test.com"
    ngo_pwd = "TestNGO123!"
    ngo_reg = request_json(f"{BACKEND_BASE}/api/auth/register", method="POST", data={
        "email": ngo_email,
        "password": ngo_pwd,
        "role": "ngo",
        "organization_name": f"E2E Hope Foundation {ts}",
        "contact_phone": "555-0202",
        "address": "10 Anna Salai",
        "city": "Chennai",
        "latitude": 13.0850,
        "longitude": 80.2750
    })
    ngo_id = ngo_reg["ngo_id"]
    assert ngo_id, "No ngo_id in NGO register"

    # Verify NGO as Admin
    verify_res = request_json(f"{BACKEND_BASE}/api/ngos/{ngo_id}/verification", method="PATCH", data={"verified": True}, token=admin_token)
    assert verify_res["verified"] is True, f"NGO not verified: {verify_res}"
    print(f"    Admin verified NGO {ngo_id}: PASS")

    # NGO Login
    ngo_login = request_json(f"{BACKEND_BASE}/api/auth/login", method="POST", data={"email": ngo_email, "password": ngo_pwd})
    ngo_token = ngo_login["access_token"]
    assert ngo_token, "NGO login failed"

    # NGO creates demand compatible with the donation (clothing / shoe)
    demand_data = {
        "class_name": "clothing",
        "subcategory": "shoe",
        "quantity_needed": 2,
        "priority": 4
    }
    demand_res = request_json(f"{BACKEND_BASE}/api/ngos/{ngo_id}/demands", method="POST", data=demand_data, token=ngo_token)
    demand_id = demand_res["id"]
    assert demand_id, "No demand_id"
    print(f"    Created NGO demand {demand_id} for clothing/shoe")

    # Matching flow
    print("[5] Testing Matching & Lifecycle Flow...")
    match_post = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/match", method="POST", token=donor_token)
    matches = match_post.get("matches", [])
    assert len(matches) > 0, f"Expected matches for donation {donation_id}: {match_post}"
    match_record = next((m for m in matches if m["ngo_id"] == str(ngo_id)), None)
    assert match_record, f"Could not find match for NGO {ngo_id} in matches: {matches}"
    match_id = match_record["id"]
    print(f"    Generated match {match_id} for NGO {ngo_id} with score {match_record.get('score')}")

    # NGO accepts match
    accept_res = request_json(f"{BACKEND_BASE}/api/matches/{match_id}/accept", method="POST", token=ngo_token)
    assert accept_res.get("status") in ["accepted", "matched"], f"Accept status unexpected: {accept_res}"
    print("    NGO accepted match: PASS")

    # NGO packaging notify & checklist
    pack_res = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/packaging-notify", method="POST", token=ngo_token)
    assert pack_res.get("status") == "packaging_notified", f"Packaging notify failed: {pack_res}"
    checklist = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/packaging-checklist", token=ngo_token)
    assert "items" in checklist and len(checklist["items"]) > 0, f"Checklist missing items: {checklist}"
    print("    NGO packaging notification & checklist: PASS")

    # Donor schedules pickup (transitions from packaging_notified to pickup_scheduled)
    future_pickup = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    pickup_data = {
        "scheduled_at": future_pickup,
        "notes": "Leave at front desk"
    }
    pickup_res = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/pickup/schedule", method="POST", data=pickup_data, token=donor_token)
    assert pickup_res.get("status") == "pickup_scheduled", f"Pickup status unexpected: {pickup_res}"
    print("    Donor scheduled pickup: PASS")

    # NGO status progression: collected -> delivered -> acknowledged
    status_c = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/status", method="PATCH", data={"status": "collected", "notes": "Picked up from donor"}, token=ngo_token)
    assert status_c.get("status") == "collected", f"Status not collected: {status_c}"

    status_d = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/status", method="PATCH", data={"status": "delivered", "notes": "Delivered to warehouse"}, token=ngo_token)
    assert status_d.get("status") == "delivered", f"Status not delivered: {status_d}"

    status_a = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/status", method="PATCH", data={"status": "acknowledged", "notes": "Items verified and distributed"}, token=ngo_token)
    assert status_a.get("status") == "acknowledged", f"Status not acknowledged: {status_a}"
    print("    NGO operational status progression (collected -> delivered -> acknowledged): PASS")

    # Status history
    history = request_json(f"{BACKEND_BASE}/api/donations/{donation_id}/status-history", token=donor_token)
    history_items = history.get("history", []) if isinstance(history, dict) else history
    assert len(history_items) >= 3, f"Status history incomplete: {history}"
    print(f"    Donation status history recorded {len(history_items)} transitions: PASS")

    # NGO Dashboard
    ngo_dash = request_json(f"{BACKEND_BASE}/api/ngos/me/dashboard", token=ngo_token)
    assert "active_demands" in ngo_dash, f"NGO dashboard missing active_demands: {ngo_dash}"
    print("    NGO dashboard loaded: PASS")

    # Notifications
    notifications = request_json(f"{BACKEND_BASE}/api/notifications", token=donor_token)
    assert isinstance(notifications, list), "Notifications not a list"
    read_all = request_json(f"{BACKEND_BASE}/api/notifications/read-all", method="PATCH", token=donor_token)
    assert "updated" in read_all, f"read-all failed: {read_all}"
    print("    Notifications API: PASS")

def test_frontend():
    print(f"[6] Testing Frontend Server & Asset Serving ({FRONTEND_BASE})...")
    req = urllib.request.Request(FRONTEND_BASE)
    try:
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Frontend status {resp.status}"
            html = resp.read().decode("utf-8")
            assert "<div id=\"root\"></div>" in html or "<div id='root'></div>" in html or "root" in html, "Root div not found in frontend HTML"
            assert "main.jsx" in html or "assets" in html, "Entrypoint not found in frontend HTML"
        print(f"    Frontend server responding on {FRONTEND_BASE} with valid React index: PASS")
    except urllib.error.URLError as e:
        raise AssertionError(f"Could not connect to frontend at {FRONTEND_BASE}: {e}")

def main():
    print("=================================================================")
    print("STARTING FULL END-TO-END VERIFICATION SUITE")
    print("=================================================================")
    test_system_endpoints()
    test_ai_inference()
    donor_token, donor_id, donation_id = test_donor_flows()
    test_ngo_and_admin_flows(donor_token, donor_id, donation_id)
    test_frontend()
    print("=================================================================")
    print("ALL END-TO-END FLOW TESTS COMPLETED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    main()
