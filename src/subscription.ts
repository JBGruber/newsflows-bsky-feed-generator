import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'
// import fs from 'fs'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return

    const ops = await getOpsByType(evt)

    // This logs the text of every post off the firehose.
    // Just for fun :)
    // Delete before actually using
    // for (const post of ops.posts.creates) {
    //   console.log(post.record.text)
    // }

    // Save ops.posts as a JSON file for debugging
    // fs.appendFileSync('test.json', JSON.stringify(ops, null, 2), 'utf-8')

    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
          createdAt: create.record.createdAt,
          author: create.author,
          text: create.record.text,
          rootUri: create.record.reply?.root?.uri || "",
          rootCid: create.record.reply?.root?.cid || "",
        }
      })    

    // likes + reposts = engagement
    const typeMapping: Record<string, number> = {
      "app.bsky.feed.repost": 1,
      "app.bsky.feed.like": 2
    }
    const engagementsToDelete = ops.reposts.deletes.map((del) => del.uri).concat(
        ops.likes.deletes.map((del) => del.uri)
      )
    const engagementsToCreate = ops.reposts.creates
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          type: typeMapping[create.record.$type as string] ?? 0,
          indexedAt: new Date().toISOString(),
          createdAt: create.record.createdAt,
          author: create.author,
        }
      }).concat(
        ops.likes.creates
          .map((create) => {
            return {
              uri: create.uri,
              cid: create.cid,
              type: typeMapping[create.record.$type as string] ?? 0,
              indexedAt: new Date().toISOString(),
              createdAt: create.record.createdAt,
              author: create.author,
            }
          })
      )
    
    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute()
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }

    if (engagementsToDelete.length > 0) {
      await this.db
        .deleteFrom('engagement')
        .where('uri', 'in', engagementsToDelete)
        .execute()
    }
    if (engagementsToCreate.length > 0) {
      await this.db
        .insertInto('engagement')
        .values(engagementsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
