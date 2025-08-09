// src/methods/prioritize-posts.ts
import express from 'express'
import { AppContext } from '../config'
import { Server } from '../lexicon'
import { sql, SqlBool } from 'kysely'

interface PriorityUpdate {
  uri: string;
  priority: number;
}

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

      // Check if request body contains JSON data (URI-based updates)
      if (req.body && Array.isArray(req.body)) {
        return handleJsonPriorityUpdates(req, res, ctx);
      }

      // Original keyword-based logic
      if (!keywords) {
        return res.status(400).json({ error: 'Missing required parameter: keywords (or provide JSON body with URIs)' })
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

  // Also provide a GET endpoint for convenience (keywords only)
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

// New function to handle JSON-based priority updates
async function handleJsonPriorityUpdates(
  req: express.Request, 
  res: express.Response, 
  ctx: AppContext
) {
  try {
    const { test = true } = req.query;
    
    // Parse the input data - expect direct array
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ 
        error: 'Invalid JSON format. Expected array of {uri, priority} objects' 
      });
    }

    const updates: PriorityUpdate[] = req.body;

    // Validate the updates
    const validUpdates: PriorityUpdate[] = [];
    const invalidUpdates: any[] = [];

    for (const update of updates) {
      if (!update.uri || typeof update.uri !== 'string' || 
          update.priority === undefined || typeof update.priority !== 'number') {
        invalidUpdates.push(update);
        continue;
      }
      validUpdates.push({
        uri: update.uri,
        priority: update.priority
      });
    }

    if (invalidUpdates.length > 0) {
      console.warn(`[${new Date().toISOString()}] - Found ${invalidUpdates.length} invalid updates`);
    }

    if (validUpdates.length === 0) {
      return res.status(400).json({ 
        error: 'No valid updates found. Each update must have "uri" (string) and "priority" (number)' 
      });
    }

    console.log(`[${new Date().toISOString()}] - Processing ${validUpdates.length} URI-based priority updates`);

    // Extract URIs to check which ones exist in the database
    const uris = validUpdates.map(update => update.uri);
    
    const existingPosts = await ctx.db
      .selectFrom('post')
      .select(['uri'])
      .where('uri', 'in', uris)
      .execute();

    const existingUris = new Set(existingPosts.map(post => post.uri));
    const foundUpdates = validUpdates.filter(update => existingUris.has(update.uri));
    const notFoundUris = validUpdates
      .filter(update => !existingUris.has(update.uri))
      .map(update => update.uri);

    if (test === true || String(test).toLowerCase() === 'true') {
      // Test mode: return what would be updated
      return res.json({
        mode: 'test',
        totalRequested: validUpdates.length,
        postsFound: foundUpdates.length,
        postsNotFound: notFoundUris.length,
        invalidUpdates: invalidUpdates.length,
        foundUpdates: foundUpdates,
        notFoundUris: notFoundUris,
        invalidEntries: invalidUpdates
      });
    } else {
      // Actual update mode
      if (foundUpdates.length === 0) {
        return res.json({
          mode: 'update',
          postsUpdated: 0,
          postsNotFound: notFoundUris.length,
          invalidUpdates: invalidUpdates.length,
          notFoundUris: notFoundUris,
          invalidEntries: invalidUpdates
        });
      }

      // Perform the updates in a transaction
      await ctx.db.transaction().execute(async (trx) => {
        // Update each post with its specific priority
        const updatePromises = foundUpdates.map(update => 
          trx
            .updateTable('post')
            .set('priority', update.priority)
            .where('uri', '=', update.uri)
            .execute()
        );

        await Promise.all(updatePromises);
      });

      console.log(`[${new Date().toISOString()}] - Updated ${foundUpdates.length} posts with custom priorities`);

      return res.json({
        mode: 'update',
        postsUpdated: foundUpdates.length,
        postsNotFound: notFoundUris.length,
        invalidUpdates: invalidUpdates.length,
        updatedUris: foundUpdates.map(u => u.uri),
        notFoundUris: notFoundUris,
        invalidEntries: invalidUpdates
      });
    }
  } catch (error) {
    console.error('Error in JSON priority updates:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}
