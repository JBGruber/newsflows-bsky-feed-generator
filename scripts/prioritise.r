library(tidyverse)
readRenviron(".env")
# DBI::dbDisconnect(con)
con <- DBI::dbConnect(RPostgres::Postgres(),
  dbname = Sys.getenv("FEEDGEN_DB_BASE"),
  host = "localhost",
  port = 5434,
  user = Sys.getenv("FEEDGEN_DB_USER"),
  password = Sys.getenv("FEEDGEN_DB_PASSWORD")
)

prioritise <- function(con, kwords, test = TRUE, show_query = TRUE) {
  # Use regex with word boundaries for whole word matching
  text_conditions <- paste(sprintf("text ~* '\\m%s\\M'", kwords), collapse = " OR ")
  link_conditions <- paste(sprintf("\"linkDescription\" ~* '\\m%s\\M'", kwords), collapse = " OR ")
  
  where_condition <- sprintf("
  WHERE (%s OR %s)
    AND \"createdAt\" >= (CURRENT_DATE - INTERVAL '1 day')::text || 'T00:00:00.000Z'
    AND \"createdAt\" < (CURRENT_DATE + INTERVAL '1 day')::text || 'T00:00:00.000Z'
  ", text_conditions, link_conditions)
  
  if (test) {
    q <- paste("SELECT * FROM post", where_condition)
    if (show_query) cat(q)
    as_tibble(DBI::dbGetQuery(con, q))    
  } else {
    q <- paste("UPDATE post SET priority = 1", where_condition)
    if (show_query) cat(q)
    DBI::dbExecute(con, q)
  }
}


# Vector of keywords
kwords <- c(
  "Europese",
  "European",
  "EU"
)

test_df <- prioritise(con, kwords, test = TRUE)
test_df |>
  filter(author == "did:plc:toz4no26o2x4vsbum7cp4bxp") |>
  View()

prioritise(con, kwords, test = FALSE)
DBI::dbDisconnect(con)