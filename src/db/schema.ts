export type DatabaseSchema = {
  post: Post
  engagement: Engagement
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
}

export type Engagement = {
  uri: string
  cid: string
  type: number
  indexedAt: string
  createdAt: string
  author: string
}

export type SubState = {
  service: string
  cursor: number
}
