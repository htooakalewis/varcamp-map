#!/usr/bin/env python3
"""Generate the Varcamp draft venue: tileset.png and varcamp.tmj.

Run `python3 build_map.py` after changing any constant below. The script
checks its own output and exits non-zero if the map is not walkable.
"""
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
TILE = 32

# --- venue dimensions (in tiles) -------------------------------------------
W = 70
ROOMS_PER_SIDE = 6
ROOM_INNER_H = 8                    # walkable rows inside a session room
SIDE_W = 13                         # x of the left rooms' lobby-side wall
STAGE_BOTTOM = 19                   # y of the wall between stage hall and lobby
ROOM_PITCH = ROOM_INNER_H + 1
H = STAGE_BOTTOM + ROOMS_PER_SIDE * ROOM_PITCH + 1
RIGHT_X = W - 1 - SIDE_W            # x of the right rooms' lobby-side wall
JITSI_PREFIX = "varcamp-room-"

# --- tileset ----------------------------------------------------------------
COLS = 8
(ZONE, LOBBY, WALL, HALL, STAGE, ROOM, QUIET, DOOR, DESK, SPAWN, SEAT) = range(11)
NUM0 = 16                           # tiles NUM0..NUM0+11 carry room numbers 1..12
TILE_COUNT = 32
COLLIDING = (WALL, DESK)


def gid(index):
    return index + 1


def font(size):
    for path in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                 "/System/Library/Fonts/Helvetica.ttc",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_tileset():
    rows = TILE_COUNT // COLS
    img = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    def box(index):
        x, y = (index % COLS) * TILE, (index // COLS) * TILE
        return x, y, x + TILE - 1, y + TILE - 1

    def flat(index, fill, edge=None):
        draw.rectangle(box(index), fill=fill, outline=edge or fill)

    flat(LOBBY, (226, 221, 208), (214, 208, 194))
    flat(WALL, (52, 58, 74), (36, 41, 54))
    flat(HALL, (126, 87, 160), (114, 77, 147))
    flat(STAGE, (176, 128, 78), (150, 106, 62))
    flat(ROOM, (92, 150, 190), (80, 136, 176))
    flat(QUIET, (120, 170, 130), (106, 156, 116))
    flat(DOOR, (240, 200, 90), (214, 176, 70))
    flat(DESK, (120, 84, 52), (88, 60, 36))
    flat(SPAWN, (244, 240, 230), (232, 120, 90))
    flat(SEAT, (126, 87, 160), (114, 77, 147))
    x0, y0, x1, y1 = box(SEAT)
    draw.rounded_rectangle((x0 + 7, y0 + 9, x1 - 7, y1 - 7), 4, fill=(84, 54, 112))

    f = font(18)
    for n in range(12):
        index = NUM0 + n
        flat(index, (240, 200, 90), (214, 176, 70))
        x0, y0, x1, y1 = box(index)
        draw.text(((x0 + x1) / 2 + 1, (y0 + y1) / 2 + 1), str(n + 1),
                  font=f, fill=(36, 41, 54), anchor="mm")

    img.save(OUT / "tileset.png")
    return img.size


# --- layout -----------------------------------------------------------------
def room_rows(k):
    """Walkable rows of the k-th room on a side (0 = nearest the stage)."""
    top = STAGE_BOTTOM + k * ROOM_PITCH + 1
    return range(top, top + ROOM_INNER_H)


def rooms():
    """Yield (number, interior xs, interior ys, door x, sign x)."""
    for k in range(ROOMS_PER_SIDE):
        yield k + 1, range(1, SIDE_W), room_rows(k), SIDE_W, SIDE_W + 1
    for k in range(ROOMS_PER_SIDE):
        yield (ROOMS_PER_SIDE + k + 1, range(RIGHT_X + 1, W - 1), room_rows(k),
               RIGHT_X, RIGHT_X - 1)


def door_rows(ys):
    mid = ys[len(ys) // 2]
    return (mid - 1, mid)


LOBBY_XS = range(SIDE_W + 1, RIGHT_X)
LOBBY_YS = range(STAGE_BOTTOM + 1, H - 1)
HALL_XS = range(1, W - 1)
HALL_YS = range(1, STAGE_BOTTOM)
STAGE_XS = range(W // 2 - 10, W // 2 + 10)
STAGE_YS = range(2, 6)
STAGE_DOORS = (range(22, 26), range(44, 48))
SPAWN_XS = range(W // 2 - 5, W // 2 + 5)
SPAWN_YS = range(STAGE_BOTTOM + 10, STAGE_BOTTOM + 16)
DESK_XS = range(W // 2 - 2, W // 2 + 2)
DESK_Y = STAGE_BOTTOM + 5
QUIET_XS = range(W // 2 - 7, W // 2 + 7)
QUIET_YS = range(H - 8, H - 2)


def empty():
    return [0] * (W * H)


def put(layer, x, y, index):
    layer[y * W + x] = gid(index)


def fill(layer, xs, ys, index):
    for y in ys:
        for x in xs:
            put(layer, x, y, index)


def build_layers():
    floor, walls, furniture, start = empty(), empty(), empty(), empty()
    zones = []

    fill(walls, range(W), range(H), WALL)

    def carve(xs, ys, index):
        fill(floor, xs, ys, index)
        fill(walls, xs, ys, -1)      # gid 0: no wall

    carve(HALL_XS, HALL_YS, HALL)
    fill(floor, STAGE_XS, STAGE_YS, STAGE)
    for y in range(8, STAGE_BOTTOM - 1, 2):
        fill(floor, range(6, W - 6), [y], SEAT)
        for xs in STAGE_DOORS:       # keep aisles clear down to the doors
            fill(floor, xs, [y], HALL)
    carve(LOBBY_XS, LOBBY_YS, LOBBY)
    for xs in STAGE_DOORS:
        carve(xs, [STAGE_BOTTOM], DOOR)
    fill(floor, QUIET_XS, QUIET_YS, QUIET)
    fill(start, SPAWN_XS, SPAWN_YS, SPAWN)
    fill(furniture, DESK_XS, [DESK_Y], DESK)

    for number, xs, ys, door_x, sign_x in rooms():
        carve(xs, ys, ROOM)
        for y in door_rows(ys):
            carve([door_x], [y], DOOR)
            put(floor, sign_x, y, NUM0 + number - 1)
        zone = empty()
        fill(zone, xs, ys, ZONE)
        zones.append((f"room-{number:02d}", zone,
                      [prop("jitsiRoom", f"{JITSI_PREFIX}{number:02d}")]))

    quiet = empty()
    fill(quiet, QUIET_XS, QUIET_YS, ZONE)
    zones.append(("quiet-corner", quiet, [prop("silent", True)]))

    return floor, walls, furniture, start, zones


def prop(name, value):
    kind = "bool" if isinstance(value, bool) else "string"
    return {"name": name, "type": kind, "value": value}


def tile_layer(layer_id, name, data, properties=None):
    layer = {"id": layer_id, "name": name, "type": "tilelayer", "data": data,
             "width": W, "height": H, "x": 0, "y": 0, "opacity": 1,
             "visible": True}
    if properties:
        layer["properties"] = properties
    return layer


def build_map(image_size):
    floor, walls, furniture, start, zones = build_layers()
    layers = [tile_layer(1, "floor", floor),
              tile_layer(2, "walls", walls),
              tile_layer(3, "furniture", furniture),
              tile_layer(4, "start", start)]
    for name, data, properties in zones:
        layers.append(tile_layer(len(layers) + 1, name, data, properties))
    layers.append({"id": len(layers) + 1, "name": "floorLayer",
                   "type": "objectgroup", "draworder": "topdown", "objects": [],
                   "x": 0, "y": 0, "opacity": 1, "visible": True})

    tileset = {
        "firstgid": 1, "name": "varcamp", "image": "tileset.png",
        "imagewidth": image_size[0], "imageheight": image_size[1],
        "tilewidth": TILE, "tileheight": TILE, "margin": 0, "spacing": 0,
        "columns": COLS, "tilecount": TILE_COUNT,
        "tiles": [{"id": i, "properties": [prop("collides", True)]}
                  for i in COLLIDING],
    }
    return {
        "type": "map", "version": "1.10", "tiledversion": "1.10.2",
        "orientation": "orthogonal", "renderorder": "right-down",
        "infinite": False, "compressionlevel": -1,
        "width": W, "height": H, "tilewidth": TILE, "tileheight": TILE,
        "nextlayerid": len(layers) + 1, "nextobjectid": 1,
        "properties": [
            prop("mapName", "Varcamp venue (draft)"),
            prop("mapDescription",
                 "Draft Barcamp venue: lobby, main stage, 12 session rooms."),
            prop("mapCopyright", "Placeholder artwork generated for Varcamp."),
        ],
        "tilesets": [tileset],
        "layers": layers,
    }


# --- self-check -------------------------------------------------------------
def check(tmj):
    by_name = {layer["name"]: layer for layer in tmj["layers"]}
    errors = []
    for layer in tmj["layers"]:
        if layer["type"] == "tilelayer" and len(layer["data"]) != W * H:
            errors.append(f"layer {layer['name']} has the wrong size")
    if tmj["layers"][-1]["name"] != "floorLayer":
        errors.append("floorLayer must be the last layer")

    blocking = {gid(i) for i in COLLIDING}
    solid = [a in blocking or b in blocking for a, b in
             zip(by_name["walls"]["data"], by_name["furniture"]["data"])]
    spawn = [i for i, g in enumerate(by_name["start"]["data"]) if g]
    if not spawn:
        errors.append("no spawn tiles")
    if any(solid[i] for i in spawn):
        errors.append("a spawn tile is blocked")

    seen = set(spawn[:1])
    queue = deque(seen)
    while queue:
        i = queue.popleft()
        x, y = i % W, i // W
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            j = ny * W + nx
            if 0 <= nx < W and 0 <= ny < H and j not in seen and not solid[j]:
                seen.add(j)
                queue.append(j)

    edge = [y * W + x for y in range(H) for x in range(W)
            if x in (0, W - 1) or y in (0, H - 1)]
    if any(not solid[i] for i in edge):
        errors.append("the outer wall has a gap")

    room_names = [n for n in by_name if n.startswith("room-")]
    if len(room_names) != 2 * ROOMS_PER_SIDE:
        errors.append(f"expected {2 * ROOMS_PER_SIDE} rooms, got {len(room_names)}")
    for name in room_names + ["quiet-corner"]:
        cells = [i for i, g in enumerate(by_name[name]["data"]) if g]
        if not cells or any(i not in seen for i in cells):
            errors.append(f"{name} is not fully reachable from the spawn")
    stage = STAGE_YS[0] * W + STAGE_XS[0]
    if stage not in seen:
        errors.append("the stage is not reachable from the spawn")
    return errors


def main():
    size = build_tileset()
    tmj = build_map(size)
    errors = check(tmj)
    if errors:
        sys.exit("map check failed:\n  " + "\n  ".join(errors))
    (OUT / "varcamp.tmj").write_text(json.dumps(tmj, separators=(",", ":")))
    print(f"ok: {W}x{H} tiles, {2 * ROOMS_PER_SIDE} rooms, "
          f"{len(tmj['layers'])} layers")


if __name__ == "__main__":
    main()
