import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../lexicon'
import { AppContext } from '../config'
import algos from '../algos'
import { extractDidFromAuth } from '../auth'
import { AtUri } from '@atproto/syntax'
import fs from 'fs'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.feed.getFeedSkeleton(async ({ params, req }) => {
    const feedUri = new AtUri(params.feed)
    const algo = algos[feedUri.rkey]
    if (
      feedUri.hostname !== ctx.cfg.publisherDid ||
      feedUri.collection !== 'app.bsky.feed.generator' ||
      !algo
    ) {
      throw new InvalidRequestError(
        'Unsupported algorithm',
        'UnsupportedAlgorithm',
      )
    }
    // set publisher as default to not have empty did
    let requesterDid = process.env.FEEDGEN_PUBLISHER_DID || 'did:plc:toz4no26o2x4vsbum7cp4bxp';
    try {
      requesterDid = await extractDidFromAuth(
        req
      )
    } catch (e) {
      console.error(e)
    }
    let whitelist = await ctx.db
      .selectFrom('subscriber')
      .selectAll()
      .where('did', '=', requesterDid)
      .execute()

    const skipWhitelistCheck = process.env.FEEDGEN_SUBSCRIBER_ONLY === 'false';
    if (skipWhitelistCheck) console.warn(`[${new Date().toISOString()}] - Skipping whitelist check`)
    if (skipWhitelistCheck || whitelist.length > 0) {
      const body = await algo(ctx, params, requesterDid)
      return {
        encoding: 'application/json',
        body: body,
      }
    } else {
      console.log("not on whitelist");
      return {
        encoding: 'application/json',
        body: { "feed": [] },
      }
    }
  })
}
