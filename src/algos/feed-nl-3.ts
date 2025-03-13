import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getFollows } from './queries'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'

// max 15 chars
export const shortname = 'newsflow-nl-3'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
  console.log(`[${new Date().toISOString()}] - Feed ${shortname} requested by ${requesterDid}`);
  const publisherDid = process.env.FEEDGEN_PUBLISHER_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  const limit = Math.floor(params.limit / 2); // 50% from each source
  const requesterFollows = await getFollows(requesterDid, ctx.db)
  // don't consider posts older than 24 hours
  const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Parse cursor if provided
  let cursorTimestamp: string | undefined;
  if (params.cursor) {
    cursorTimestamp = new Date(parseInt(params.cursor, 10)).toISOString();
  }

  // Build publisher posts query
  const publisherPostsQuery = ctx.db
    .selectFrom('post')
    .leftJoin('engagement', 'post.uri', 'engagement.subjectUri')
    .select([
      'post.uri',
      'post.indexedAt',
      'post.author'
    ])
    .select((eb) => [
      // Count engagements
      eb.fn.count('engagement.subjectUri').as('engagementCount')
    ])
    .where('post.author', '=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    .groupBy([
      'post.uri',
      'post.indexedAt',
      'post.author'
    ])
    // Order by engagement count
    .orderBy('engagementCount', 'desc')
    // Then by recent posts
    .orderBy('post.indexedAt', 'desc')
    .limit(limit);

  // Apply cursor if provided
  if (cursorTimestamp) {
    publisherPostsQuery.where('post.indexedAt', '<', cursorTimestamp);
  }

  // Build other posts query (from user's follows)
  const otherPostsQuery = ctx.db
    .selectFrom('post')
    .leftJoin('engagement', 'post.uri', 'engagement.subjectUri')
    .select([
      'post.uri',
      'post.indexedAt',
      'post.author'
    ])
    .select((eb) => [
      eb.fn.count('engagement.subjectUri').as('engagementCount')
    ])
    .where('post.author', '!=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    .groupBy([
      'post.uri',
      'post.indexedAt',
      'post.author'
    ])
    // Order by engagement count
    .orderBy('engagementCount', 'desc')
    // Then by recent posts
    .orderBy('post.indexedAt', 'desc')
    .limit(limit);

  // Apply cursor if provided
  if (cursorTimestamp) {
    otherPostsQuery.where('post.indexedAt', '<', cursorTimestamp);
  }

  // Add follows filter only if there are follows
  if (requesterFollows.length > 0) {
    otherPostsQuery.where('post.author', 'in', requesterFollows);
  } else {
    // If user follows nobody, don't return any "other" posts
    otherPostsQuery.where('post.author', '=', 'no-follows-placeholder');
  }

  // Execute both queries in parallel
  const [publisherPosts, otherPosts] = await Promise.all([
    publisherPostsQuery.execute(),
    otherPostsQuery.execute()
  ]);

  console.log(`[${new Date().toISOString()}] - Feed ${shortname} retrieved ${publisherPosts.length} publisher posts and ${otherPosts.length} other posts`);

  // Merge both post lists in an alternating pattern
  const feed: SkeletonFeedPost[] = [];
  const maxLength = Math.max(publisherPosts.length, otherPosts.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < publisherPosts.length) {
      feed.push({ post: publisherPosts[i].uri });
    }
    if (i < otherPosts.length) {
      feed.push({ post: otherPosts[i].uri });
    }
  }

  // Calculate cursor based on the oldest post included
  let cursor: string | undefined;
  const allPosts = [...publisherPosts, ...otherPosts];
  if (allPosts.length > 0) {
    const sortedPosts = [...allPosts].sort((a, b) =>
      new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
    );
    const lastPost = sortedPosts.at(-1);
    if (lastPost) {
      cursor = new Date(lastPost.indexedAt).getTime().toString(10);
    }
  }

  // Log request to database (non-blocking)
  setTimeout(async () => {
    try {
      const timestamp = new Date().toISOString();
      const requestInsertResult = await ctx.db
        .insertInto('request_log')
        .values({
          algo: shortname,
          requester_did: requesterDid,
          timestamp: timestamp
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      if (feed.length > 0) {
        const postValues = feed.map((post, index) => ({
          position: index + 1,
          request_id: requestInsertResult.id as number,
          post_uri: post.post
        }));

        await ctx.db
          .insertInto('request_posts')
          .values(postValues)
          .execute();
      }
    } catch (error) {
      console.error('Error logging request:', error);
    }
  }, 0);

  return {
    cursor,
    feed,
  };
};
