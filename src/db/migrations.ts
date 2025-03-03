import { Kysely, Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('post')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .addColumn('createdAt', 'varchar', (col) => col.notNull())
      .addColumn('author', 'varchar', (col) => col.notNull())
      .addColumn('text', 'text', (col) => col.notNull())
      .addColumn('rootUri', 'varchar', (col) => col.notNull())
      .addColumn('rootCid', 'varchar', (col) => col.notNull())
      .addColumn('linkUrl', 'varchar', (col) => col.notNull())
      .addColumn('linkTitle', 'varchar', (col) => col.notNull())
      .addColumn('linkDescription', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('engagement')
      .addColumn('uri', 'varchar', (col) => col.primaryKey())
      .addColumn('cid', 'varchar', (col) => col.notNull())
      .addColumn('type', 'integer', (col) => col.notNull())
      .addColumn('indexedAt', 'varchar', (col) => col.notNull())
      .addColumn('createdAt', 'varchar', (col) => col.notNull())
      .addColumn('author', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('follows')
      .addColumn('subject', 'varchar', (col) => col.notNull())
      .addColumn('follows', 'varchar', (col) => col.notNull())
      .addPrimaryKeyConstraint('follows_pk', ['subject', 'follows']) // Composite primary key
      .execute()
    await db.schema
      .createTable('sub_state')
      .addColumn('service', 'varchar', (col) => col.primaryKey())
      .addColumn('cursor', 'bigint', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('subscriber')
      .addColumn('handle', 'varchar', (col) => col.notNull())
      .addColumn('did', 'varchar', (col) => col.primaryKey())
      .execute()

    // indexes should bring performance
    await db.schema
      .createIndex('post_author_index')
      .on('post')
      .column('author')
      .execute()

    await db.schema
      .createIndex('follows_subject_index')
      .on('follows')
      .column('subject')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('post').execute()
    await db.schema.dropTable('sub_state').execute()
  },
}
