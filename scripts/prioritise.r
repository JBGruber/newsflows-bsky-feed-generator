library(httr2)
readRenviron(".env")

resp <- paste0("https://", Sys.getenv("FEEDGEN_HOSTNAME")) |>
  request() |>
  req_url_path_append("/api/prioritize") |>
  req_method("POST") |>
  req_url_query(
    keywords = "Kyiv,Kiev",
    test = "false",
    priority = 1,
    maxdays = 1
  ) |>
  req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY")) |>
  req_error(body = \(resp) {
    resp_err <<- resp
    resp_body_json(resp)$error
  }) |>
  req_perform()
