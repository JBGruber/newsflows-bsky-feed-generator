import { Database } from '../db';

// Get all NEWSBOT_*_DID environment variables
function getNewsbotDids(): string[] {
  const newsbotDids: string[] = [];
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('NEWSBOT_') && key.endsWith('_DID')) {
      const did = process.env[key];
      if (did) {
        newsbotDids.push(did);
      }
    }
  });
  return newsbotDids;
}

/**
 * Updates engagement counts (likes, reposts, comments) for recent posts
 * For publisher posts (from newsbots), only counts engagement from subscribers
 * For other posts, counts all engagement
 */
export async function updateEngagement(db: Database): Promise<void> {
  // Use the same time limit as the feed builder
  const engagementTimeHours = process.env.ENGAGEMENT_TIME_HOURS ?
    parseInt(process.env.ENGAGEMENT_TIME_HOURS, 10) : 72;
  const timeLimit = new Date(Date.now() - engagementTimeHours * 60 * 60 * 1000).toISOString();
  try {
    console.log(`[${new Date().toISOString()}] - Starting scheduled update of subscriber engagement (last ${engagementTimeHours} hours)...`);

    // Get newsbot DIDs to identify publisher posts
    const newsbotDids = getNewsbotDids();

    // Get all subscribers from the database
    const subscribers = await db
      .selectFrom('subscriber')
      .select('did')
      .execute();
    const subscriberDids = subscribers.map(s => s.did);

    const follows = await db
      .selectFrom('follows')
      .select('follows')
      .execute();
    const followsList = follows.map(f => f.follows);

    console.log(`[${new Date().toISOString()}] - Found ${followsList.length} followed accounts to process.`);

    // If there are no followed accounts, skip the engagement update
    if (followsList.length === 0) {
      console.log(`[${new Date().toISOString()}] - No followed accounts to process, skipping engagement update.`);
      return;
    }

    // Get recent posts from followed accounts
    const recentPosts = await db
      .selectFrom('post')
      .where('post.indexedAt', '>=', timeLimit)
      .where('post.author', 'in', followsList)
      .select(['post.uri', 'post.author'])
      .execute();

    const postUris = recentPosts.map(post => post.uri);

    // Separate publisher posts from other posts
    const publisherPostUris: string[] = [];
    const otherPostUris: string[] = [];

    recentPosts.forEach(post => {
      if (newsbotDids.includes(post.author)) {
        publisherPostUris.push(post.uri);
      } else {
        otherPostUris.push(post.uri);
      }
    });

    if (postUris.length === 0) {
      console.log(`[${new Date().toISOString()}] - No recent posts to update.`);
      return;
    }

    console.log(`[${new Date().toISOString()}] - Found ${postUris.length} posts to update engagement stats for (${publisherPostUris.length} from publishers, ${otherPostUris.length} from others).`);

    // Count likes for each post
    // For other posts: count all engagement
    const otherLikesResult = otherPostUris.length > 0 ? await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', otherPostUris)
      .where('engagement.type', '=', 2) // Type 2 is for likes
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute() : [];

    // For publisher posts: only count engagement from subscribers
    const publisherLikesResult = (publisherPostUris.length > 0 && subscriberDids.length > 0) ? await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', publisherPostUris)
      .where('engagement.author', 'in', subscriberDids)
      .where('engagement.type', '=', 2) // Type 2 is for likes
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute() : [];

    const likeCountsResult = [...otherLikesResult, ...publisherLikesResult];

    // Count reposts for each post
    // For other posts: count all engagement
    const otherRepostsResult = otherPostUris.length > 0 ? await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', otherPostUris)
      .where('engagement.type', '=', 1) // Type 1 is for reposts
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute() : [];

    // For publisher posts: only count engagement from subscribers
    const publisherRepostsResult = (publisherPostUris.length > 0 && subscriberDids.length > 0) ? await db
      .selectFrom('engagement')
      .where('engagement.subjectUri', 'in', publisherPostUris)
      .where('engagement.author', 'in', subscriberDids)
      .where('engagement.type', '=', 1) // Type 1 is for reposts
      .select([
        'engagement.subjectUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('engagement.subjectUri')
      .execute() : [];

    const repostCountsResult = [...otherRepostsResult, ...publisherRepostsResult];

    // Count comments for each post (comments are posts with rootUri pointing to the original post)
    // For other posts: count all comments
    const otherCommentsResult = otherPostUris.length > 0 ? await db
      .selectFrom('post as comments')
      .where('comments.rootUri', 'in', otherPostUris)
      .where('comments.rootUri', '!=', '') // Ensure it's a real comment
      .select([
        'comments.rootUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('comments.rootUri')
      .execute() : [];

    // For publisher posts: only count comments from subscribers
    const publisherCommentsResult = (publisherPostUris.length > 0 && subscriberDids.length > 0) ? await db
      .selectFrom('post as comments')
      .where('comments.rootUri', 'in', publisherPostUris)
      .where('comments.author', 'in', subscriberDids)
      .where('comments.rootUri', '!=', '') // Ensure it's a real comment
      .select([
        'comments.rootUri as uri',
        db.fn.count<number>('uri').as('count')
      ])
      .groupBy('comments.rootUri')
      .execute() : [];

    const commentCountsResult = [...otherCommentsResult, ...publisherCommentsResult];

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
