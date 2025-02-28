export type DatabaseSchema = {
  post: Post
  engagement: Engagement
  follows: Follows
  sub_state: SubState
}

export type Post = {
  uri: string
  cid: string
  indexedAt: string
  createdAt: string
  author: string
  text: string
  rootUri: string
  rootCid: string
  linkUrl: string
  linkTitle: string
  linkDescription: string
}

export type Engagement = {
  uri: string
  cid: string
  type: number
  indexedAt: string
  createdAt: string
  author: string
}

export type Follows = {
  subject: string
  follows: string
}

export type SubState = {
  service: string
  cursor: number
}
