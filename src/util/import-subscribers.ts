import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { Database } from '../db'
import { AtpAgent } from '@atproto/api'


// Create a global agent to be reused
const agent = new AtpAgent({
    service: 'https://bsky.social'
});

interface SubscriberImportOptions {
    csvPath?: string
    headers?: boolean
}

export async function importSubscribersFromCSV(
    db: Database,
    options: SubscriberImportOptions = {}
) {
    const {
        csvPath = path.join(process.cwd(), 'subscribers.csv'),
        headers = true
    } = options;

    // Check if file exists
    if (!fs.existsSync(csvPath)) {
        console.log(`[${new Date().toISOString()}] - Subscribers CSV not found at ${csvPath}. Skipping import.`);
        return;
    }

    // Read file
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // Parse CSV
    const parseResult = Papa.parse(csvContent, {
        header: headers,
        skipEmptyLines: true,
        dynamicTyping: true
    });

    // Validate parsing
    if (parseResult.errors.length > 0) {
        console.error('CSV Parsing Errors:', parseResult.errors);
        return;
    }

    // Validate CSV structure
    const data = parseResult.data as Array<{ handle?: string, did?: string }>;
    if (data.length === 0) {
        console.log(`[${new Date().toISOString()}] - No subscribers found in subscribers.csv.`);
        return;
    }

    // Resolve handles to DIDs if only handles are provided
    const subscribersToInsert: Array<{ handle: string, did: string }> = [];
    for (const entry of data) {
        let handle = entry.handle;
        let did = entry.did;

        // Validate entry
        if (!handle && !did) {
            console.warn('Skipping invalid entry:', entry);
            continue;
        }

        // Resolve handle to DID if needed
        if (!did && handle) {
            try {
                const resolveResult = await agent.resolveHandle({ handle });
                did = resolveResult.data.did;
            } catch (err) {
                console.warn(`[${new Date().toISOString()}] - Could not resolve DID for handle: ${handle}`);
                continue;
            }
        }

        // Resolve DID to handle if needed
        if (!handle && did) {
            try {
                const profileResult = await agent.getProfile({ actor: did });
                handle = profileResult.data.handle;
            } catch (err) {
                console.warn(`[${new Date().toISOString()}] - Could not resolve handle for DID: ${did}`);
                continue;
            }
        }

        // Add to insertion list
        subscribersToInsert.push({ handle: handle!, did: did! });
    }

    // Batch insert with conflict resolution
    if (subscribersToInsert.length > 0) {
        try {
            await db.transaction().execute(async (trx) => {
                for (const subscriber of subscribersToInsert) {
                    await trx
                        .insertInto('subscriber')
                        .values(subscriber)
                        .onConflict((oc) => oc.doNothing())
                        .execute();
                }
            });

            console.log(`[${new Date().toISOString()}] - Imported ${subscribersToInsert.length} subscribers`);
        } catch (err) {
            console.error('Error importing subscribers:', err);
        }
    }
}