import express from 'express'
import { AppContext } from './config'

const makeRouter = (ctx: AppContext) => {
  const router = express.Router()

  router.get('/', (_req, res) => {
    res.send(`
      <style>
        .logo-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
        }
        .logo-container img {
          width: 150px;  /* Half of original size for better fit */
          height: auto;
        }
      </style>
      <p>Newsflows Bluesky (atproto) Feed Generator - ${new Date().toISOString()}</p>
      <p>Available feeds</p>
      <ul>
        <li><a href="/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:toz4no26o2x4vsbum7cp4bxp/app.bsky.feed.generator/newsflow-nl-1">newsflow-nl-1</a></li>
      </ul>
      <div class="logo-container">
        <a href="https://newsflows.eu/" target="_blank">
          <img src="https://newsflows.eu/wp-content/uploads/2021/03/newsflowslogo-300x166.png" alt="Newsflows Logo">
        </a>
      </div>
    `);
  })

  router.get('/.well-known/did.json', (_req, res) => {
    if (!ctx.cfg.serviceDid.endsWith(ctx.cfg.hostname)) {
      return res.sendStatus(404)
    }
    res.json({
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: ctx.cfg.serviceDid,
      service: [
        {
          id: '#bsky_fg',
          type: 'BskyFeedGenerator',
          serviceEndpoint: `https://${ctx.cfg.hostname}`,
        },
      ],
    })
  })

  return router
}
export default makeRouter
