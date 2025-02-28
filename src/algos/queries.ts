interface FollowsResponse {
    follows: Array<{
        did: string;
        handle: string;
        displayName?: string;
        // other fields exist but we don't need them
    }>;
    subject: {
        did: string;
        // other fields exist but we don't need them
    };
    cursor?: string;
}

interface SimplifiedFollow {
    subject: string;
    follows: string;
}

// Query local database to find follows; use API call if nothing is found
export async function getFollows(actor: string, db): Promise<string[]> {
    console.log("Requesting follows for:", actor)
    const followsDid = await db
        .selectFrom('follows')
        .select(['follows'])
        .where('subject', '=', actor)
        .execute();

    if (followsDid.length > 0) {
        return followsDid.map(f => f.follows);
    }

    return getFollowsApi(actor, db);
}

export async function getFollowsApi(actor: string, db): Promise<string[]> {
    console.log(`Fetching follows from API for ${actor}`);
    const baseUrl = 'https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows';
    let allFollows: SimplifiedFollow[] = [];
    let currentCursor: string | undefined = undefined;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    // Function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    do {
        try {
            const url = new URL(baseUrl);
            url.searchParams.append('actor', actor);
            url.searchParams.append('limit', '100');
            if (currentCursor) {
                url.searchParams.append('cursor', currentCursor);
            }
            console.log(`Fetching page of follows for ${actor} [got ${allFollows.length}]`);
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
            }
            
            const data = await response.json() as FollowsResponse;

            if (!data.follows || !Array.isArray(data.follows)) {
                console.warn(`Unexpected response format for ${actor}:`, data);
                break;
            }
            
            // Map the follows to a simpler structure for database storage
            const simplifiedFollows = data.follows.map(follow => ({
                subject: actor,
                follows: follow.did,
            }));

            allFollows = [...allFollows, ...simplifiedFollows];
            currentCursor = data.cursor;
            retryCount = 0; // Reset retry count on success
            
            // If we got a lot of follows, log progress
            if (allFollows.length > 0 && allFollows.length % 500 === 0) {
                console.log(`Fetched ${allFollows.length} follows for ${actor} so far...`);
            }
            
        } catch (error) {
            console.error(`Error fetching follows for ${actor}:`, error);
            
            // Implement retry logic
            retryCount++;
            if (retryCount <= maxRetries) {
                console.log(`Retrying (${retryCount}/${maxRetries}) after ${retryDelay}ms...`);
                await delay(retryDelay * retryCount); // Exponential backoff
                continue; // Retry the current cursor
            }
            
            // If we've exceeded retries, break the loop and work with what we have
            console.warn(`Maximum retries exceeded for ${actor}, proceeding with ${allFollows.length} follows`);
            break;
        }
    } while (currentCursor);

    console.log(`Fetched a total of ${allFollows.length} follows for ${actor}`);

    if (allFollows.length > 0) {
        try {
            // Batch insert follows to avoid potential transaction size limits
            const batchSize = 500;
            for (let i = 0; i < allFollows.length; i += batchSize) {
                const batch = allFollows.slice(i, i + batchSize);
                await db
                    .insertInto('follows')
                    .values(batch)
                    .onConflict((oc) => oc.columns(['subject', 'follows']).doNothing())
                    .execute();
                
                console.log(`Inserted batch ${i / batchSize + 1} of follows for ${actor}`);
            }
            console.log(`Successfully stored all ${allFollows.length} follows for ${actor} in database`);
        } catch (dbError) {
            console.error(`Database error while storing follows for ${actor}:`, dbError);
        }
    }

    return allFollows.map((entry) => entry.follows);
}