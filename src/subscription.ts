import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

// for saving embedded preview cards
function isExternalEmbed(embed: any): embed is { external: { uri: string, title: string, description: string } } {
  return embed && embed.external && typeof embed.external.uri === 'string';
}

// Helper function to sanitize strings for PostgreSQL
function sanitizeForPostgres(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  // Remove null bytes which cause PostgreSQL errors
  return text.replace(/\0/g, '');
}

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


    const postsToDelete = ops.posts.deletes.map((del) => del.uri)
    const postsToCreate = ops.posts.creates
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          indexedAt: new Date().toISOString(),
          createdAt: create.record.createdAt,
          author: create.author,
          text: sanitizeForPostgres(create.record.text),
          rootUri: create.record.reply?.root?.uri || "",
          rootCid: create.record.reply?.root?.cid || "",
          // extract preview card info if present
          linkUrl: create.record.embed && isExternalEmbed(create.record.embed) ? create.record.embed.external.uri : "",
          linkTitle: sanitizeForPostgres(
            create.record.embed && isExternalEmbed(create.record.embed) ? create.record.embed.external.title : ""
          ),
          linkDescription: sanitizeForPostgres(
            create.record.embed && isExternalEmbed(create.record.embed) ? create.record.embed.external.description : ""
          ),
        }
      })

      
    // likes + reposts = engagement
    const engagementsToDelete = ops.reposts.deletes.map((del) => del.uri).concat(
      ops.likes.deletes.map((del) => del.uri)
    )
    const engagementsToCreate = ops.reposts.creates
      .map((create) => {
        return {
          uri: create.uri,
          cid: create.cid,
          subjectUri: create.record.subject.uri,
          subjectCid: create.record.subject.cid,
          type: 1,
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
              subjectUri: create.record.subject.uri,
              subjectCid: create.record.subject.cid,
              type: 2,
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
