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
      const rgxCondition = keywordsArray.map(keyword =>
        `\\m(${keyword})\\M`
      ).join('|')

      if (test === true || String(test).toLowerCase() === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = ctx.db
          .selectFrom('post')
          .selectAll()
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        
        const results = await query.execute();
        console.log(`[${new Date().toISOString()}] - Found ${results.length} posts that would be prioritized`);
        
        const compiledQuery = query.compile();
        return res.json({
          mode: 'test',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          postsFound: results.length,
          uris: results.map(row => row.uri)
        })
      } else {
        // Actual update mode: First get the posts that will be updated, then update them using their URIs
        const selectQuery = ctx.db
          .selectFrom('post')
          .select(['uri'])
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        
        const postsToUpdate = await selectQuery.execute();
        
        if (postsToUpdate.length === 0) {
          console.log(`[${new Date().toISOString()}] - No posts found matching criteria`);
          return res.json({
            mode: 'update',
            postsUpdated: 0,
            uris: []
          })
        }

        const urisToUpdate = postsToUpdate.map(row => row.uri);

        // Now perform the update using the specific URIs
        const updateQuery = ctx.db
          .updateTable('post')
          .set('priority', priorityNumber)
          .where('uri', 'in', urisToUpdate)
        
        await updateQuery.execute();
        const updatedCount = urisToUpdate.length; // We know exactly how many we're updating
        
        console.log(`[${new Date().toISOString()}] - Set ${updatedCount} posts to priority ${priorityNumber}`);
        
        const compiledQuery = updateQuery.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          postsUpdated: updatedCount,
          uris: urisToUpdate
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
      const rgxCondition = keywordsArray.map(keyword =>
        `\\m(${keyword})\\M`
      ).join('|')

      if (test === true || String(test).toLowerCase() === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = ctx.db
          .selectFrom('post')
          .selectAll()
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        
        const results = await query.execute();
        console.log(`[${new Date().toISOString()}] - Found ${results.length} posts that would be prioritized`);
        
        const compiledQuery = query.compile();
        return res.json({
          mode: 'test',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          postsFound: results.length,
          uris: results.map(row => row.uri)
        })
      } else {
        // Actual update mode: First get the posts that will be updated, then update them using their URIs
        const selectQuery = ctx.db
          .selectFrom('post')
          .select(['uri'])
          .where(sql<SqlBool>`(text ~* ${rgxCondition} OR "linkDescription" ~* ${rgxCondition})`)
          .where('createdAt', '>=', timeLimit)
        
        const postsToUpdate = await selectQuery.execute();
        
        if (postsToUpdate.length === 0) {
          console.log(`[${new Date().toISOString()}] - No posts found matching criteria`);
          return res.json({
            mode: 'update',
            postsUpdated: 0,
            uris: []
          })
        }

        const urisToUpdate = postsToUpdate.map(row => row.uri);

        // Now perform the update using the specific URIs
        const updateQuery = ctx.db
          .updateTable('post')
          .set('priority', priorityNumber)
          .where('uri', 'in', urisToUpdate)
        
        const updateResult = await updateQuery.execute();
        const updatedCount = updateResult.length; // Number of rows in the result array
        
        console.log(`[${new Date().toISOString()}] - Set ${updatedCount} posts to priority ${priorityNumber}`);
        
        const compiledQuery = updateQuery.compile();
        return res.json({
          mode: 'update',
          query: compiledQuery.sql,
          parameters: compiledQuery.parameters,
          postsUpdated: updatedCount,
          uris: urisToUpdate
        })
      }
    } catch (error) {
      console.error('Error in /api/prioritize:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  })
}
