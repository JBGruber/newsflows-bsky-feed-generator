import express from 'express'
import { AtpAgent } from '@atproto/api'
import { Server } from '../lexicon'
import { AppContext } from '../config'

// Create a global agent to be reused
const agent = new AtpAgent({
  service: 'https://bsky.social'
});

export default function registerSubscribeEndpoint(server: Server, ctx: AppContext) {
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
      // If only handle is provided, resolve the DID
      let resolvedHandle = handle as string | undefined;
      let resolvedDid = did as string | undefined;

      if (!did) {
        try {
          const handleResolveResult = await agent.resolveHandle({ handle: resolvedHandle as string });
          resolvedDid = handleResolveResult.data.did;
        } catch (err) {
          return res.status(404).json({
            error: 'NotFound',
            message: `Could not resolve DID for handle: ${resolvedHandle}`
          });
        }
      }

      // If only DID is provided, get the handle from profile
      if (!handle) {
        try {
          const profileResult = await agent.getProfile({ actor: resolvedDid as string });
          resolvedHandle = profileResult.data.handle;
        } catch (err) {
          return res.status(404).json({
            error: 'NotFound',
            message: `Could not resolve handle for DID: ${resolvedDid}`
          });
        }
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

      // Trigger background follows update without blocking the response
      const { triggerFollowsUpdateForSubscriber } = require('../util/scheduled-follows-updater');
      triggerFollowsUpdateForSubscriber(ctx.db, resolvedDid as string);

      // Return the resolved identifiers
      return res.json({
        message: 'User succesfully subscribed to feeds',
        handle: resolvedHandle,
        did: resolvedDid
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