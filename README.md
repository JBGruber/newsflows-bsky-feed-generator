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

Subscription endpoint: <http://localhost:3000/api/subscribe?handle=news-flows-nl.bsky.social>

Prioritize endpoint: <http://localhost:3000/api/prioritize/>


## Build Image

1. Clone the repository and navigate to folder:

``` bash
git clone https://github.com/JBGruber/newsflows-bsky-feed-generator.git
cd newsflows-bsky-feed-generator
```

2. Build without caching to pull the newest version of all packages from GitHub:

``` bash
docker-compose down && \
  docker-compose build --no-cache && \
  docker-compose up -d
```

# Upload to dockerhub (for Contributors)

``` bash
docker image push jbgruber/bsky-feedgen:latest
```
