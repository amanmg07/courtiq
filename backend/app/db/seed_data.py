"""
Static NBA team reference data (franchise names/conference/division).
This is well-known, unchanging reference info -- not a statistic derived from
the dataset -- so it's hardcoded here rather than inferred from game logs.

Abbreviations match exactly what appears in the source dataset's `team`/
`opponent` columns (verified against all 6 seasons during ingestion design).
Note: this dataset labels the San Antonio Spurs "SAN" rather than the more
common "SAS" -- kept as-is so foreign keys from player_game_stats resolve.
"""

TEAMS = [
    # abbreviation, full name, conference, division
    ("ATL", "Atlanta Hawks", "East", "Southeast"),
    ("BKN", "Brooklyn Nets", "East", "Atlantic"),
    ("BOS", "Boston Celtics", "East", "Atlantic"),
    ("CHA", "Charlotte Hornets", "East", "Southeast"),
    ("CHI", "Chicago Bulls", "East", "Central"),
    ("CLE", "Cleveland Cavaliers", "East", "Central"),
    ("DAL", "Dallas Mavericks", "West", "Southwest"),
    ("DEN", "Denver Nuggets", "West", "Northwest"),
    ("DET", "Detroit Pistons", "East", "Central"),
    ("GSW", "Golden State Warriors", "West", "Pacific"),
    ("HOU", "Houston Rockets", "West", "Southwest"),
    ("IND", "Indiana Pacers", "East", "Central"),
    ("LAC", "LA Clippers", "West", "Pacific"),
    ("LAL", "Los Angeles Lakers", "West", "Pacific"),
    ("MEM", "Memphis Grizzlies", "West", "Southwest"),
    ("MIA", "Miami Heat", "East", "Southeast"),
    ("MIL", "Milwaukee Bucks", "East", "Central"),
    ("MIN", "Minnesota Timberwolves", "West", "Northwest"),
    ("NOP", "New Orleans Pelicans", "West", "Southwest"),
    ("NYK", "New York Knicks", "East", "Atlantic"),
    ("OKC", "Oklahoma City Thunder", "West", "Northwest"),
    ("ORL", "Orlando Magic", "East", "Southeast"),
    ("PHI", "Philadelphia 76ers", "East", "Atlantic"),
    ("PHX", "Phoenix Suns", "West", "Pacific"),
    ("POR", "Portland Trail Blazers", "West", "Northwest"),
    ("SAC", "Sacramento Kings", "West", "Pacific"),
    ("SAN", "San Antonio Spurs", "West", "Southwest"),
    ("TOR", "Toronto Raptors", "East", "Atlantic"),
    ("UTA", "Utah Jazz", "West", "Northwest"),
    ("WAS", "Washington Wizards", "East", "Southeast"),
]
