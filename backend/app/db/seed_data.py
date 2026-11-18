"""
Static NBA team reference data (franchise names/conference/division/colors).
This is well-known, unchanging reference info -- not a statistic derived from
the dataset -- so it's hardcoded here rather than inferred from game logs.

Abbreviations match exactly what appears in the source dataset's `team`/
`opponent` columns (verified against all 6 seasons during ingestion design).
Note: this dataset labels the San Antonio Spurs "SAN" rather than the more
common "SAS" -- kept as-is so foreign keys from player_game_stats resolve.

primary_color/secondary_color are each team's real, public brand colors
(standard across NBA broadcasts/merchandise/league branding), used for
consistent team-identity theming in the frontend -- not fabricated.
"""

TEAMS = [
    # abbreviation, full name, conference, division, primary_color, secondary_color
    ("ATL", "Atlanta Hawks", "East", "Southeast", "#E03A3E", "#26282A"),
    ("BKN", "Brooklyn Nets", "East", "Atlantic", "#000000", "#777D84"),
    ("BOS", "Boston Celtics", "East", "Atlantic", "#007A33", "#BA9653"),
    ("CHA", "Charlotte Hornets", "East", "Southeast", "#1D1160", "#00788C"),
    ("CHI", "Chicago Bulls", "East", "Central", "#CE1141", "#000000"),
    ("CLE", "Cleveland Cavaliers", "East", "Central", "#860038", "#FDBB30"),
    ("DAL", "Dallas Mavericks", "West", "Southwest", "#00538C", "#002B5E"),
    ("DEN", "Denver Nuggets", "West", "Northwest", "#0E2240", "#FEC524"),
    ("DET", "Detroit Pistons", "East", "Central", "#C8102E", "#1D42BA"),
    ("GSW", "Golden State Warriors", "West", "Pacific", "#1D428A", "#FFC72C"),
    ("HOU", "Houston Rockets", "West", "Southwest", "#CE1141", "#000000"),
    ("IND", "Indiana Pacers", "East", "Central", "#002D62", "#FDBB30"),
    ("LAC", "LA Clippers", "West", "Pacific", "#C8102E", "#1D428A"),
    ("LAL", "Los Angeles Lakers", "West", "Pacific", "#552583", "#FDB927"),
    ("MEM", "Memphis Grizzlies", "West", "Southwest", "#5D76A9", "#12173F"),
    ("MIA", "Miami Heat", "East", "Southeast", "#98002E", "#F9A01B"),
    ("MIL", "Milwaukee Bucks", "East", "Central", "#00471B", "#EEE1C6"),
    ("MIN", "Minnesota Timberwolves", "West", "Northwest", "#0C2340", "#236192"),
    ("NOP", "New Orleans Pelicans", "West", "Southwest", "#0C2340", "#C8102E"),
    ("NYK", "New York Knicks", "East", "Atlantic", "#006BB6", "#F58426"),
    ("OKC", "Oklahoma City Thunder", "West", "Northwest", "#007AC1", "#EF3B24"),
    ("ORL", "Orlando Magic", "East", "Southeast", "#0077C0", "#C4CED4"),
    ("PHI", "Philadelphia 76ers", "East", "Atlantic", "#006BB6", "#ED174C"),
    ("PHX", "Phoenix Suns", "West", "Pacific", "#1D1160", "#E56020"),
    ("POR", "Portland Trail Blazers", "West", "Northwest", "#E03A3E", "#000000"),
    ("SAC", "Sacramento Kings", "West", "Pacific", "#5A2D81", "#63727A"),
    ("SAN", "San Antonio Spurs", "West", "Southwest", "#000000", "#C4CED4"),
    ("TOR", "Toronto Raptors", "East", "Atlantic", "#CE1141", "#000000"),
    ("UTA", "Utah Jazz", "West", "Northwest", "#002B5C", "#F9A01B"),
    ("WAS", "Washington Wizards", "East", "Southeast", "#002B5C", "#E31837"),
]
