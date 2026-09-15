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
