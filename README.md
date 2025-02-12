

Start Feed generator (Terminal 1):

```bash
yarn start
```

Browser <http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:toz4no26o2x4vsbum7cp4bxp/app.bsky.feed.generator/newsflow-nl-1>

Make https address (Terminal 2):

```bash
ngrok http http://localhost:3000
```

Check `Forwarding` address and change to e.g.:

<https://9404-2a02-2455-12de-ae00-e22-542d-5fa-e44f.ngrok-free.app/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:toz4no26o2x4vsbum7cp4bxp/app.bsky.feed.generator/newsflow-nl-1>

Publish to Bluesky (Terminal 2):

```bash
yarn publishFeed
```