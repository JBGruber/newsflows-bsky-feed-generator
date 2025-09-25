library(httr2)
readRenviron(".env")
follows <- request(paste0("http://", Sys.getenv("FEEDGEN_LISTENHOST"), ":3020")) |> 
  req_url_path("/api/follows") |> 
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY"), .redact = "api-key") |> 
  req_perform() |> 
  resp_body_json()

follows_df <- follows |> 
  purrr::pluck("follows") |> 
  dplyr::bind_rows()
