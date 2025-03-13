import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getFollows } from './queries'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'  // Import the correct type

// max 15 chars
export const shortname = 'newsflow-nl-2'

export const handler = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
  console.log("Feed", shortname, "requested by", requesterDid, "at", new Date().toISOString())
  const publisherDid = process.env.FEEDGEN_PUBLISHER_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  const limit = Math.floor(params.limit / 2); // 50% from each source
  const requesterFollows = await getFollows(requesterDid, ctx.db)

  // Fetch posts from our News account
  let publisherPostsQuery = ctx.db
    .selectFrom('post')
    .selectAll()
    .where('author', '=', publisherDid)
    // Order by priority first, then by recency
    .orderBy((eb) => 
      eb.fn('coalesce', [eb.ref('priority'), eb.val(0)]), 'desc'
    )
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(limit);

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString();
    publisherPostsQuery = publisherPostsQuery.where('post.indexedAt', '<', timeStr);
  }

  const publisherPosts = await publisherPostsQuery.execute();

  // Fetch posts by follows
  let otherPostsQuery = ctx.db
    .selectFrom('post')
    .selectAll()
    .where('author', '!=', publisherDid)
    .where((eb) => eb('author', 'in', requesterFollows))
    // Order by priority first, then by recency
    .orderBy((eb) => 
      eb.fn('coalesce', [eb.ref('priority'), eb.val(0)]), 'desc'
    )
    // Then by most recent
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
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

  console.log(`[${new Date().toISOString()}] - Feed ${shortname} retrieved ${publisherPosts.length} publisher posts and ${otherPosts.length} other posts`);
  
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
