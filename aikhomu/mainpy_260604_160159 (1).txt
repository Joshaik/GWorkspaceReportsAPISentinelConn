import os
import json
import time
import hashlib
from azure.iot.device import IoTHubDeviceClient, MethodResponse, Message
from azure.iot.device import X509

# Configuration Setup
DB_FILE = "aikhomu_blockchain.json"
HOSTNAME = "AikhomuHub.azure-devices.net"  # Replace with your Azure IoT Hub hostname
DEVICE_ID = "aikhomu_edge_validator"        # Must exactly match the Common Name (CN) in your cert

# Paths to your X.509 files
CERT_FILE = "aikhomu_device.crt"
KEY_FILE = "aikhomu_device.key"

def verify_local_chain(file_path=DB_FILE, difficulty_prefix="000"):
    """Validates the structure and mathematical integrity of the local ledger."""
    if not os.path.exists(file_path):
        return False, "Ledger database file missing."
        
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            chain = json.load(f)
        except json.JSONDecodeError:
            return False, "Database corruption detected (JSON invalid)."

    for i in range(len(chain)):
        block = chain[i]
        if block["block_index"] != i:
            return False, f"Sequence error at height {i}."
        if i > 0 and block["previous_hash"] != chain[i-1]["block_hash"]:
            return False, f"Integrity break at block {i}."
        
        block_structure = {
            "block_index": block["block_index"],
            "timestamp": block["timestamp"],
            "previous_hash": block["previous_hash"],
            "payload": block["payload"],
            "nonce": block["nonce"]
        }
        serialized = json.dumps(block_structure, sort_keys=True).encode('utf-8')
        recalculated_hash = hashlib.sha256(serialized).hexdigest()
        
        if recalculated_hash != block["block_hash"] or not recalculated_hash.startswith(difficulty_prefix):
            return False, f"Tamper or PoW failure at block {i}."
            
    return True, f"All {len(chain)} blocks successfully verified. Chain is authentic."

def execute_and_report_audit(client):
    """Runs the audit and immediately pushes telemetry upstream."""
    is_valid, report_message = verify_local_chain()
    
    telemetry_payload = {
        "service_name": "aikhomu",
        "device_id": DEVICE_ID,
        "timestamp": time.time(),
        "network_status": "SECURE" if is_valid else "COMPROMISED",
        "verification_details": report_message,
        "blockchain_data_manager_id": 21434194
    }
    
    msg = Message(json.dumps(telemetry_payload))
    msg.content_encoding = "utf-8"
    msg.content_type = "application/json"
    
    print(f"Sending telemetry: {telemetry_payload}")
    client.send_message(msg)

def main():
    print("Initializing Secure 'aikhomu' IoT Node via X.509 Authentication...")

    # Load X.509 cryptographic material
    x509_auth = X509(
        cert_file=CERT_FILE,
        key_file=KEY_FILE
    )

    # Establish direct secure connection to Azure
    client = IoTHubDeviceClient.create_from_x509_certificate(
        hostname=HOSTNAME,
        device_id=DEVICE_ID,
        x509=x509_auth
    )

        def connection_state_change_handler(new_state):
        print(f"[Connection State] {new_state}")

        if new_state == "Disconnected":
            print("Connection lost. Attempting to reconnect...")
            try:
                client.connect()
                print("Reconnected to Azure IoT Hub.")
            except Exception as reconnect_error:
                print(f"Reconnect failed: {reconnect_error}")

    def direct_method_handler(method_request):
        print(f"\n[Cloud Command Received]: Method Name -> '{method_request.name}'")

        if method_request.name == "triggerAudit":
            is_valid, report_message = verify_local_chain()

            response_payload = {
                "status": "Success",
                "network_status": "SECURE" if is_valid else "COMPROMISED",
                "message": report_message
            }
            status_code = 200

            execute_and_report_audit(client)
        else:
            response_payload = {"status": "Failed", "message": f"Method '{method_request.name}' not recognized."}
            status_code = 404

        method_response = MethodResponse.create_from_method_request(method_request, status_code, response_payload)
        client.send_method_response(method_response)
        print(f"[Cloud Command Handled]: Sent status {status_code} back to Azure portal.")

    client.on_connection_state_change = connection_state_change_handler
    client.on_method_request_received = direct_method_handler

    max_retries = 5
    backoff_seconds = 5
    retry_count = 0

    while retry_count < max_retries:
        try:
            client.connect()
            print("Securely authenticated with Azure IoT Hub.")
            break
        except Exception as connect_error:
            retry_count += 1
            print(f"Connection attempt {retry_count}/{max_retries} failed: {connect_error}")
            if retry_count >= max_retries:
                print("Maximum connection retries reached. Exiting.")
                raise
            print(f"Retrying in {backoff_seconds} seconds...")
            time.sleep(backoff_seconds)
            backoff_seconds *= 2

    print("\nSystem running. Awaiting manual trigger from Azure Portal... (Press Ctrl+C to exit)")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nKeyboard interrupt received. Shutting down...")
    finally:
        try:
            client.disconnect()
            print("Disconnected from Azure IoT Hub.")
        except Exception as disconnect_error:
            print(f"Disconnect failed: {disconnect_error}")


if __name__ == "__main__":
    main()