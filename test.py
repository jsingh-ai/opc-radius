# fake_api_response.py
# Simple Flask server that returns a hardcoded JSON response
# Run: pip install flask
# Then: python fake_api_response.py

from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api/v1/shopfloor/current-status", methods=["GET"])
def current_status():
    response = {
        "success": True,
        "kco": 2,
        "plantCode": 2,
        "machPrefix": 2,
        "includeEventDetails": False,
        "machines": [
            {
                "machineId": "2-001",
                "status": "RUNNING",
                "jobNumber": "JOB-1001",
                "speed": 245,
                "operator": "John Smith",
                "lastUpdate": "2026-05-14T10:30:00Z"
            },
            {
                "machineId": "2-002",
                "status": "STOPPED",
                "jobNumber": "JOB-1002",
                "speed": 0,
                "operator": "Jane Doe",
                "lastUpdate": "2026-05-14T10:31:00Z"
            }
        ]
    }

    return jsonify(response)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)