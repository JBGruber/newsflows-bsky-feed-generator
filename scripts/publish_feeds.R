# publishing feeds via the ts script was annoying since we have more than one
library(atrrr)
accounts <- c(
  "news-flows-nl.rds",
  "news-flows-ir.rds",
  "news-flows-fr.rds",
  "news-flows-cz.rds"
)

# NL feeds
## load token
account <- accounts[1]
tok <- file.path(tools::R_user_dir("atrrr", "cache"), account) |>
  atrrr:::read_token()
repo <- tok$did
message(tok$handle)

## publish feed 1-3
for (i in 1:3) {
  params <- list(
    repo = repo,
    collection = "app.bsky.feed.generator",
    rkey = paste0("newsflow-nl-", i),
    record = list(
      did = "did:web:feeds.jbgruber.online",
      displayName = paste0("nieuwsinfuus-", i),
      description = "Je posts met extra berichten",
      createdAt = format.POSIXct(
        Sys.time() - i * 60,
        "%Y-%m-%dT%H:%M:%OS3%ZZ",
        tz = "Z"
      ),
      contentMode = "app.bsky.feed.defs#contentModeUnspecified"
    ),
    validate = TRUE,
    .token = tok
  )

  out <- atrrr:::make_request(
    name = "bsky.social/xrpc/com.atproto.repo.putRecord",
    params = params,
    req_method = "POST"
  )
  message(paste("Feed", i, out$validationStatus))
}

# IR feeds
account <- accounts[2]
tok <- file.path(tools::R_user_dir("atrrr", "cache"), account) |>
  atrrr:::read_token()
repo <- tok$did
message(tok$handle)

for (i in 1:3) {
  params <- list(
    repo = repo,
    collection = "app.bsky.feed.generator",
    rkey = paste0("newsflow-ir-", i),
    record = list(
      did = "did:web:feeds.jbgruber.online",
      displayName = paste0("newsinfusion-", i),
      description = "Your Posts with extra Irish News",
      createdAt = format.POSIXct(
        Sys.time() - i * 60,
        "%Y-%m-%dT%H:%M:%OS3%ZZ",
        tz = "Z"
      ),
      contentMode = "app.bsky.feed.defs#contentModeUnspecified"
    ),
    validate = TRUE,
    .token = tok
  )

  out <- atrrr:::make_request(
    name = "bsky.social/xrpc/com.atproto.repo.putRecord",
    params = params,
    req_method = "POST"
  )
  message(paste("Feed", i, out$validationStatus))
}


# FR feeds
account <- accounts[3]
tok <- file.path(tools::R_user_dir("atrrr", "cache"), account) |>
  atrrr:::read_token()
repo <- tok$did
message(tok$handle)

for (i in 1:3) {
  params <- list(
    repo = repo,
    collection = "app.bsky.feed.generator",
    rkey = paste0("newsflow-fr-", i),
    record = list(
      did = "did:web:feeds.jbgruber.online",
      displayName = paste0("newsinfusion-", i),
      description = "Vos postes avec des nouvelles françaises supplémentaires",
      createdAt = format.POSIXct(
        Sys.time() - i * 60,
        "%Y-%m-%dT%H:%M:%OS3%ZZ",
        tz = "Z"
      ),
      contentMode = "app.bsky.feed.defs#contentModeUnspecified"
    ),
    validate = TRUE,
    .token = tok
  )

  out <- atrrr:::make_request(
    name = "bsky.social/xrpc/com.atproto.repo.putRecord",
    params = params,
    req_method = "POST"
  )
  message(paste("Feed", i, out$validationStatus))
}


# CZ feeds
account <- accounts[4]
tok <- file.path(tools::R_user_dir("atrrr", "cache"), account) |>
  atrrr:::read_token()
repo <- tok$did
message(tok$handle)

for (i in 1:3) {
  params <- list(
    repo = repo,
    collection = "app.bsky.feed.generator",
    rkey = paste0("newsflow-cz-", i),
    record = list(
      did = "did:web:feeds.jbgruber.online",
      displayName = paste0("novinekinfuze-", i),
      description = "Vaše příspěvky s extra českými zprávami",
      createdAt = format.POSIXct(
        Sys.time() - i * 60,
        "%Y-%m-%dT%H:%M:%OS3%ZZ",
        tz = "Z"
      ),
      contentMode = "app.bsky.feed.defs#contentModeUnspecified"
    ),
    validate = TRUE,
    .token = tok
  )

  out <- atrrr:::make_request(
    name = "bsky.social/xrpc/com.atproto.repo.putRecord",
    params = params,
    req_method = "POST"
  )
  message(paste("Feed", i, out$validationStatus))
}


## Delete feeds (if they need to be recreated)
if (FALSE) {
  df <- get_feeds_created_by(tok$handle, .token = tok)

  rkeys <- df$uri |>
    stringr::str_remove(".+/")

  for (rkey in rkeys) {
    out <- atrrr:::com_atproto_repo_delete_record(
      repo = repo,
      collection = "app.bsky.feed.generator",
      rkey = rkey,
      .token = tok
    )
    message("Feed ", rkey, " deleted")
  }
}

# check how a valid record looks like
record <- atrrr:::app_bsky_feed_get_feed_generator(
  "at://did:plc:kzmukwaf72iwepygposicgt3/app.bsky.feed.generator/newsflow-fr-1",
  .token = tok
)
