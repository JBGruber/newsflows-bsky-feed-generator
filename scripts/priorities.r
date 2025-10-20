library(httr2)
readRenviron(".env")
# for https servers use
# base_req <- request(paste0(
#   "https://",
#   Sys.getenv("FEEDGEN_HOSTNAME"),
#   ":443"
# ))
base_req <- request(paste0(
  "http://",
  Sys.getenv("FEEDGEN_HOSTNAME"),
  ":3020"
))
priorities <- base_req |>
  req_url_path("/api/priorities") |>
  req_url_query(
    publisher_did = "did:plc:toz4no26o2x4vsbum7cp4bxp"
  ) |>
  req_headers(
    "api-key" = Sys.getenv("PRIORITIZE_API_KEY"),
    .redact = "api-key"
  ) |>
  req_perform() |>
  resp_body_json()

priorities_df <- priorities |>
  purrr::pluck("posts") |>
  dplyr::bind_rows()

# or get engagement for the accounts a requester DID follows
priorities <- base_req |>
  req_url_path("/api/priorities") |>
  req_url_query(
    # note this is a different parameter
    requester_did = atrrr::get_user_info("jbgruber.bsky.social")$did
  ) |>
  req_headers(
    "api-key" = Sys.getenv("PRIORITIZE_API_KEY"),
    .redact = "api-key"
  ) |>
  req_perform() |>
  resp_body_json()

priorities_df <- priorities |>
  purrr::pluck("posts") |>
  dplyr::bind_rows()
