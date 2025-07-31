// src/methods/feed-generation.ts - Fixed authentication logic
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { extractDidFromAuth } from '../auth'
import { AtUri } from '@atproto/syntax'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]
    if (
      // turned off publisherDid validation
      // feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    
    // Check if whitelist enforcement is enabled
    const enforceWhitelist = process.env.FEEDGEN_SUBSCRIBER_ONLY === 'true';
    
    if (!enforceWhitelist) {
      // Open access mode - skip all authentication and whitelist checks
      console.warn(`[${new Date().toISOString()}] - Skipping whitelist check (open access mode)`);
      const defaultDid = process.env.FEEDGEN_PUBLISHER_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
      const body = await algo(ctx, params, defaultDid);
      return {
        encoding: 'application/json',
        body: body,
      }
    }
    
    // Subscriber-only mode - require authentication and whitelist membership
    let requesterDid: string;
    try {
      requesterDid = await extractDidFromAuth(req);
    } catch (e) {
      console.log(`[${new Date().toISOString()}] - Authentication required but not provided`);
      return {
        encoding: 'application/json',
        body: { "feed": [] },
      }
    }
    
    // Check if the authenticated user is on the whitelist
    const whitelist = await ctx.db
      .selectFrom('subscriber')
      .selectAll()
      .where('did', '=', requesterDid)
      .execute();
    
    if (whitelist.length > 0) {
      const body = await algo(ctx, params, requesterDid);
      return {
        encoding: 'application/json',
        body: body,
      }
    } else {
      console.log(`[${new Date().toISOString()}] - request denied (${requesterDid} not on whitelist)`);
      return {
        encoding: 'application/json',
        body: { "feed": [] },
      }
    }
  })
}
