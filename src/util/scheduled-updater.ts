import { Database } from '../db';
import { getFollowsApi } from './queries';

// Track active timers
let activeTimers: NodeJS.Timeout[] = [];

/**
 * Updates follows data for all subscribers in the database
 * This runs as a scheduled task to keep follow data fresh
 */
export async function updateAllSubscriberFollows(db: Database, updateAll: boolean = false): Promise<void> {
  try {

    // Get all subscribers from the database
    const subscribers = await db
      .selectFrom('subscriber')
      .select(['did'])
      .execute();

    console.log(`[${new Date().toISOString()}] - Starting scheduled update of follows for ${subscribers.length} subscribers`);

    for (const subscriber of subscribers) {
      try {
        await getFollowsApi(subscriber.did, db, updateAll);
      } catch (error) {
        console.error(`Error updating follows for ${subscriber.did}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in scheduled follows update:', error);
  }
}

export function setupFollowsUpdateScheduler(
  db: Database,
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
  runImmediately: boolean = true,
  updateAll: boolean = false
): NodeJS.Timeout {

  if (runImmediately) {
    updateAllSubscriberFollows(db).catch(err => {
      console.error('Error in initial follows update:', err);
    });
  }

  // Set up recurring interval
  const timerId = setInterval(() => {
    updateAllSubscriberFollows(db, updateAll).catch(err => {
      console.error('Error in scheduled follows update:', err);
    });
  }, intervalMs);

  // Add to active timers list
  activeTimers.push(timerId);
  return timerId;
}

// Updates follows for a single subscriber without blocking
export function triggerFollowsUpdateForSubscriber(db: Database, did: string): void {
  // Run in the next event loop tick to avoid blocking
  setTimeout(async () => {
    try {
      console.log(`[${new Date().toISOString()}] - Background update: fetching follows for new subscriber ${did}`);
      await getFollowsApi(did, db);
    } catch (error) {
      console.error(`Error updating follows for ${did}:`, error);
    }
  }, 0);
}

export async function updateEngagement(db: Database): Promise<void> {
  const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  try {
    console.log(`[${new Date().toISOString()}] - Starting scheduled update of subscriber engagement...`);

    // Get all subscribers from the database
    const follows = await db
      .selectFrom('follows')
      .select('follows')
      .execute();
    const followsList = follows.map(f => f.follows);

    console.log(`[${new Date().toISOString()}] - Found ${followsList.length} followed accounts to process.`);

    // Get recent posts from followed accounts
    const recentPosts = await db
      .selectFrom('post')
      .where('post.indexedAt', '>=', timeLimit)
      .where('post.author', 'in', followsList)
      .select(['post.uri'])
      .execute();

    const postUris = recentPosts.map(post => post.uri);

    if (postUris.length === 0) {
      console.log(`[${new Date().toISOString()}] - No recent posts to update.`);
      return;
    }

    console.log(`[${new Date().toISOString()}] - Found ${postUris.length} posts to update engagement stats for.`);

    // Count likes for each post
    // Count likes for each post
    const likeCountsResult = await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', postUris)
      .where('engagement.type', '=', 2) // Type 2 is for likes
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute();

    // Count reposts for each post
    const repostCountsResult = await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', postUris)
      .where('engagement.type', '=', 1) // Type 1 is for reposts
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute();

    // Count comments for each post (comments are posts with rootUri pointing to the original post)
    const commentCountsResult = await db
      .selectFrom('post as comments')
      .where('comments.rootUri', 'in', postUris)
      .where('comments.rootUri', '!=', '') // Ensure it's a real comment
      .select([
        'comments.rootUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('comments.rootUri')
      .execute();

    // Create maps for quick lookups
    const likesMap = new Map(
      likeCountsResult.map(result => [result.uri, Number(result.count)])
    );

    const repostsMap = new Map(
      repostCountsResult.map(result => [result.uri, Number(result.count)])
    );

    const commentsMap = new Map(
      commentCountsResult.map(result => [result.uri, Number(result.count)])
    );

    // Update each post with the correct counts
    await db.transaction().execute(async (trx) => {
      // Process updates directly instead of creating batches
      const updatePromises = postUris.map(uri => {
        const likesCount = likesMap.get(uri) || 0;
        const repostsCount = repostsMap.get(uri) || 0;
        const commentsCount = commentsMap.get(uri) || 0;

        return trx
          .updateTable('post')
          .set({
            likes_count: likesCount,
            repost_count: repostsCount,
            comments_count: commentsCount
          })
          .where('uri', '=', uri)
          .execute();
      });

      // Process in chunks of 100 to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < updatePromises.length; i += batchSize) {
        const batch = updatePromises.slice(i, i + batchSize);
        await Promise.all(batch);
      }
    });

    console.log(`[${new Date().toISOString()}] - Successfully updated engagement counts for ${postUris.length} posts.`);
  } catch (error) {
    console.error('Error in scheduled engagement update:', error);
    throw error; // Re-throw to allow caller to handle the error
  }
}


export function setupEngagmentUpdateScheduler(
  db: Database,
  intervalMs: number = 60 * 60 * 1000, // Default: 1 hour
  runImmediately: boolean = true,
  updateAll: boolean = false
): NodeJS.Timeout {

  if (runImmediately) {
    updateEngagement(db).catch(err => {
      console.error('Error in initial follows update:', err);
    });
  }

  // Set up recurring interval
  const timerId = setInterval(() => {
    updateEngagement(db).catch(err => {
      console.error('Error in scheduled follows update:', err);
    });
  }, intervalMs);

  // Add to active timers list
  activeTimers.push(timerId);
  return timerId;
}


// Stop all running schedulers
export function stopAllSchedulers(): void {
  console.log(`[${new Date().toISOString()}] - Stopping ${activeTimers.length} active schedulers`);
  activeTimers.forEach(timerId => {
    clearInterval(timerId);
  });
  activeTimers = [];
}
