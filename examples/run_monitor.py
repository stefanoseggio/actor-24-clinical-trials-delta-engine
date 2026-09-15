# run_monitor.py
# Calls the ClinicalTrials + Orange Book Delta Actor via the Apify API.
import os
from apify_client import ApifyClient

client = ApifyClient(os.environ["APIFY_TOKEN"])  # set this to your Apify API token

run_input = {
    "sources": ["clinicaltrials"],
    "condition": "diabetes",
    "maxPages": 5,
    "onlyChanged": True,
}

run = client.actor("PkYgfW33Sh6teGXUX").call(run_input=run_input)
print(f"Run {run['id']} finished with status: {run['status']}")

dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items
print(f"Delivered {len(dataset_items)} record(s):")
for item in dataset_items:
    print(f"- [{item['event_type']}] {item['record_id']}")
