library(httr2)
readRenviron(".env")


#' Prioritise Posts for Feeds 2
#'
#' @param server server
#' @param keywords one or several keywords divided by comma. Commas are
#'   interpreted as OR, full words or terms are considered.
#' @param post_list alternativly, provide a list of URIs and priority values
#'   as a list. `priority` and `maxdays` are iignored in this case.
#' @param test TRUE/FALSE. Only test how many posts are affected or write
#'   priority values into the database.
#' @param priority values above 1 appear futher up in Feed 2.
#' @param maxdays maximum number of days to search posts (fractional values are
#'   possible).
#'
#' @returns
#' @export
#'
#' @examples
prioritize <- function(
  server,
  keywords,
  post_list,
  test = FALSE,
  priority = 1,
  maxdays = 1
) {
  if (missing(keywords) && missing(post_list)) {
    cli::cli_abort("You need to provide either keywords or post_list")
  }

  if (!missing(keywords)) {
    resp <- request(server) |>
      req_url_path_append("/api/prioritize") |>
      req_method("POST") |>
      req_url_query(
        keywords = keywords,
        test = test,
        priority = priority,
        maxdays = maxdays
      ) |>
      req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY")) |>
      req_error(body = \(resp) {
        switch(
          resp_content_type(resp),
          "text/html" = resp_body_html(resp) |> rvest::html_text2(),
          "application/json" = resp_body_json(resp)$error
        )
      }) |>
      req_perform()

    out <- resp |>
      resp_body_json() |>
      atrrr:::as_tibble_onerow() |>
      dplyr::mutate(parameters = toString(unlist(parameters)))
    return(out)
  }
  if (!missing(post_list)) {
    resp <- request(server) |>
      req_url_path_append("/api/prioritize") |>
      req_method("POST") |>
      req_url_query(
        test = test
      ) |>
      req_body_json(post_list) |>
      req_headers("api-key" = Sys.getenv("PRIORITIZE_API_KEY")) |>
      req_error(body = \(resp) {
        switch(
          resp_content_type(resp),
          "text/html" = resp_body_html(resp) |> rvest::html_text2(),
          "application/json" = resp_body_json(resp)$error
        )
      }) |>
      req_perform()

    out <- resp |>
      resp_body_json() |>
      atrrr:::as_tibble_onerow()
    return(out)
  }
}

server <- "http://localhost:3020"
server <- paste0("https://", Sys.getenv("FEEDGEN_HOSTNAME"))
res <- prioritize(
  server,
  keywords = "Trump,Biden",
  test = TRUE,
  priority = 1,
  maxdays = 0.1
)


post_list <- data.frame(
  uri = c(
    "at://did:plc:abc123/app.bsky.feed.post/xyz",
    "at://did:plc:def456/app.bsky.feed.post/abc",
    "at://did:plc:ghi789/app.bsky.feed.post/def"
  ),
  priority = c(1L, 2L, 3L)
)
res <- prioritize(
  server,
  post_list = post_list,
  test = TRUE
)
