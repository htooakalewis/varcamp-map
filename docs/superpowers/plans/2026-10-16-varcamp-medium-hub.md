# Medium VarCamp Plaza Implementation Plan

> **For agentic workers:** Execute inline with the existing test-driven and verification workflow. User has already selected autonomous implementation.

**Goal:** A medium 96×96 circular hub with recognizable speaker buildings and bold English room names.

**Architecture:** Recompose only the authored hub and its catalog dimensions. Add original native building/nameplate atlases used only by that hub, preserving every other map's source and exported bytes. Use the existing builder, guarded author export, normal preview build and native Tiled renderer.

**Tech Stack:** TypeScript, JSON MapLayout, original integer SVG pixel art, sharp, Vitest, native Tiled.

**Spec:** `docs/superpowers/specs/2026-10-16-varcamp-medium-hub-addendum.md`.

## Global Constraints

- Hub96×96; twelve speaker doors≤65 collision steps; six primary choices≤36.
- Preserve all32 other layouts/terrain/art/quest geometry and native/preview exports.
- Native-size props; no generic scale transform; keep clearly visible south front doors and short ring approaches and legacy aliases.
- Original raster nameplates guarantee bold; no installed-font dependency.
- Preserve native-author guard; no UI/deployment/release/cache tooling edits.

## Review Focus

- Speaker roof/eave/wall depth and windows must read as buildings in native close-ups.
- Door masks and canopy art must leave visible, clear approach cells for all twelve fixed-camera facades.
- Every welcome cell, sponsor image and directory area must remain clear and legible.
- Nameplate pixels must encode the exact English room phrase, independent of TextUtils bold behavior.
- New atlas references must not alter the other32 maps' output hashes.

### Task1: Pin acceptance before editing

- [x] Read pinned TextUtils and hub source; record geometry/text root cause.
- [x] Snapshot all128 nonhub layout/native/preview files and confirm zero native-manifest mismatches.
- [x] Add/run failing96², authored-building and raster-label tests against real buildMap.

### Task2: Compose the expanded hub and native art

- [x] Add deterministic original block-glyph nameplate SVG/PNG + copy manifest, and one fixed-camera warm-wall roofed building sprite with native masks.
- [x] Extend art export/check manifest and catalog with new hub-only sources.
- [x] Hand-compose circular road, central reception, six gates, twelve buildings, landscape and safe return entries at96²; update catalog.
- [x] Update old compact hub expectations to the new approved geometry and run focused checks.

### Task3: Verify source/export preservation and native appearance

- [ ] Run guarded source author export without initialize; normal map build must preserve sources.
- [x] Compare every other32 layout/native/preview hash against snapshot.
- [x] Render native hub and inspect full map, twelve fixed-camera façades and bold lettering.
- [ ] Run focused/full appropriate tests and art/type checks; report exact coordinates/distances/art choices.

Source QA is complete. Guarded global author + normal build + final full suite remain root-owned integration work while the coastal source agent completes its three maps. The snapshot confirms all32 nonhub native pairs and previews unchanged; only the three explicitly authorized coast layout sources differ.
