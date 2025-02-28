To import subscribers, create csv file subscribers.csv in the project directory. Should have columns handle and did, supply either, the other will be looked up.

Start Feed generator (Terminal 1):

```bash
yarn start
```

Browser <http://localhost:3000/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:toz4no26o2x4vsbum7cp4bxp/app.bsky.feed.generator/newsflow-nl-1>

Make https address (Terminal 2):

```bash
ngrok http --url=vast-frank-mink.ngrok-free.app http://localhost:3000
```

Check `Forwarding` address and change to e.g.:

<https://vast-frank-mink.ngrok-free.app/xrpc/app.bsky.feed.getFeedSkeleton?feed=at://did:plc:toz4no26o2x4vsbum7cp4bxp/app.bsky.feed.generator/newsflow-nl-1>

Publish to Bluesky (Terminal 2):

```bash
yarn publishFeed
```