import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { getFollows } from './queries'
import { SkeletonFeedPost } from '../lexicon/types/app/bsky/feed/defs'  // Import the correct type

// max 15 chars
export const shortname = 'newsflow-nl-1'

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
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(limit);

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString();
    publisherPostsQuery = publisherPostsQuery.where('post.indexedAt', '<', timeStr);
  }

  const publisherPosts = await publisherPostsQuery.execute();
  console.log(`Serving ${publisherPosts.length} posts from Dutch news`)

  // Fetch posts by follows
  let otherPostsQuery = ctx.db
    .selectFrom('post')
    .selectAll()
    .where((eb) => eb('author', 'in', requesterFollows))
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .limit(limit);

  if (params.cursor) {
    const timeStr = new Date(parseInt(params.cursor, 10)).toISOString();
    otherPostsQuery = otherPostsQuery.where('post.indexedAt', '<', timeStr);
  }

  const otherPosts = await otherPostsQuery.execute();
  console.log(`Serving ${otherPosts.length} posts from ${requesterFollows.length} follows`)

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

  return {
    cursor,
    feed,
  };
};
