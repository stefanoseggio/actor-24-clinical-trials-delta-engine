<h1 align="center">ClinicalTrials.gov + FDA Orange Book - Trial Delta API</h1>

<p align="center"><strong>Know the instant a clinical trial's status changes, or a drug's patent/exclusivity data shifts on the FDA Orange Book - not just what the record currently says.</strong></p>

<p align="center">
  <a href="https://apify.com"><img alt="Built for Apify" src="https://img.shields.io/badge/Built%20for-Apify-FF9012?logo=apify&logoColor=white"></a>
  <a href="#pricing-pay-per-event"><img alt="Pay-Per-Event" src="https://img.shields.io/badge/Pay--Per--Event-from%20%240.002-2ea44f"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</p>

## Run it

<p align="center">
  <a href="https://apify.com/stefano_seggio/actor-24-clinical-trials-delta-engine"><img alt="Run on Apify Store" src="https://img.shields.io/badge/Run%20on-Apify%20Store-FF9012?logo=apify&logoColor=white&style=for-the-badge"></a>
</p>

Live and public at [apify.com/stefano_seggio/actor-24-clinical-trials-delta-engine](https://apify.com/stefano_seggio/actor-24-clinical-trials-delta-engine). Owner console: [console.apify.com/actors/PkYgfW33Sh6teGXUX](https://console.apify.com/actors/PkYgfW33Sh6teGXUX).

> This repository is a documentation and integration wrapper around that Actor - the MIT license below covers this repo's own README, snippets, and docs, not the Actor's proprietary TypeScript source, which stays closed and hosted on Apify.

## What this actually monitors

ClinicalTrials.gov and the FDA Orange Book each publish real, official data - but neither publishes a change feed. A trial's `overall_status` moving from `RECRUITING` to `TERMINATED`, or a new patent/exclusivity entry landing on a drug product, is only visible to someone willing to re-fetch the same record over and over and diff it by hand.

This Actor walks both sources on a schedule and reports only what changed: a trial seen for the first time (`NEW_TRIAL`), a trial whose status changed since the last run (`STATUS_CHANGE`), a product newly listed in the Orange Book (`NEW_LISTING`), or a change to a product's patent/exclusivity data (`PATENT_EXCLUSIVITY_CHANGE`). Turn on delta mode (`onlyChanged`) and a scheduled run reports nothing at all when nothing moved, instead of re-delivering a full snapshot every time.

It's built for pharma competitive-intelligence teams tracking a competitor's trial pipeline, regulatory-affairs teams watching for exclusivity expiry on a specific drug product, and biotech/investment researchers who need a structured, versioned signal instead of manually refreshing two government websites.

## Architecture

```mermaid
flowchart TD
    A["sources: clinicaltrials | orangebook"] --> B{"Which source(s)?"}
    B -->|clinicaltrials| C["ClinicalTrials.gov API v2<br/>query.cond filter, paginated"]
    B -->|orangebook| D["openFDA Orange Book endpoint<br/>ingredient/application filter"]
    C --> E["Per-trial fingerprint:<br/>overall_status + key fields"]
    D --> F["Per-product fingerprint:<br/>patent_data + exclusivity"]
    E --> G{"Compare vs key-value store state"}
    F --> G
    G -->|never seen| H["NEW_TRIAL / NEW_LISTING"]
    G -->|status changed| I["STATUS_CHANGE"]
    G -->|patent data changed| J["PATENT_EXCLUSIVITY_CHANGE"]
    G -->|unchanged| K["SNAPSHOT_NO_DIFF (only if onlyChanged=false)"]
    H --> L["Actor.pushData → Apify dataset<br/>'result' event - $0.002"]
    I --> L
    J --> L
    K --> L
```

Every page/extract fetch goes through a shared retry helper with full-jitter exponential backoff (default 5 attempts). The `clinicaltrials` source needs no API key; `orangebook` (via openFDA) works without one too, capped at 1,000 requests/day (240/min) - a free openFDA key raises that to 120,000/day at the same 240/min rate.

## Features

| Feature | Input field | What it does |
| --- | --- | --- |
| Multi-source monitoring | `sources` | Track ClinicalTrials.gov, the FDA Orange Book, or both in one run. |
| Condition filter | `condition` | Passed to ClinicalTrials.gov's `query.cond` - e.g. `"diabetes"` to narrow the walk. |
| Orange Book filter | `orangeBookQuery` | Filters the Orange Book query to an ingredient name or application number. |
| Delta mode | `onlyChanged` | Persists a fingerprint per trial/product in a named key-value store, then delivers only new or changed records on later runs. |
| Configurable walk size | `maxPages` | Hard cap on the number of 100-record ClinicalTrials.gov API pages walked per run. |
| Resilient retries | `maxRetries` | Full-jitter exponential backoff per page/extract fetch before it's dead-lettered (default 5, max 10). |
| Optional openFDA key | `fdaApiKey` | Raises the Orange Book source's daily request ceiling from 1,000 to 120,000; not needed for `clinicaltrials`. |

## Quick start

```bash
apify call PkYgfW33Sh6teGXUX --input '{
  "sources": ["clinicaltrials"],
  "condition": "diabetes",
  "maxPages": 5,
  "onlyChanged": true
}'
```

This walks up to 5 pages (up to 500 trials) matching "diabetes" on ClinicalTrials.gov, and delivers only trials that are new or whose status changed since the last run.

## Sample output

One row per delta event, following the `overview` view in `.actor/dataset_schema.json`:

```json
{
  "record_id": "NCT05123456",
  "event_type": "STATUS_CHANGE",
  "scraped_at": "2026-09-14T18:03:11.000Z",
  "is_new": false,
  "source_url": "https://clinicaltrials.gov/study/NCT05123456",
  "data_source": "clinicaltrials-gov",
  "nct_id": "NCT05123456",
  "brief_title": "A Study of Metformin Extended-Release in Adults With Type 2 Diabetes",
  "overall_status": "TERMINATED",
  "previous_status": "RECRUITING",
  "last_update_post_date": "2026-09-10",
  "status_verified_date": "2026-09-10",
  "lead_sponsor": "Example University Medical Center",
  "conditions": ["Type 2 Diabetes Mellitus"],
  "phases": ["PHASE3"]
}
```

An Orange Book `PATENT_EXCLUSIVITY_CHANGE` record instead carries `application_number`, `product_number`, `trade_name`, `ingredient`, `te_code`, and a raw `patent_data` object in place of the ClinicalTrials.gov-specific fields.

## Pricing (Pay-Per-Event)

| Event | Price | Charged when |
| --- | --- | --- |
| `result` | $0.002 per record | A new or changed trial/patent record is delivered (`NEW_TRIAL`, `STATUS_CHANGE`, `NEW_LISTING`, or `PATENT_EXCLUSIVITY_CHANGE`). |

`SNAPSHOT_NO_DIFF` rows (only ever delivered when `onlyChanged: false`) are never charged. A daily delta run against a narrow `condition` filter that finds nothing new costs only its per-run start fee.

## Why not just poll it yourself

- **Zero infrastructure** - no scheduler, no state store, no server to keep alive; runs on Apify's platform on the schedule you set.
- **Two sources, one schema** - ClinicalTrials.gov trial deltas and FDA Orange Book patent/exclusivity deltas normalize into the same output shape instead of two separate integrations.
- **Built-in change detection** - `STATUS_CHANGE` and `PATENT_EXCLUSIVITY_CHANGE` are computed from fingerprints this Actor already maintains, at no extra request or cost.
- **Retry-hardened by default** - full-jitter exponential backoff on every page/extract fetch, so a transient network blip doesn't fail the whole run.

## Known limitations

- **openFDA rate limits apply to the Orange Book source.** Without `fdaApiKey`, high-volume Orange Book runs may hit the 1,000 requests/day ceiling; the `clinicaltrials` source is unaffected since it doesn't use this key.
- **No contractual support SLA.** Independently developed and maintained by Stefano Seggio (Delta Registry); issues and feature requests go through the Apify Store's Issues tab, typically triaged within 48 hours.

## Node.js

```js
// run-monitor.js
// Calls the ClinicalTrials + Orange Book Delta Actor via the Apify API.
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN, // set this to your Apify API token
});

async function main() {
    const input = {
        sources: ['clinicaltrials'],
        condition: 'diabetes',
        maxPages: 5,
        onlyChanged: true,
    };

    const run = await client.actor('PkYgfW33Sh6teGXUX').call(input);
    console.log(`Run ${run.id} finished with status: ${run.status}`);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`Delivered ${items.length} record(s):`);
    for (const item of items) {
        console.log(`- [${item.event_type}] ${item.record_id}`);
    }
}

main().catch((err) => {
    console.error('Run failed:', err);
    process.exit(1);
});
```

## Python

```python
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
```

---

<p align="center">
Part of <strong>Delta Registry</strong> - pay-per-event regulatory &amp; compliance data infrastructure.<br>
For professional inquiries or enterprise licensing: <a href="https://www.linkedin.com/in/stefanoseggio-deltaregistry">linkedin.com/in/stefanoseggio-deltaregistry</a><br>
The rest of the fleet: <a href="https://github.com/stefanoseggio">github.com/stefanoseggio</a>
</p>
