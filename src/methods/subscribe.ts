import express from 'express'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import { getProfile } from '../util/queries';


export default function registerSubscribeEndpoint(server: Server, ctx: AppContext) {
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

  server.xrpc.router.get('/api/subscribe', async (req, res) => {
    const { handle, did } = req.query;
    // Validate that either handle or did is provided
    if (!handle && !did) {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'Either handle or did must be provided'
      });
    }

    try {
      let resolvedHandle = handle as string | undefined;
      let resolvedDid = did as string | undefined;
      let profileResult: any;
      
      try {
        const actorToFetch = resolvedDid || resolvedHandle;
        profileResult = await getProfile(actorToFetch as string);
        
        // Extract both handle and DID from the profile
        resolvedHandle = profileResult.handle;
        resolvedDid = profileResult.did;
      } catch (err) {
        return res.status(404).json({
          error: 'NotFound',
          message: `Could not get profile for: ${resolvedDid || resolvedHandle}`
        });
      }

      // add new entry to db
      await ctx.db
        .insertInto('subscriber')
        .values({
          handle: resolvedHandle as string,
          did: resolvedDid as string
        })
        .onConflict((oc) => oc.doNothing())
        .execute()

      console.log(`[${new Date().toISOString()}] - ${resolvedHandle || resolvedDid} subscribed to feeds`);

      // Trigger background follows update without blocking the response
      const { triggerFollowsUpdateForSubscriber } = require('../util/scheduled-updater');
      triggerFollowsUpdateForSubscriber(ctx.db, resolvedDid as string);

      // Return the resolved identifiers
      return res.json({
        message: 'User succesfully subscribed to feeds',
        handle: resolvedHandle,
        did: resolvedDid,
        avatar: profileResult.avatar
      });
    } catch (error) {
      console.error('Error in subscribe endpoint:', error);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'An unexpected error occurred'
      });
    }
  });
}