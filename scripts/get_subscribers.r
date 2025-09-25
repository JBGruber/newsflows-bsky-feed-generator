library(httr2)
readRenviron(".env")
subscribers <- request(paste0("http://", Sys.getenv("FEEDGEN_LISTENHOST"), ":3020")) |> 
  req_url_path("/api/subscribers") |> 
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY"), .redact = "api-key") |> 
  req_perform() |> 
  resp_body_json()

subscribers_df <- subscribers |> 
  purrr::pluck("subscribers") |> 
  dplyr::bind_rows()
