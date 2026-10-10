# Varcamp map

Draft WorkAdventure venue for Barcamp (Varcamp): a lobby, a main stage hall and
12 session rooms, sized for about 300 people online at once.

Map URL for the WorkAdventure admin ("URL of your custom map"):

    https://htooayelwinict.github.io/varcamp-map/varcamp.tmj

## Changing the map

`varcamp.tmj` and `tileset.png` are generated. Edit the constants at the top of
`build_map.py` (room count, sizes, video room names), then:

    python3 build_map.py   # needs Pillow; checks the map before writing it
    git commit -am "..." && git push

GitHub Pages republishes within a minute or two of the push.

The artwork is flat-colour placeholder tiles. The design notes are in
`docs/superpowers/specs/`.
