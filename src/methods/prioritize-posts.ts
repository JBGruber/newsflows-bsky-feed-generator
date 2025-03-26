// src/methods/prioritize.ts
import express from 'express'
import { AppContext } from '../config'
import { Server } from '../lexicon'
import { sql } from 'kysely'

// Export the function correctly
export default function registerPrioritizeEndpoint(server: Server, ctx: AppContext) {
  // Register the prioritize endpoint
  server.xrpc.router.post('/api/prioritize', async (req: express.Request, res: express.Response) => {
    try {
      // Extract parameters from the request
      const { keywords, test = true, priority = 1, maxdays = 1 } = req.query
      const apiKey = req.headers['api-key']

      // Validate API key if you want to secure the endpoint
      if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
      }

      // Validate required parameters
      if (!keywords) {
        return res.status(400).json({ error: 'Missing required parameter: keywords' })
      }

      // Convert keywords to array if it's a string
      const keywordsArray = Array.isArray(keywords)
        ? keywords
        : keywords.toString().split(',').map(k => k.trim())

      console.log(`[${new Date().toISOString()}] - Request to prioritize posts containing one of ${keywordsArray.length}`);
      
      // Generate conditions for the SQL query
      const textConditions = keywordsArray.map(keyword =>
        `text ~* '\\m${keyword}\\M'`
      ).join(' OR ')

      const linkConditions = keywordsArray.map(keyword =>
        `"linkDescription" ~* '\\m${keyword}\\M'`
      ).join(' OR ')

      const whereCondition = `
        WHERE (${textConditions} OR ${linkConditions})
          AND "createdAt" >= (CURRENT_DATE - INTERVAL '${maxdays} day')::text || 'T00:00:00.000Z'
          AND "createdAt" < (CURRENT_DATE + INTERVAL '${maxdays} day')::text || 'T00:00:00.000Z'
      `

      let results
      if (test === true || test === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = `SELECT * FROM post ${whereCondition}`
        results = await sql`${query}`.execute(ctx.db);
        console.log(`[${new Date().toISOString()}] - Prioritized ${results.length} posts`);
        return res.json({
          mode: 'test',
          query: query,
          matchedPosts: results,
          count: results.length
        })
      } else {
        // Actual update mode
        const query = `UPDATE post SET priority = ${priority} ${whereCondition} RETURNING uri`
        results = await sql`${query}`.execute(ctx.db);
        return res.json({
          mode: 'update',
          query: query,
          updatedPosts: results.length,
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
      // Extract parameters from the request
      const { keywords, test = true, priority = 1, maxdays = 1 } = req.query
      const apiKey = req.headers['api-key']

      // Validate API key if you want to secure the endpoint
      if (!apiKey || apiKey !== process.env.PRIORITIZE_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' })
      }

      // Validate required parameters
      if (!keywords) {
        return res.status(400).json({ error: 'Missing required parameter: keywords' })
      }

      // Convert keywords to array if it's a string
      const keywordsArray = Array.isArray(keywords)
        ? keywords
        : keywords.toString().split(',').map(k => k.trim())

      // Generate conditions for the SQL query
      const textConditions = keywordsArray.map(keyword =>
        `text ~* '\\m${keyword}\\M'`
      ).join(' OR ')

      const linkConditions = keywordsArray.map(keyword =>
        `"linkDescription" ~* '\\m${keyword}\\M'`
      ).join(' OR ')

      const whereCondition = `
              WHERE (${textConditions} OR ${linkConditions})
                AND "createdAt" >= (CURRENT_DATE - INTERVAL '${maxdays} day')::text || 'T00:00:00.000Z'
                AND "createdAt" < (CURRENT_DATE + INTERVAL '${maxdays} day')::text || 'T00:00:00.000Z'
            `

      let results
      if (test === true || test === 'true') {
        // Test mode: just return the posts that would be prioritized
        const query = `SELECT * FROM post ${whereCondition}`
        results = await sql`${query}`.execute(ctx.db);
        return res.json({
          mode: 'test',
          query: query,
          matchedPosts: results,
          count: results.length
        })
      } else {
        // Actual update mode
        const query = `UPDATE post SET priority = ${priority} ${whereCondition} RETURNING uri`
        results = await sql`${query}`.execute(ctx.db);
        return res.json({
          mode: 'update',
          query: query,
          updatedPosts: results.length,
          uris: results.map(row => row.uri)
        })
      }
    } catch (error) {
      console.error('Error in /api/prioritize:', error)
      return res.status(500).json({ error: 'Internal server error', details: error.message })
    }
  })
}