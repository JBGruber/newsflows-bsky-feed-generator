import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getFollows } from './queries'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'  // Import the correct type

// max 15 chars
export const shortname = 'newsflow-nl-3'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
  console.log("Feed", shortname, "requested by", requesterDid, "at", new Date().toISOString())
  const publisherDid = process.env.FEEDGEN_PUBLISHER_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  const limit = Math.floor(params.limit / 2); // 50% from each source
  const requesterFollows = await getFollows(requesterDid, ctx.db)
  // don't consider posts older than 24 hours
  const timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch posts from our News account
  let publisherPostsQuery = ctx.db
    .selectFrom('post')
    .leftJoin('engagement', 'post.uri', 'engagement.uri')
    .select([
      'post.uri',
      'post.cid',
      'post.indexedAt',
      'post.createdAt',
      'post.author',
      'post.text',
      'post.rootUri',
      'post.rootCid',
      'post.linkUrl',
      'post.linkTitle',
      'post.linkDescription',
      // Count engagements grouped by post
      ctx.db.fn.count<number>('engagement.uri').as('engagementCount')
    ])
    .where('post.author', '=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit.toISOString())
    .groupBy('post.uri')
    .groupBy('post.cid')
    .groupBy('post.indexedAt')
    .groupBy('post.createdAt')
    .groupBy('post.author')
    .groupBy('post.text')
    .groupBy('post.rootUri')
    .groupBy('post.rootCid')
    .groupBy('post.linkUrl')
    .groupBy('post.linkTitle')
    .groupBy('post.linkDescription')
    // Order by engagement count first, then by recency
    .orderBy('engagementCount', 'desc')
    .orderBy('post.indexedAt', 'desc')
    .orderBy('post.cid', 'desc')
    .limit(limit);

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString();
    publisherPostsQuery = publisherPostsQuery.where('post.indexedAt', '<', timeStr);
  }

  const publisherPosts = await publisherPostsQuery.execute();

  // Fetch posts by follows
  let otherPostsQuery = ctx.db
    .selectFrom('post')
    .leftJoin('engagement', 'post.uri', 'engagement.uri')
    .select([
      'post.uri',
      'post.cid',
      'post.indexedAt',
      'post.createdAt',
      'post.author',
      'post.text',
      'post.rootUri',
      'post.rootCid',
      'post.linkUrl',
      'post.linkTitle',
      'post.linkDescription',
      // Count engagements grouped by post
      ctx.db.fn.count<number>('engagement.uri').as('engagementCount')
    ])
    // don't consider posts older than 24 hours
    .where('post.indexedAt', '>=', timeLimit.toISOString())
    .where('post.author', '!=', publisherDid)
    .where((eb) => eb('post.author', 'in', requesterFollows))
    .groupBy('post.uri')
    .groupBy('post.cid')
    .groupBy('post.indexedAt')
    .groupBy('post.createdAt')
    .groupBy('post.author')
    .groupBy('post.text')
    .groupBy('post.rootUri')
    .groupBy('post.rootCid')
    .groupBy('post.linkUrl')
    .groupBy('post.linkTitle')
    .groupBy('post.linkDescription')
    // Order by engagement count first, then by recency
    .orderBy('engagementCount', 'desc')
    .orderBy('post.indexedAt', 'desc')
    .orderBy('post.cid', 'desc')
    .limit(limit);

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString();
    otherPostsQuery = otherPostsQuery.where('post.indexedAt', '<', timeStr);
  }

  const otherPosts = await otherPostsQuery.execute();

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

  let cursor: string | undefined;
  const lastPost = [...publisherPosts, ...otherPosts].sort((a, b) =>
    new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
  ).at(-1);

  if (lastPost) {
    cursor = new Date(lastPost.indexedAt).getTime().toString(10);
  }

  // log request to database (non-blocking)
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