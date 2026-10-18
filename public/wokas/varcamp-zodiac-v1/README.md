# VarCamp Zodiac Wokas

24 original full-character skins: male and female Aries, Taurus, Gemini,
Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius and Pisces.
Every PNG is native96×128 RGBA: a3×4 grid of32px frames, with rows
DOWN, LEFT, RIGHT, UP. Each row has the two walking strides around the middle
idle frame. The native walking playback is0,1,2,1 at10fps; repeat per row.

These are complete `woka` textures. They must not be registered as a `body`
customization layer with unrelated eyes, hair or clothes drawn over them.
`manifest.json` pins the24 actual PNG bodies. `collection.template.json` has
no hosting URL and is deliberately not a live server catalog.

## Sponsored WorkAdventure migration

Provide all24PNGs, `manifest.json`, `collection.template.json` and this README
to the WorkAdventure world administrator/team. Ask them to enable the supported
custom full-character Woka collection for the sponsored world and provide the
actual destination catalog/hosting procedure. The SaaS custom upload feature
requires account enablement. This package cannot enable it by itself.

The official artwork guide is
https://docs.workadventu.re/admin/custom-wokas/ . Its native format is shared
with these assets; its customization-layer UI must not be assumed to support a
whole-character collection without confirmation from the WorkAdventure team.

After hosting the exact24PNG bodies over HTTPS, bind the actual base directory
and append the collection using the source tool `tools/wokas/bind_collection.py`.
The tool verifies the image bodies and fails on missing assets or duplicate IDs.
Its result is a new catalog file. It never uploads, changes a running service or
claims that the characters are available live.

## Devbox integration and acceptance

First identify the actual active Woka service. The inspected upstream source
chooses the admin service when the capabilities returned by `adminApi.initialise()`
contain `api/woka/list: v1`; otherwise it uses LocalWokaService. The public
capability endpoint is a separate source and does not establish this choice.
With `ADMIN_API_URL` unset, initialization returns an empty capability object
and the local service is selected. It caches that choice. The local service reads
`play/src/pusher/data/woka.json`; an admin-service deployment needs integration
through its actual supported catalog instead. Do not edit an inactive catalog.
Use persistent source/configuration and rebuild/redeploy through the normal
release route. An ephemeral container file copy is not a persistent release.

Preserve every existing collection and ID. For an actual local source catalog:

    python3 tools/wokas/bind_collection.py \
      --catalog /actual/current/woka.json \
      --asset-base-url https://ACTUAL-HOST/actual/wokas/varcamp-zodiac-v1/ \
      --output /new/reviewed/woka-with-varcamp-zodiac.json

The literal example hostname is not a deployment URL. Binding requires the
actual measured destination. Review the new catalog, deploy through the active
service's persistent configuration, then verify `/woka/list` returns all24IDs
for an ordinary attendee. Select every skin, enter the map and check all four
directions and idle. Verify an old default skin still selects. A source test or
PNG download is not evidence of live character selection.

## Original art and source lineage

Original master art was generated with the built-in imagegen tool for VarCamp.
The source repository retains all12 unchanged masters, prompts, exact source
hashes,288 source-isolation masks, native export recipe and the six-pose Leo
female separation repair. Cancer male third LEFT/RIGHT poses use the correct
original source ordering. The original Leo and Capricorn male masters each
lacked a third LEFT pose: both candidate source poses faced RIGHT. Two targeted
built-in imagegen repairs supply only those missing LEFT strides, with their
exact masters, prompts, source hashes and scale anchors retained separately.
All other286 native frame RGBA bodies remain byte exact to the original package.
No walk pose was replaced with a duplicated idle or silently mirrored.

Artwork may be used and modified for the VarCamp venue and migration package.
Original generated art is released under the repository's MIT license. The
WorkAdventure software remains under its own upstream license; its source is
not included in this artwork bundle.
