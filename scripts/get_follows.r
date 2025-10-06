library(httr2)
readRenviron(".env")
# for https servers use 
# follows <- request(paste0("https://", Sys.getenv("FEEDGEN_HOSTNAME"))) |> 
follows <- request(paste0("http://", Sys.getenv("FEEDGEN_HOSTNAME"), ":3020")) |> 
  req_url_path("/api/follows") |> 
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY"), .redact = "api-key") |> 
  req_perform() |> 
  resp_body_json()

follows_df <- follows |> 
  purrr::pluck("follows") |> 
  dplyr::bind_rows()

follows_df |> 
  filter(follows %in% c(
    "did:plc:toz4no26o2x4vsbum7cp4bxp",
    "did:plc:vzmnljt7otfbbgrmachtefxh",
    "did:plc:cegiy4pfghh4rjs7ks7pbnkm",
    "did:plc:kzmukwaf72iwepygposicgt3"
  ))
