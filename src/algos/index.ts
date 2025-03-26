import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'

// NL
import * as feedNL1 from './feed-nl-1'
import * as feedNL2 from './feed-nl-2'
import * as feedNL3 from './feed-nl-3'
import * as feedNL4 from './feed-nl-4'

// IR
import * as feedIR1 from './feed-ir-1'
import * as feedIR2 from './feed-ir-2'
import * as feedIR3 from './feed-ir-3'
import * as feedIR4 from './feed-ir-4'

// FR
import * as feedFR1 from './feed-fr-1'
import * as feedFR2 from './feed-fr-2'
import * as feedFR3 from './feed-fr-3'
import * as feedFR4 from './feed-fr-4'

// CZ
import * as feedCZ1 from './feed-cz-1'
import * as feedCZ2 from './feed-cz-2'
import * as feedCZ3 from './feed-cz-3'
import * as feedCZ4 from './feed-cz-4'

type AlgoHandler = (ctx: AppContext, params: QueryParams, requesterDid: string) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
    // NL
    [feedNL1.shortname]: feedNL1.handler,
    [feedNL2.shortname]: feedNL2.handler,
    [feedNL3.shortname]: feedNL3.handler,
    [feedNL4.shortname]: feedNL4.handler,
  
    // IR
    [feedIR1.shortname]: feedIR1.handler,
    [feedIR2.shortname]: feedIR2.handler,
    [feedIR3.shortname]: feedIR3.handler,
    [feedIR4.shortname]: feedIR4.handler,
  
    // FR
    [feedFR1.shortname]: feedFR1.handler,
    [feedFR2.shortname]: feedFR2.handler,
    [feedFR3.shortname]: feedFR3.handler,
    [feedFR4.shortname]: feedFR4.handler,
  
    // CZ
    [feedCZ1.shortname]: feedCZ1.handler,
    [feedCZ2.shortname]: feedCZ2.handler,
    [feedCZ3.shortname]: feedCZ3.handler,
    [feedCZ4.shortname]: feedCZ4.handler,
}

export default algos
