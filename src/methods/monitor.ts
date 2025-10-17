import { Server } from '../lexicon'
import { AppContext } from '../config'
import { sql } from 'kysely'

export default function registerMonitorEndpoints(server: Server, ctx: AppContext) {
  server.xrpc.router.get('/api/subscribers', async (req, res) => {
    const apiKey = req.headers['api-key']

    if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
      console.log(`[${new Date().toISOString()}] - Attempted unauthorized access to subscribers with API key ${apiKey}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    try {
      const subscribers = await ctx.db
        .selectFrom('subscriber')
        .selectAll()
        .orderBy('handle', 'asc')
        .execute()

      console.log(`[${new Date().toISOString()}] - Retrieved ${subscribers.length} subscribers`);

      return res.json({
        count: subscribers.length,
        subscribers: subscribers
      });
    } catch (error) {
      console.error('Error retrieving subscribers:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });

  server.xrpc.router.get('/api/follows', async (req, res) => {
    const apiKey = req.headers['api-key']

    if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
      console.log(`[${new Date().toISOString()}] - Attempted unauthorized access to follows with API key ${apiKey}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    try {
      const follows = await ctx.db
        .selectFrom('follows')
        .selectAll()
        .orderBy('subject', 'asc')
        .execute()

      console.log(`[${new Date().toISOString()}] - Retrieved ${follows.length} follows`);

      return res.json({
        count: follows.length,
        follows: follows
      });
    } catch (error) {
      console.error('Error retrieving follows:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });

  server.xrpc.router.get('/api/compliance', async (req, res) => {
    const apiKey = req.headers['api-key']

    if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
      console.log(`[${new Date().toISOString()}] - Attempted unauthorized access to compliance with API key ${apiKey}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    try {
      const { min_date, user_did } = req.query;

      // Build the query with JSON aggregation for posts (only from request_posts table)
      let query = ctx.db
        .selectFrom('request_log as rl')
        .leftJoin('request_posts as rp', 'rl.id', 'rp.request_id')
        .select([
          'rl.id',
          'rl.algo',
          'rl.requester_did',
          'rl.timestamp',
          sql<any>`COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('uri', rp.post_uri, 'position', rp.position)
            ) FILTER (WHERE rp.post_uri IS NOT NULL),
            '[]'::json
          )`.as('posts')
        ])
        .groupBy(['rl.id', 'rl.algo', 'rl.requester_did', 'rl.timestamp'])

      // Apply optional filters
      if (user_did) {
        query = query.where('rl.requester_did', '=', user_did as string)
      }

      if (min_date) {
        query = query.where('rl.timestamp', '>', min_date as string)
      }

      const compliance = await query.execute()

      console.log(`[${new Date().toISOString()}] - Retrieved ${compliance.length} compliance records`);

      return res.json({
        count: compliance.length,
        compliance: compliance
      });
    } catch (error) {
      console.error('Error retrieving compliance data:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });

  server.xrpc.router.get('/api/engagement', async (req, res) => {
    const apiKey = req.headers['api-key']

    if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
      console.log(`[${new Date().toISOString()}] - Attempted unauthorized access to engagement with API key ${apiKey}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    try {
      const { requester_did, publisher_did, page } = req.query;

      // Validate that exactly one of requester_did or publisher_did is provided
      if ((!requester_did && !publisher_did) || (requester_did && publisher_did)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Exactly one of requester_did or publisher_did must be provided'
        });
      }

      // Parse page parameter (default to 0)
      const pageNum = page ? parseInt(page as string, 10) : 0;
      if (isNaN(pageNum) || pageNum < 0) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'page must be a non-negative integer'
        });
      }

      const limit = 100;
      const offset = pageNum * limit;

      // Get engagement time window from environment
      const engagementTimeHours = process.env.ENGAGEMENT_TIME_HOURS ?
        parseInt(process.env.ENGAGEMENT_TIME_HOURS, 10) : 72;
      const timeLimit = new Date(Date.now() - engagementTimeHours * 60 * 60 * 1000).toISOString();

      let posts: any[];
      let queryType: string;

      if (publisher_did) {
        // Query for posts by the specified publisher
        queryType = 'publisher';
        posts = await ctx.db
          .selectFrom('post')
          .select([
            'uri',
            'indexedAt',
            'likes_count',
            'repost_count',
            'comments_count',
            // Base engagement score
            sql<number>`
              COALESCE(
                (COALESCE(likes_count, 0) +
                 COALESCE(repost_count, 0) * 1.5 +
                 COALESCE(comments_count, 0)),
                0
              )
            `.as('base_engagement_score'),
            // Time-decayed engagement score
            sql<number>`
              COALESCE(
                (COALESCE(likes_count, 0) +
                 COALESCE(repost_count, 0) * 1.5 +
                 COALESCE(comments_count, 0)),
                0
              )
              *
              (1 - POWER(
                (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "indexedAt"::timestamp)) /
                (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM ${timeLimit}::timestamp)),
                2
              ))
            `.as('time_decayed_engagement_score')
          ])
          .where('author', '=', publisher_did as string)
          .where('post.indexedAt', '>=', timeLimit)
          .orderBy('time_decayed_engagement_score', 'desc')
          .orderBy('indexedAt', 'desc')
          .orderBy('cid', 'desc')
          .offset(offset)
          .limit(limit)
          .execute();
      } else {
        // Query for posts by people the requester follows
        queryType = 'follows';
        const { getFollows } = await import('../util/queries');
        const requesterFollows = await getFollows(requester_did as string, ctx.db);

        posts = await ctx.db
          .selectFrom('post')
          .select([
            'uri',
            'indexedAt',
            'likes_count',
            'repost_count',
            'comments_count',
            // Base engagement score
            sql<number>`
              COALESCE(
                (COALESCE(likes_count, 0) +
                 COALESCE(repost_count, 0) * 1.5 +
                 COALESCE(comments_count, 0)),
                0
              )
            `.as('base_engagement_score'),
            // Time-decayed engagement score
            sql<number>`
              COALESCE(
                (COALESCE(likes_count, 0) +
                 COALESCE(repost_count, 0) * 1.5 +
                 COALESCE(comments_count, 0)),
                0
              )
              *
              (1 - POWER(
                (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM "indexedAt"::timestamp)) /
                (EXTRACT(EPOCH FROM NOW()) - EXTRACT(EPOCH FROM ${timeLimit}::timestamp)),
                2
              ))
            `.as('time_decayed_engagement_score')
          ])
          .where('post.indexedAt', '>=', timeLimit)
          .where((eb) => eb('author', 'in', requesterFollows))
          .orderBy('time_decayed_engagement_score', 'desc')
          .orderBy('indexedAt', 'desc')
          .orderBy('cid', 'desc')
          .offset(offset)
          .limit(limit)
          .execute();
      }

      console.log(`[${new Date().toISOString()}] - Retrieved ${posts.length} ${queryType} posts with engagement scores, page ${pageNum}`);

      return res.json({
        count: posts.length,
        page: pageNum,
        limit: limit,
        query_type: queryType,
        requester_did: requester_did || null,
        publisher_did: publisher_did || null,
        time_limit: timeLimit,
        engagement_time_hours: engagementTimeHours,
        posts: posts
      });
    } catch (error) {
      console.error('Error retrieving engagement data:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });

  server.xrpc.router.get('/api/priorities', async (req, res) => {
    const apiKey = req.headers['api-key']

    if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
      console.log(`[${new Date().toISOString()}] - Attempted unauthorized access to priorities with API key ${apiKey}`);
      return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
    }

    try {
      const { requester_did, publisher_did, page, min_priority } = req.query;

      // Validate that exactly one of requester_did or publisher_did is provided
      if ((!requester_did && !publisher_did) || (requester_did && publisher_did)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Exactly one of requester_did or publisher_did must be provided'
        });
      }

      // Parse page parameter (default to 0)
      const pageNum = page ? parseInt(page as string, 10) : 0;
      if (isNaN(pageNum) || pageNum < 0) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'page must be a non-negative integer'
        });
      }

      // Parse min_priority parameter (default to 1)
      const minPriority = min_priority ? parseInt(min_priority as string, 10) : 1;
      if (isNaN(minPriority)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'min_priority must be an integer'
        });
      }

      const limit = 100;
      const offset = pageNum * limit;

      let posts: any[];
      let queryType: string;

      if (publisher_did) {
        // Query for posts by the specified publisher
        queryType = 'publisher';
        posts = await ctx.db
          .selectFrom('post')
          .select([
            'uri',
            'indexedAt',
            'priority',
            'likes_count',
            'repost_count',
            'comments_count',
            sql<number>`COALESCE(priority, 0)`.as('priority_value')
          ])
          .where('author', '=', publisher_did as string)
          .where((eb) => eb('priority', '>=', minPriority))
          .orderBy(sql`COALESCE(priority, 0)`, 'desc')
          .orderBy('indexedAt', 'desc')
          .orderBy('cid', 'desc')
          .offset(offset)
          .limit(limit)
          .execute();
      } else {
        // Query for posts by people the requester follows
        queryType = 'follows';
        const { getFollows } = await import('../util/queries');
        const requesterFollows = await getFollows(requester_did as string, ctx.db);

        posts = await ctx.db
          .selectFrom('post')
          .select([
            'uri',
            'indexedAt',
            'priority',
            'likes_count',
            'repost_count',
            'comments_count',
            sql<number>`COALESCE(priority, 0)`.as('priority_value')
          ])
          .where((eb) => eb('author', 'in', requesterFollows))
          .where((eb) => eb('priority', '>=', minPriority))
          .orderBy(sql`COALESCE(priority, 0)`, 'desc')
          .orderBy('indexedAt', 'desc')
          .orderBy('cid', 'desc')
          .offset(offset)
          .limit(limit)
          .execute();
      }

      console.log(`[${new Date().toISOString()}] - Retrieved ${posts.length} ${queryType} posts with priorities >= ${minPriority}, page ${pageNum}`);

      return res.json({
        count: posts.length,
        page: pageNum,
        limit: limit,
        query_type: queryType,
        requester_did: requester_did || null,
        publisher_did: publisher_did || null,
        min_priority: minPriority,
        posts: posts
      });
    } catch (error) {
      console.error('Error retrieving priorities data:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });
}