import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { buildFeed, FeedGenerator } from './feed-builder'
import { Kysely } from 'kysely'
import { DatabaseSchema } from '../db/schema'
import { sql } from 'kysely';

// max 15 chars
export const shortname = 'newsflow-fr-3'

// Feed with engagement-based ordering
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

// Publisher posts query builder - with engagement prioritization
function buildPublisherPostsQuery(
  db: Kysely<DatabaseSchema>,
  timeLimit: string,
  requesterFollows: string[],
  cursorOffset: number,
  limit: number
) {
  const publisherDid = process.env.NEWSBOT_FR_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  return db
    .selectFrom('post')
    .selectAll()
    .where('author', '=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    // Order by time-decayed engagement score, then by recency
    .orderBy(
      sql`
        -- Base engagement score (likes + weighted reposts + comments)
        COALESCE(
          (COALESCE(likes_count, 0) + 
           COALESCE(repost_count, 0) * 1.5 + 
           COALESCE(comments_count, 0)), 
          0
        ) 
        * 
        -- Time decay factor (newer posts get higher multiplier)
        (1 - POWER(
          -- Age since timeLimit / Total time window
          (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "indexedAt"::timestamp)) / 
          (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM ${timeLimit}::timestamp)), 
          2
        ))
      `,
      'desc'
    )
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .offset(cursorOffset)
    .limit(limit);
}

// Follows posts query builder - with engagement prioritization
function buildFollowsPostsQuery(
  db: Kysely<DatabaseSchema>,
  timeLimit: string,
  requesterFollows: string[],
  cursorOffset: number,
  limit: number
) {
  const publisherDid = process.env.NEWSBOT_FR_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
  return db
    .selectFrom('post')
    .selectAll()
    .where('author', '!=', publisherDid)
    .where('post.indexedAt', '>=', timeLimit)
    .where((eb) => eb('author', 'in', requesterFollows))
    // Order by time-decayed engagement score, then by recency
    .orderBy(
      sql`
        -- Base engagement score (likes + weighted reposts + comments)
        COALESCE(
          (COALESCE(likes_count, 0) + 
           COALESCE(repost_count, 0) * 1.5 + 
           COALESCE(comments_count, 0)), 
          0
        ) 
        * 
        -- Time decay factor (newer posts get higher multiplier)
        (1 - POWER(
          -- Age since timeLimit / Total time window
          (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "indexedAt"::timestamp)) / 
          (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM ${timeLimit}::timestamp)), 
          2
        ))
      `,
      'desc'
    )
    .orderBy('indexedAt', 'desc')
    .orderBy('cid', 'desc')
    .offset(cursorOffset)
    .limit(limit);
}