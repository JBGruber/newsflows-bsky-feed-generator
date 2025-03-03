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

export async function getFollowsApi(actor: string, db, updateAll: boolean = false): Promise<string[]> {
    console.log(`Fetching follows from API for ${actor}`);
    const baseUrl = 'https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows';
    let allFollows: SimplifiedFollow[] = [];
    let currentCursor: string | undefined = undefined;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    // Get existing follows from DB to avoid refetching everything
    const existingFollows = await db
        .selectFrom('follows')
        .select(['follows'])
        .where('subject', '=', actor)
        .execute();

    // Create a Set for faster lookups
    const existingFollowsSet = new Set(existingFollows.map(f => f.follows));
    console.log(`Found ${existingFollowsSet.size} existing follows in database for ${actor}`);

    // If we already have follows, we might be able to stop early
    let allExistInDb = false;

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

            // Check if all DIDs in this page already exist in the database
            if (existingFollowsSet.size > 0 && !updateAll) {
                allExistInDb = data.follows.every(follow => existingFollowsSet.has(follow.did));
                if (allExistInDb) {
                    console.log(`🔄 All follows in current page already exist in database, stopping fetch for ${actor}`);
                    break; // Exit the loop since we've reached already stored follows
                }
            }

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
                console.warn(`Retry ${retryCount}/${maxRetries} after delay...`, true);
                await delay(retryDelay * retryCount); // Exponential backoff
                continue; // Retry the current cursor
            }

            // If we've exceeded retries, break the loop and work with what we have
            console.warn(`Maximum retries exceeded for ${actor}, proceeding with ${allFollows.length} follows`);
            break;
        }
    } while (currentCursor && !allExistInDb);

    console.log(`Fetched a total of ${allFollows.length} follows for ${actor}`);

    if (allFollows.length > 0) {
        try {
            await db
                .insertInto('follows')
                .values(allFollows)
                .onConflict((oc) => oc.columns(['subject', 'follows']).doNothing())
                .execute();
            console.log(`Successfully stored all ${allFollows.length} follows for ${actor} in database`);
        } catch (dbError) {
            console.error(`Database error while storing follows for ${actor}:`, dbError);
        }
    }


    return allFollows.map((entry) => entry.follows);
}