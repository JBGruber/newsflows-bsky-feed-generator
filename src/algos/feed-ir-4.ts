import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { buildFeed, FeedGenerator } from './feed-builder'
import { Kysely } from 'kysely'
import { DatabaseSchema } from '../db/schema'
import { sql } from 'kysely';

// max 15 chars
export const shortname = 'newsflow-ir-4'

// Feed with engagement-based and priority ordering
export const handler: FeedGenerator = async (ctx: AppContext, params: QueryParams, requesterDid: string) => {
  return buildFeed({
    shortname,
    ctx,
    params,
    requesterDid,
    buildPublisherQuery: buildPublisherPostsQuery,
    buildFollowsQuery: buildFollowsPostsQuery
  });
};

// Publisher posts query builder - with engagement and priority
function buildPublisherPostsQuery(
  db: Kysely<DatabaseSchema>,
  timeLimit: string,
  requesterFollows: string[],
  cursorOffset: number,
  limit: number
) {
  const publisherDid = process.env.NEWSBOT_IR_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  return db
    .selectFrom('post')
    .selectAll()
    .where('author', '=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    // Order by engagement, priority, then recency
    .orderBy(
      sql`COALESCE((COALESCE(likes_count, 0) + COALESCE(repost_count, 0) * 1.5 + COALESCE(comments_count, 0)), 0)`,
      'desc'
    )
    .orderBy((eb) => 
      eb.fn('coalesce', [eb.ref('priority'), eb.val(0)]), 'desc'
    )
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .offset(cursorOffset)
    .limit(limit);
}

// Follows posts query builder - with engagement and priority
function buildFollowsPostsQuery(
  db: Kysely<DatabaseSchema>,
  timeLimit: string,
  requesterFollows: string[],
  cursorOffset: number,
  limit: number
) {
  const publisherDid = process.env.NEWSBOT_IR_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  return db
    .selectFrom('post')
    .selectAll()
    .where('author', '!=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    .where((eb) => eb('author', 'in', requesterFollows))
    // Order by engagement, priority, then recency
    .orderBy(
      sql`COALESCE((COALESCE(likes_count, 0) + COALESCE(repost_count, 0) * 1.5 + COALESCE(comments_count, 0)), 0)`,
      'desc'
    )
    .orderBy((eb) => 
      eb.fn('coalesce', [eb.ref('priority'), eb.val(0)]), 'desc'
    )
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .offset(cursorOffset)
    .limit(limit);
}
