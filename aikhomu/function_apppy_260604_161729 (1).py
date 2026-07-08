import os
import json
import logging
import smtplib
import azure.functions as func
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from azure.iot.hub import IoTHubRegistryManager
from azure.iot.hub.models import CloudToDeviceMethod

app = func.FunctionApp()

# Configuration settings from environment variables
RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL", "Joshaik@live.com")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "alerts-noreply@aikhomu-blockchain.io")
IOTHUB_CONNECTION_STRING = os.getenv(
    "IOTHUB_CONNECTION_STRING",
    "HostName=AikhomuHub.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=YOUR_SERVICE_KEY"
)
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

def trigger_iot_self_healing(device_id):
    """Sends a cloud command to the IoT device to trigger local self-healing."""
    try:
        logging.info(f"Sending direct method 'repairLedger' to device {device_id}...")
        registry_manager = IoTHubRegistryManager(IOTHUB_CONNECTION_STRING)
        
        # Prepare the direct method payload
        device_method = CloudToDeviceMethod(
            method_name="repairLedger", 
            payload={"action": "rebuild_and_remine"}, 
            timeout_in_seconds=30
        )
        
        # Invoke the method directly on the edge hardware
        response = registry_manager.invoke_device_method(device_id, device_method)
        logging.info(f"Device self-healing status response code: {response.status}")
        return response.payload
    except Exception as e:
        logging.error(f"Failed to issue self-healing command to device: {str(e)}")
        return None

def send_security_alert_email(device_id, manager_id, alert_details, heal_result):
    """Dispatches a security update email tracking the breach and self-healing action."""
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECIPIENT_EMAIL
    msg['Subject'] = f"🚨 TAMPER ACTION: Self-Healing Triggered on Network [ID: {manager_id}]"
    
    email_body = f"""
    <html>
    <body>
        <h2>Aikhomu Azure Blockchain Service - Automation Report</h2>
        <p><strong>Status:</strong> COMPROMISED (Self-Healing Triggered)</p>
        <p><strong>Device Node:</strong> {device_id}</p>
        <p><strong>System Audit Report:</strong> {alert_details}</p>
        <p><strong>Cloud Mitigation Action:</strong> Issued direct method 'repairLedger' to device.</p>
        <p><strong>Device Repair Response:</strong> {json.dumps(heal_result)}</p>
    </body>
    </html>
    """
    msg.attach(MIMEText(email_body, 'html'))
    # (Add your SMTP configuration here to send via SendGrid/Office365 as configured previously)

@app.event_hub_trigger(
    arg_name="azevent",
    event_hub_name="aikhomuhub",
    connection="AikhomuIoTHubConnection",
    consumer_group="$Default"
)
def aikhomu_iot_listener(azevent: func.EventHubEvent):
    """Intercepts telemetry and fires self-healing logic instantly if a breach occurs."""
    try:
        raw_body = azevent.get_body().decode('utf-8')
        telemetry_data = json.loads(raw_body)
        
        if telemetry_data.get("service_name") == "aikhomu" and telemetry_data.get("network_status") == "COMPROMISED":
            device_id = telemetry_data.get("device_id")
            manager_id = telemetry_data.get("blockchain_data_manager_id")
            details = telemetry_data.get("verification_details")
            
            # Step 1: Instantly command the edge device to fix its data loop
            heal_result = trigger_iot_self_healing(device_id)
            
            # Step 2: Email the report containing the audit details and the repair result
            send_security_alert_email(device_id, manager_id, details, heal_result)
            
    except Exception as e:
        logging.error(f"Error in execution pipeline: {str(e)}")