library(httr2)
readRenviron(".env")
requests <- request(paste0("http://", Sys.getenv("FEEDGEN_LISTENHOST"), ":3020")) |> 
  req_url_path("/api/compliance") |> 
  # optional query parameters
#  req_url_query(
#    user_did = "did:plc:ntd53albt5ffa4rgervvgibd",
#    min_date = "2025-09-23T00:00:00.000Z"
#  ) |> 
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY"), .redact = "api-key") |> 
  req_perform() |> 
  resp_body_json()

follows_df <- requests |> 
  purrr::pluck("compliance") |> 
  dplyr::bind_rows() |> 
  unnest_wider(posts)
