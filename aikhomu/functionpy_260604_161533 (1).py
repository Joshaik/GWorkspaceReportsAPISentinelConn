import azure.functions as func
import logging
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Initialize the Azure Functions App instance (V2 Programming Model)
app = func.FunctionApp()

# Configuration Constants
RECIPIENT_EMAIL = "Joshaik@live.com"
SENDER_EMAIL = "alerts-noreply@aikhomu-blockchain.io"

def send_security_alert_email(device_id, manager_id, alert_details):
    """Establishes an SMTP connection to dispatch an emergency alert email."""
    # Retrieve environment variables configured in the Azure portal
    smtp_server = "smtp.sendgrid.net" # Or alternative SMTP relays like Mailgun/Office365
    smtp_port = 587
    smtp_username = "apikey" 
    smtp_password = "YOUR_SMTP_OR_SENDGRID_PASSWORD" 
    
    # Structure the multi-part email payload
    msg = MIMEMultipart()
    msg['From'] = SENDER_EMAIL
    msg['To'] = RECIPIENT_EMAIL
    msg['Subject'] = f"🚨 SECURITY CRITICAL: Aikhomu Blockchain Tamper Alert [ID: {manager_id}]"
    
    email_body = f"""
    <html>
    <body>
        <h2>Aikhomu Azure Blockchain Service - Compromise Alert</h2>
        <p><strong>Status:</strong> COMPROMISED</p>
        <p><strong>Device Node:</strong> {device_id}</p>
        <p><strong>Data Manager ID:</strong> {manager_id}</p>
        <p><strong>Sender Entity Identity:</strong> God</p>
        <p><strong>System Audit Report:</strong> {alert_details}</p>
        <hr/>
        <p style="color:red;"><em>Action Required: Inspect local database sequences immediately. Cryptographic chain continuity is broken.</em></p>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(email_body, 'html'))
    
    try:
        # Establish TLS handshake and authenticate
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(SENDER_EMAIL, RECIPIENT_EMAIL, msg.as_string())
        server.quit()
        logging.info(f"Security alert email successfully dispatched to {RECIPIENT_EMAIL}")
    except Exception as e:
        logging.error(f"Failed to transmit security alert email: {str(e)}")

# Define the built-in Event Hub trigger pointing to your IoT Hub endpoint
@app.event_hub_message_trigger(
    arg_name="azevent",
    event_hub_name="aikhomuhub",          # Replace with your IoT Hub Event Hub-compatible name
    connection="AikhomuIoTHubConnection", # Defined inside local.settings.json or Azure Configuration
    consumer_group="$Default"             # Ensure unique consumer groups if sharing endpoints
)
def aikhomu_iot_listener(azevent: func.EventHubEvent):
    """Listens to IoT Hub telemetry stream and processes network status variations."""
    try:
        # Parse incoming telemetry payload string
        raw_body = azevent.get_body().decode('utf-8')
        telemetry_data = json.loads(raw_body)
        
        logging.info(f"Processing telemetry packet from node: {telemetry_data.get('device_id')}")
        
        # Isolate the verification filter
        network_status = telemetry_data.get("network_status")
        service_name = telemetry_data.get("service_name")
        
        if service_name == "aikhomu" and network_status == "COMPROMISED":
            logging.warning("🚨 Cryptographic compromise discovered! Initiating alert routine...")
            
            device_id = telemetry_data.get("device_id", "Unknown Node")
            manager_id = telemetry_data.get("blockchain_data_manager_id", "N/A")
            details = telemetry_data.get("verification_details", "No detailed trace provided.")
            
            # Fire email pipeline
            send_security_alert_email(device_id, manager_id, details)
            
        else:
            logging.info("Network verification integrity check: SECURE. No actions needed.")
            
    except Exception as e:
        logging.error(f"Error executing telemetry tracking pipeline: {str(e)}")