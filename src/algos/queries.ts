interface FollowsResponse {
    follows: Array<{
        did: string[];
        handle: string[];
        // other fields optional since we won't use them
    }>;
    subject: {
        did: string[];
        // other fields optional since we won't use them
    };
    cursor?: string;
}

interface SimplifiedFollow {
    subject: string[];
    follows: string[];
}

// Query local database to find follows; use API call if nothing is found
export async function getFollows(actor: string, db): Promise<string[]> {
    console.log("Reuesting follows for:", actor)
    const followsDid = await db
        .selectFrom('follows')
        .select(['follows'])
        .where('subject', '=', actor)
        .execute();

    if (followsDid.length > 0) {
        return followsDid;
    }

    return getFollowsApi(actor, db);
}

export async function getFollowsApi(actor: string, db): Promise<string[]> {
    console.log("Nothing found in db. Trying API")
    const baseUrl = 'https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows';
    let allFollows: SimplifiedFollow[] = [];
    let currentCursor: string | undefined = undefined;

    do {
        const url = new URL(baseUrl);
        url.searchParams.append('actor', actor);
        url.searchParams.append('limit', '100');
        if (currentCursor) {
            url.searchParams.append('cursor', currentCursor);
        }
        try {
            const response = await fetch(url.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json() as FollowsResponse;
            const simplifiedFollows = data.follows.map((follow) => {
                return {
                    subject: data.subject.did,
                    follows: follow.did,
                }
            })

            allFollows = [...allFollows, ...simplifiedFollows.flat()];
            currentCursor = data.cursor;
        } catch (error) {
            console.error('Error fetching follows:', error);
            throw error;
        }
    } while (currentCursor);


    if (allFollows.length > 0) {
        // write new data to db before returning it
        await db
            .insertInto('follows')
            .values(allFollows)
            .onConflict((oc) => oc.columns(['subject', 'follows']).doNothing())
            .execute()
    }

    return allFollows.map((entry) => entry.follows).flat();
}