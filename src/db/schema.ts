export type DatabaseSchema = {
  post: Post
  engagement: Engagement
  follows: Follows
  sub_state: SubState
  subscriber: Subscriber
  request_log: RequestLog
  request_posts: RequestPosts
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
  cursor: bigint
}

export type Subscriber = {
  handle: string
  did: string
}

export type RequestLog = {
  id?: number
  algo: string
  requester_did: string
  timestamp: string
}

export type RequestPosts = {
  position: number
  request_id: number
  post_uri: string
}
