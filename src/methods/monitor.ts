import express from 'express'
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
}