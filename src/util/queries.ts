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
            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
            }

            const data = await response.json() as FollowsResponse;

            if (!data.follows || !Array.isArray(data.follows)) {
                console.warn(`[${new Date().toISOString()}] - Unexpected response format for ${actor}:`, data);
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
                    break; // Exit the loop since we've reached already stored follows
                }
            }

            allFollows = [...allFollows, ...simplifiedFollows];
            currentCursor = data.cursor;
            retryCount = 0; // Reset retry count on success

        } catch (error) {
            console.error(`[${new Date().toISOString()}] - Error fetching follows for ${actor}:`, error);

            // Implement retry logic
            retryCount++;
            if (retryCount <= maxRetries) {
                console.warn(`[${new Date().toISOString()}] - Retry ${retryCount}/${maxRetries} after delay...`, true);
                await delay(retryDelay * retryCount); // Exponential backoff
                continue; // Retry the current cursor
            }

            // If we've exceeded retries, break the loop and work with what we have
            console.warn(`[${new Date().toISOString()}] - Maximum retries exceeded for ${actor}, proceeding with ${allFollows.length} follows`);
            break;
        }
    } while (currentCursor && !allExistInDb);

    if (allFollows.length > 0) {
        try {
            await db
                .insertInto('follows')
                .values(allFollows)
                .onConflict((oc) => oc.columns(['subject', 'follows']).doNothing())
                .execute();
            console.log(`[${new Date().toISOString()}] - Fetched ${allFollows.length} new follows for ${actor}`);
        } catch (dbError) {
            console.error(`[${new Date().toISOString()}] - Database error while storing follows for ${actor}:`, dbError);
        }
    } else {
        console.log(`[${new Date().toISOString()}] - Follows for ${actor} were already complete`);
    }

    return allFollows.map((entry) => entry.follows);
}


interface ProfileResponse {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
    indexedAt?: string;
    // Add other fields as needed from ProfileViewDetailed
}


// Query API for user profile
export async function getProfile(actor: string): Promise<ProfileResponse | null> {
    const baseUrl = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile';
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    // Function to delay execution
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    while (retryCount <= maxRetries) {
        try {
            const url = new URL(baseUrl);
            url.searchParams.append('actor', actor);
            
            const response = await fetch(url.toString());

            if (!response.ok) {
                if (response.status === 400) {
                    console.warn(`[${new Date().toISOString()}] - Profile not found for actor: ${actor}`);
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
            }

            const data = await response.json() as ProfileResponse;

            if (!data.did || !data.handle) {
                console.warn(`[${new Date().toISOString()}] - Invalid profile response for ${actor}:`, data);
                return null;
            }

            console.log(`[${new Date().toISOString()}] - Successfully fetched profile for ${actor} (@${data.handle})`);
            return data;

        } catch (error) {
            console.error(`[${new Date().toISOString()}] - Error fetching profile for ${actor}:`, error);

            // Implement retry logic
            retryCount++;
            if (retryCount <= maxRetries) {
                console.warn(`[${new Date().toISOString()}] - Retry ${retryCount}/${maxRetries} for profile ${actor} after delay...`);
                await delay(retryDelay * retryCount); // Exponential backoff
                continue; // Retry
            }

            // If we've exceeded retries, return null
            console.warn(`[${new Date().toISOString()}] - Maximum retries exceeded for ${actor}, returning null`);
            return null;
        }
    }

    return null;
}
