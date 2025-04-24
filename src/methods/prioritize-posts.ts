// src/methods/prioritize.ts
import express from 'express'
import { AppContext } from '../config'
import { Server } from '../lexicon'
import { sql, SqlBool } from 'kysely'
import { lexInteger } from '@atproto/lexicon'

export default function registerPrioritizeEndpoint(server: Server, ctx: AppContext) {
  // Register the prioritize endpoint
  server.xrpc.router.post('/api/prioritize', async (req: express.Request, res: express.Response) => {
    try {
      const { keywords, test = true, priority = 1, maxdays = 1 } = req.query
      const apiKey = req.headers['api-key']

      if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
        console.log(`[${new Date().toISOString()}] - Attempted unauthorized access with API key ${apiKey}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
      }

      if (!keywords) {
        return res.status(400).json({ error: 'Missing required parameter: keywords' })
      }

      const maxdaysNumber = Number(maxdays) || 1;
      const timeLimit = new Date(Date.now() - maxdaysNumber * 60 * 60 * 1000).toISOString();
      const priorityNumber = Number(priority) || 1;

      // Convert keywords to array if it's a string
      const keywordsArray = Array.isArray(keywords)
        ? keywords
        : keywords.toString().split(',').map(k => k.trim())

      console.log(`[${new Date().toISOString()}] - Request to prioritize posts containing one of ${keywordsArray.length} keywords`);

      // Generate conditions for the SQL query
      const rgx = keywordsArray.map(keyword =>
        `${keyword}`
      ).join('|')
      const rgxCondition = `\\m(${rgx})\\M`

      let results
      if (test === true || test === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = ctx.db
          .selectFrom('post')
          .selectAll()
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        results = await query
          .execute();
        console.log(`[${new Date().toISOString()}] - Prioritized ${results.length} posts`);
        const compiledQuery = query.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          uris: results.map(row => row.uri)
        })
      } else {
        // Actual update mode
        const query = ctx.db
          .updateTable('post')
          .set('priority', priorityNumber)
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        results = await query
          .execute();
        console.log(`[${new Date().toISOString()}] - Set ${results.length} posts to priority ${priorityNumber}`);
        const compiledQuery = query.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          uris: results.map(row => row.uri)
        })
      }
    } catch (error) {
      console.error('Error in /api/prioritize:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  })

  // Also provide a GET endpoint for convenience
  server.xrpc.router.get('/api/prioritize', async (req: express.Request, res: express.Response) => {
    try {
      const { keywords, test = true, priority = 1, maxdays = 1 } = req.query
      const apiKey = req.headers['api-key']

      if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
        console.log(`[${new Date().toISOString()}] - Attempted unauthorized access with API key ${apiKey}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
      }

      if (!keywords) {
        return res.status(400).json({ error: 'Missing required parameter: keywords' })
      }

      const maxdaysNumber = Number(maxdays) || 1;
      const timeLimit = new Date(Date.now() - maxdaysNumber * 60 * 60 * 1000).toISOString();
      const priorityNumber = Number(priority) || 1;

      // Convert keywords to array if it's a string
      const keywordsArray = Array.isArray(keywords)
        ? keywords
        : keywords.toString().split(',').map(k => k.trim())

      console.log(`[${new Date().toISOString()}] - Request to prioritize posts containing one of ${keywordsArray.length} keywords`);

      // Generate conditions for the SQL query
      const rgx = keywordsArray.map(keyword =>
        `${keyword}`
      ).join('|')
      const rgxCondition = `\\m(${rgx})\\M`

      let results
      if (test === true || test === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = ctx.db
          .selectFrom('post')
          .selectAll()
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        results = await query
          .execute();
        console.log(`[${new Date().toISOString()}] - Prioritized ${results.length} posts`);
        const compiledQuery = query.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          uris: results.map(row => row.uri)
        })
      } else {
        // Actual update mode
        const query = ctx.db
          .updateTable('post')
          .set('priority', priorityNumber)
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        results = await query
          .execute();
        console.log(`[${new Date().toISOString()}] - Set ${results.length} posts to priority ${priorityNumber}`);
        const compiledQuery = query.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          uris: results.map(row => row.uri)
        })
      }
    } catch (error) {
      console.error('Error in /api/prioritize:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  })
}
