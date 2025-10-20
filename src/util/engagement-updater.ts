import { Database } from '../db';
import { sql } from 'kysely';

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

    // Get recent posts from followed accounts and newsbots
    // Combine both lists to ensure we capture all relevant posts
    const accountsToCheck = [...new Set([...followsList, ...newsbotDids])];

    const recentPosts = await db
      .selectFrom('post')
      .where('post.indexedAt', '>=', timeLimit)
      .where('post.author', 'in', accountsToCheck)
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

    // Update posts with counts
    const batchSize = 15000;
    for (let i = 0; i < postUris.length; i += batchSize) {
      const batchUris = postUris.slice(i, i + batchSize);

      // Build CASE statements for bulk update using sql template
      const likesCases = sql.join(
        batchUris.map(uri => sql`WHEN uri = ${uri} THEN ${likesMap.get(uri) || 0}`),
        sql` `
      );

      const repostsCases = sql.join(
        batchUris.map(uri => sql`WHEN uri = ${uri} THEN ${repostsMap.get(uri) || 0}`),
        sql` `
      );

      const commentsCases = sql.join(
        batchUris.map(uri => sql`WHEN uri = ${uri} THEN ${commentsMap.get(uri) || 0}`),
        sql` `
      );

      // Execute single UPDATE with CASE for the entire batch
      await sql`
        UPDATE post
        SET
          likes_count = CASE ${likesCases} ELSE likes_count END,
          repost_count = CASE ${repostsCases} ELSE repost_count END,
          comments_count = CASE ${commentsCases} ELSE comments_count END
        WHERE uri IN (${sql.join(batchUris.map(uri => sql`${uri}`), sql`, `)})
      `.execute(db);

      console.log(`[${new Date().toISOString()}] - Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(postUris.length / batchSize)} (${batchUris.length} posts)`);
    }

    console.log(`[${new Date().toISOString()}] - Successfully updated engagement counts for ${postUris.length} posts.`);
  } catch (error) {
    console.error('Error in scheduled engagement update:', error);
    throw error; // Re-throw to allow caller to handle the error
  }
}
