# Native editor object catalogs

The deployed WorkAdventure frontend already hosts Furniture and Office catalogs, but the authored WAMs previously registered no collections. Its separate optional Custom catalog request returned 404. With no Default collections available, the native object picker had no objects. The 404 is a missing optional resource, not a CORS failure; it is recorded and remains unsuppressed.

`world/editor-collections.json` registers these existing frontend resources:

- `https://varcamp.3-1-133-135.sslip.io/collections/FurnitureCollection.json`
- `https://varcamp.3-1-133-135.sslip.io/collections/OfficeCollection.json`

Both use native `type: "file"` descriptors. Their 75 furniture and 35 office prefab variants provide 110 records, grouped into 35 named choices with native color/direction variants. Catalogs and images remain on the existing frontend host; no copied asset pack or core patch is required. The pinned frontend is WorkAdventure commit `96d43a841766b22418c061744e7ed2aafd9870d3`. A future frontend image/core or origin change must revalidate both URLs, catalog schemas/migration and every relative image dependency before updating these defaults.

In the native entity editor, select/place a prefab and edit the instance's name, description and searchable setting. The pinned panel offers `openWebsite`, `playAudio` and `openFile` actions. These belong to placed WAM entity instance properties, not prefab catalog records. Original prefab collision grids and depth offsets remain authoritative. This registration does not make Tiled floors/walls into editable entity objects or add new meeting controls.

## Source and live data are separate

The map builder uses the shared policy for newly generated WAM defaults. Historical source tests prove the 33 authored WAMs changed only their collection array, and separately preserve the original receipts. Those checks do not establish that a live editor has loaded, placed or persisted an object.

Use the explicit `ops/editor_catalogs.py` prepare/apply migration for live registration, rather than uploading generated WAMs over organizer data. Prepare retains the complete live ZIP baseline, a rebuilt package and a versioned intent. It appends only missing required descriptors to the 33 reviewed WAMs. Existing custom collections, their order and unknown fields remain; entities, areas, mapUrl, settings and every byte outside the insertion remain unchanged. An existing required URL with a conflicting type refuses. Repeating an already complete registration changes nothing.

Review the prepared changes and package before apply. Keep the editor quiet throughout preparation, review, apply and readbacks. Apply requires `--quiet-editor-window`, reconstructs the package from the retained baseline and current policy, then checks two complete live inventories 16 seconds apart before upload and two complete readbacks 16 seconds apart afterward. This is not atomic compare-and-swap: an editor write after the last preflight read can still race the upload. If the baseline or readback differs, retain evidence and reconcile fresh live data; never replay a stale WAM package.

## Acceptance

Offline tests cover registration, byte preservation, native prefab schemas/migration, actions and the loader's fulfilled-Default/rejected-Custom behavior. Live acceptance separately requires the normal object picker to list both catalogs, representative furniture/plant placement, native property/action editing, persisted reload, representative collision/depth movement, and removal of only QA-created entities with all user data preserved. Source test success or a successful ZIP upload alone does not establish those outcomes. Do not create or overwrite a Custom catalog merely to hide its independent 404.
