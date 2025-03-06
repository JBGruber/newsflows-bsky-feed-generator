import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as feedNL1 from './feed-nl-1'
import * as feedNL2 from './feed-nl-2'
import * as feedNL3 from './feed-nl-3'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid: string) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [feedNL1.shortname]: feedNL1.handler,
  [feedNL2.shortname]: feedNL2.handler,
  [feedNL3.shortname]: feedNL3.handler,
}

export default algos
