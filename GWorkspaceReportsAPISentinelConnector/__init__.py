from __future__ import print_function
import pickle
from googleapiclient.discovery import build
import datetime
import json
import base64
import hashlib
import hmac
import requests
import azure.functions as func
import logging
import os
import re
from state_manager import StateManager
from data_enrichment import DataEnrichment  # Import the DataEnrichment class
from error_handling import ErrorHandler  # Import the ErrorHandler class
from typing import Generator, Any

# module-level credentials placeholder for mypy/static analysis
creds: Any = None


customer_id = os.environ["WorkspaceID"]
shared_key = os.environ["WorkspaceKey"]
pickle_str = os.environ["GooglePickleString"]
pickle_string = base64.b64decode(pickle_str)
connection_string = os.environ["AzureWebJobsStorage"]
logAnalyticsUri = os.environ.get("logAnalyticsUri")
SCOPES = ["https://www.googleapis.com/auth/admin.reports.audit.readonly"]
activities = [
    "access_transparency",
    "admin",
    "calendar",
    "chat",
    "drive",
    "gcp",
    "gplus",
    "groups",
    "groups_enterprise",
    "jamboard",
    "login",
    "meet",
    "mobile",
    "rules",
    "saml",
    "token",
    "user_accounts",
    "context_aware_access",
    "chrome",
    "data_studio",
]

if logAnalyticsUri in (None, "") or str(logAnalyticsUri).isspace():
    logAnalyticsUri = "https://" + customer_id + ".ods.opinsights.azure.com"
pattern = r"https:\/\/([\w\-]+)\.ods\.opinsights\.azure.([a-zA-Z\.]+)$"
match = re.match(pattern, str(logAnalyticsUri))
if not match:
    raise Exception("Google Workspace Reports: Invalid Log Analytics Uri.")


def get_credentials() -> object:
    creds = None
    if pickle_string:
        try:
            creds = pickle.loads(pickle_string)
        except Exception as pickle_read_exception:
            logging.error(
                "Error while loading pickle string: {}".format(pickle_read_exception)
            )
    else:
        raise Exception("Google Workspace Reports: Pickle_string is empty. Exit.")
    return creds


def generate_date() -> tuple:
    current_time = datetime.datetime.utcnow().replace(
        second=0, microsecond=0
    ) - datetime.timedelta(minutes=10)
    state = StateManager(connection_string=connection_string)
    past_time = state.get()
    if past_time is not None:
        logging.info("The last time point is: {}".format(past_time))
    else:
        logging.info("There is no last time point, trying to get events for last hour.")
        past_time = (current_time - datetime.timedelta(minutes=60)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
    state.post(current_time.strftime("%Y-%m-%dT%H:%M:%SZ"))
    return (past_time, current_time.strftime("%Y-%m-%dT%H:%M:%SZ"))


def get_result(activity: str, start_time: str, end_time: str) -> list:
    result_activities = []
    service = build("admin", "reports_v1", credentials=creds, cache_discovery=False)
    results = (
        service.activities()
        .list(
            userKey="all",
            applicationName=activity,
            maxResults=1000,
            startTime=start_time,
            endTime=end_time,
        )
        .execute()
    )
    next_page_token = results.get("nextPageToken", None)
    result = results.get("items", [])
    result_activities.extend(result)
    while next_page_token is not None:
        results = (
            service.activities()
            .list(
                userKey="all",
                applicationName=activity,
                maxResults=1000,
                startTime=start_time,
                endTime=end_time,
                pageToken=next_page_token,
            )
            .execute()
        )
        next_page_token = results.get("nextPageToken", None)
        result = results.get("items", [])
        result_activities.extend(result)
    if not result_activities:
        logging.info("Logs not found for {} activity".format(activity))
        logging.info(
            "Activity - {}, processing {} events)".format(
                activity, len(result_activities)
            )
        )
        return []
    else:
        logging.info(
            "Activity - {}, processing {} events)".format(
                activity, len(result_activities)
            )
        )
        return result_activities

    # Fallback to satisfy static type checkers: always return a list on all code paths
    return []


def build_signature(
    customer_id: str,
    shared_key: str,
    date: str,
    content_length: int,
    method: str,
    content_type: str,
    resource: str,
) -> str:
    x_headers = "x-ms-date:" + date
    string_to_hash = (
        method
        + "\n"
        + str(content_length)
        + "\n"
        + content_type
        + "\n"
        + x_headers
        + "\n"
        + resource
    )
    bytes_to_hash = bytes(string_to_hash, encoding="utf-8")
    decoded_key = base64.b64decode(shared_key)
    encoded_hash = base64.b64encode(
        hmac.new(decoded_key, bytes_to_hash, digestmod=hashlib.sha256).digest()
    ).decode()
    authorization = "SharedKey {}:{}".format(customer_id, encoded_hash)
    return authorization


def post_data(customer_id: str, shared_key: str, body: str, log_type: str) -> None:
    method = "POST"
    content_type = "application/json"
    resource = "/api/logs"
    rfc1123date = datetime.datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    content_length = len(body)
    signature = build_signature(
        customer_id,
        shared_key,
        rfc1123date,
        content_length,
        method,
        content_type,
        resource,
    )
    if not logAnalyticsUri:
        raise ValueError("logAnalyticsUri is not set")
    uri = logAnalyticsUri + resource + "?api-version=2016-04-01"

    headers = {
        "content-type": content_type,
        "Authorization": signature,
        "Log-Type": log_type,
        "x-ms-date": rfc1123date,
    }
    response = requests.post(uri, data=body, headers=headers)
    if response.status_code >= 200 and response.status_code <= 299:
        logging.info("Logs with {} activity was processed into Azure".format(log_type))
    else:
        logging.warning("Response code: {}".format(response.status_code))


def expand_data(obj: list) -> list:
    for event in obj:
        for nested in event["events"]:
            if "name" in nested:
                event.update({"event_name": nested["name"]})
            if "type" in nested:
                event.update({"event_type": nested["type"]})
            if "parameters" in nested:
                for parameter in nested["parameters"]:
                    if "name" in parameter:
                        for param_name in [
                            "value",
                            "boolValue",
                            "multiValue",
                            "multiMessageValue",
                            "multiIntValue",
                            "messageValue",
                            "intValue",
                        ]:
                            if param_name in parameter:
                                event.update({parameter["name"]: parameter[param_name]})
    return obj


def gen_chunks_to_object(
    data: list, chunksize: int = 100
) -> Generator[list, Any, None]:
    chunk: list = []
    for index, line in enumerate(data):
        if index % chunksize == 0 and index > 0:
            yield chunk
            del chunk[:]
        chunk.append(line)
    yield chunk


def gen_chunks(data: list, log_type: str) -> None:
    for chunk in gen_chunks_to_object(data, chunksize=2000):
        body = json.dumps(chunk)
        post_data(customer_id, shared_key, body, log_type)


def main(mytimer: func.TimerRequest) -> None:
    """
    The main function that orchestrates the retrieval, processing, and sending of
    Google Workspace report data to Azure Sentinel.
    """
    error_handler = ErrorHandler()  # Instantiate ErrorHandler
    data_enrichment = DataEnrichment()  # Instantiate DataEnrichment

    if mytimer.past_due:
        logging.info("The timer is past due!")

    logging.info("Starting program")
    try:
        global creds
        creds = get_credentials()
        start_time, end_time = generate_date()
        logging.info(
            "Data processing. Period(UTC): {} - {}".format(start_time, end_time)
        )

        for line in activities:
            try:
                result_obj = get_result(line, start_time, end_time)
                if result_obj is not None:
                    result_obj = expand_data(result_obj)
                    result_obj = data_enrichment.enrich_data(
                        result_obj
                    )  # Enrich the data
                    gen_chunks(result_obj, "GWorkspace_ReportsAPI_" + line)
            except Exception as e:
                error_handler.handle_exception(
                    e, context=f"Activity: {line}"
                )  # Use ErrorHandler
    except Exception as e:
        error_handler.handle_exception(e, context="Main Function")  # Use ErrorHandler
