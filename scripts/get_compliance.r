library(httr2)
readRenviron(".env")
# for https servers use 
# requests <- request(paste0("https://", Sys.getenv("FEEDGEN_HOSTNAME"))) |> 
requests <- request(paste0("http://", Sys.getenv("FEEDGEN_HOSTNAME"), ":3020")) |> 
  req_url_path("/api/compliance") |> 
  # optional query parameters
  req_url_query(
    user_did = "did:plc:ntd53albt5ffa4rgervvgibd",
    min_date = format(Sys.time() - 2 * 60 * 60 * 24, "%Y-%m-%dT%H:%M:%S.000Z")
  ) |> 
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY"), .redact = "api-key") |> 
  req_perform() |> 
  resp_body_json()

requests_df <- requests |> 
  purrr::pluck("compliance") |> 
  dplyr::bind_rows() |> 
  tidyr::unnest_wider(posts)