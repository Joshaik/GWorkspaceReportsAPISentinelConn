import os
import json
import time
import hashlib
from azure.iot.device import IoTHubDeviceClient, Message

# Configuration parameters
DB_FILE = "aikhomu_blockchain.json"
# Replace with your actual Azure IoT Hub Device Connection String
CONNECTION_STRING = "HostName=AikhomuHub.azure-devices.net;DeviceId=aikhomu_edge_validator;SharedAccessKey=YOUR_KEY_HERE"

def verify_local_chain(file_path=DB_FILE, difficulty_prefix="000"):
    """Validates the structure and integrity of the local blockchain ledger."""
    if not os.path.exists(file_path):
        return False, "Ledger database file missing."
        
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            chain = json.load(f)
        except json.JSONDecodeError:
            return False, "Database corruption detected (JSON invalid)."

    for i in range(len(chain)):
        block = chain[i]
        
        # 1. Verify block sequencing matches array positioning
        if block["block_index"] != i:
            return False, f"Sequence error: Block index mismatch at height {i}."
            
        # 2. Check strict cryptographic link to parent block
        if i > 0:
            if block["previous_hash"] != chain[i-1]["block_hash"]:
                return False, f"Integrity break: Parent hash mismatch at block {i}."
        else:
            if block["previous_hash"] != "0" * 64:
                return False, "Genesis block parent link modified."
                
        # 3. Recalculate Proof-of-Work hash to verify mathematical truth
        block_structure = {
            "block_index": block["block_index"],
            "timestamp": block["timestamp"],
            "previous_hash": block["previous_hash"],
            "payload": block["payload"],
            "nonce": block["nonce"]
        }
        serialized = json.dumps(block_structure, sort_keys=True).encode('utf-8')
        recalculated_hash = hashlib.sha256(serialized).hexdigest()
        
        if recalculated_hash != block["block_hash"]:
            return False, f"Tamper alert: Recalculated hash does not match stored value at block {i}."
            
        if not recalculated_hash.startswith(difficulty_prefix):
            return False, f"PoW Violation: Hash at block {i} fails difficulty condition '{difficulty_prefix}'."
            
    return True, f"All {len(chain)} blocks successfully verified. Chain is authentic."

def transmit_verification_to_azure():
    """Connects to Azure IoT Hub and transmits network health metrics."""
    print("Initializing 'aikhomu' IoT Network Verification Gateway...")
    
    # Run the cryptographic audit
    is_valid, report_message = verify_local_chain()
    
    # Build IoT telemetry payload
    telemetry_payload = {
        "service_name": "aikhomu",
        "device_id": "aikhomu_edge_validator",
        "timestamp": time.time(),
        "network_status": "SECURE" if is_valid else "COMPROMISED",
        "verification_details": report_message,
        "blockchain_data_manager_id": 21434194
    }
    
    try:
        # Initialize connection with Azure IoT Hub
        client = IoTHubDeviceClient.create_from_connection_string(CONNECTION_STRING)
        client.connect()
        
        # Format message object with system attributes
        msg = Message(json.dumps(telemetry_payload))
        msg.content_encoding = "utf-8"
        msg.content_type = "application/json"
        
        print(f"Transmitting telemetry to Azure IoT Hub: {telemetry_payload}")
        client.send_message(msg)
        print("Telemetry securely received by Azure IoT cloud gateway.")
        
        # Gracefully terminate session
        client.disconnect()
        
    except Exception as e:
        print(f"Failed to transmit data to Azure: {e}")

if __name__ == "__main__":
    # Dependencies notice: Make sure to run 'pip install azure-iot-device'
    transmit_verification_to_azure()