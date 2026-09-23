# Recover Outpost assets from the supplied archive

`recover.py` reads the raw Unreal packages in `assets.zip` through the existing,
patched CUE4Parse and ZoneExporter assemblies. It uses Python.NET to call those
assemblies directly. It does not invoke a .NET build, a dev server, or FModel.

The generated files in `assets/outpost-game/` are used by the Outpost renderer:

- Original wood and tier-1 brick color textures, brick floor textures, and a
  masonry strip from the tier-3 stone atlas. Images are limited to 512 pixels.
- Brick/stone normal maps decoded from BC5. Their blue channel is reconstructed
  from X/Y, and green is inverted for the renderer's tangent-space convention.
- Six collision-hull meshes: stone tier-1 RoofC and stone tier-3 Archway,
  BalconyO, BalconyS, DoorS, QuarterWallS. Material, tier and shape must all
  match before the renderer substitutes a recovered shape.
- `provenance.json`, recording the package names, atlas crop and mesh counts.

## Run again

The existing cache at `~/.cache/penny-fn-assets/` supplies:

- `dotnet/` (.NET 10 runtime)
- `exporter/bin/Debug/net10.0/` (patched CUE4Parse and ZoneExporter DLLs)
- `mappings.usmap` (matching these packages)

The isolated Python environment used for this recovery is
`~/.cache/penny-fn-assets/python-env/`, with the dependencies in
`requirements.txt` installed from binary wheels.

From the repository root:

```sh
~/.cache/penny-fn-assets/python-env/bin/python scripts/outpost-asset-recovery/recover.py \
  --archive /home/ahmed/Downloads/assets.zip \
  --output assets/outpost-game
```

Use `--cache-root` to point at a different existing tool cache. Every cached
package is checked against the ZIP entry's size and CRC before it is reused;
missing or different files are extracted with their original paths. The full
archive has about 1.23 GB of uncompressed data, but the renderer's recovered
asset set is about 600 KB. Python and .NET tools are only needed to regenerate
those assets, not to run the launcher.

## Accuracy and remaining limits

These packages expose no conventional render-mesh LODs through the available
parser. The six imported geometries are **collision hulls, not original Nanite
render meshes**. They preserve the package's collision outlines and pivots;
they cannot reproduce its decorative geometry or original texture UVs. The
renderer projects surface UVs onto the recovered shapes. Collision DoorS is
its frame; the separate door leaf is omitted because its open/closed state
is not represented by the current layout data.

The archive's mesh/component data also provides pivot evidence:

- `PBW_BASE1_Floor`: bounds origin Y ≈ 256.06 world units.
- `PBW_BASE1_StairW`: bounds origin Y ≈ 255.12.
- `PBW_BASE1_RoofC`: bounds origin Y ≈ 256.30.
- `PBW_BASE1_Solid`: bounds origin Y ≈ 0.06.
- The supplied PBWA static-mesh root components have no serialized relative
  transform overrides. Balcony interaction boxes also occupy local Y 256–512.

At 512 world units per tile, generated floor/stair/roof models therefore need
+0.5 on local scene X before actor yaw. Recovered hulls retain their original
edge pivots and must not receive that translation again. The scene mapping is
`(Unreal X, Y, Z) → (Y, Z, -X) / 512`. Each convex hull's faces are oriented
outward after this handedness change.

No complete wood or metal render-model set, metal color texture, or tier-2
brick color texture is present. Wood uses the recovered plank surface with
procedural models; tier-2 brick reuses the tier-1 surface; metal keeps its
procedural model/material. Other zones and the 2D map retain the existing heightfield. Final
placement and lighting still need comparison against the same base in game.


## Twine terrain

Regenerate the dedicated 3D terrain with the same cache and environment:

```sh
~/.cache/penny-fn-assets/python-env/bin/python scripts/outpost-asset-recovery/recover_twine.py \
  --archive /home/ahmed/Downloads/assets.zip \
  --output assets/outpost-game/twine
```

The Twine level now supplies 3,832 rendered placements using 82 collision
models and five bounds fallbacks. StaticMesh references are resolved using
public export hashes, not actor names: renamed actors can reference completely
different meshes. Full rotations, nonuniform scales and original pivots are
preserved. Grass, volcanic rock, pebble and lava textures come from the archive.
The renderer instances repeated models and projects UVs onto the collision
surfaces. An ocean mask excludes enclosed empty regions and the recovered lava footprints
so the caldera is not flooded; its coastline classification still uses the older
tile grid. Reflections are baked into shared geometries so mirrored placements
render with correct face winding. The Whole map camera adjusts its distance, clipping and fog to fit Twine.

Ten cave-entrance placements have no usable collision geometry and are omitted
instead of closing their openings with bounds boxes. The five bounds fallbacks
are a slope and shoreline corner models. This is a collision-based reconstruction,
not the original render mesh or Unreal terrain shader. Decorative details,
vegetation, original UVs and cave-entrance geometry remain incomplete.


## Sky and foliage (CC0, not from the game archive)

The game packages expose no render meshes for foliage either, so the 3D
explorer's sky and vegetation come from public-domain packs instead:

- **Sky** — Poly Haven's "Kloofendal 48d Partly Cloudy (Pure Sky)" HDRI.
  `prepare_sky.py` (numpy + Pillow) writes the upper-hemisphere backdrop
  (`sky.jpg`, radiance divided by `skyScale`), a 512×256 flat-RGBE lighting map
  (`sky-env.hdr`) and `sky.json` with the sun direction and horizon radiance the
  renderer uses for the directional light and fog.

  ```sh
  curl -o sky4k.hdr https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloofendal_48d_partly_cloudy_puresky_4k.hdr
  python prepare_sky.py sky4k.hdr ../../assets/outpost-game/sky
  ```

- **Foliage** — Quaternius' Stylized Nature MegaKit, fetched per model from
  its Poly Pizza bundle (each model's `.glb` sits at
  `https://static.poly.pizza/<preview-id>.glb`; a browser user agent is
  required). `prepare_nature.mjs` merges the 24 used models into
  `nature/nature.glb` (one scene per model), bleeds cut-out colours so distant
  mipmaps do not darken canopies, simplifies trunks/rocks/grass and applies
  WebP + meshopt compression.

Licences are recorded next to the assets in `LICENSE.md`.


## Stonewood, Plankerton and Canny Valley

`recover_zone.py` generalises the Twine recovery to any outpost map and also
writes the zone layout JSON (floors, cliffs, shore, lava, props, spawn, sea
level), so the C# ZoneExporter no longer has to be rebuilt. It reads the
42.20 archive (`outposts-stonewood-plankerton-canny-20260923.zip`, unpacked to
`~/.cache/penny-fn-assets-42/assets`, with that build's `mappings.usmap` from
uedb.dev and the `dotnet`/`exporter`/`python-env` folders symlinked from
`~/.cache/penny-fn-assets`).

```sh
~/.cache/penny-fn-assets/python-env/bin/python scripts/outpost-asset-recovery/recover_zone.py \
  --cache-root ~/.cache/penny-fn-assets-42 --map Zone_Outpost_Stonewood --zone-id pve_01 \
  --terrain-out assets/outpost-game/zones/pve_01 \
  --zone-out src/config/constants/outpost-zones/pve_01.json
# Plankerton: --map Zone_Outpost_Plankerton_AD --zone-id pve_02
# Canny Valley: --map Zone_Outpost_CannyValley --zone-id pve_03
```

Loose packages lose their resolved import table, so placed meshes are matched
by public export hash against the export headers of every mesh-bearing
package. Water/stream pieces render with the sea material, world build
pieces and street props as neutral structures, and invisible helper volumes
are dropped. Surface textures per zone are listed in `ZONE_TEXTURES`; some
(`T_Grasslands_D`, `T_Cave_Exterior_Wall_D`) only ship a 64 px inline mip.

Render meshes are still unavailable: every `UStaticMesh` in this archive
deserialises with an empty LOD array (including non-Nanite props such as the
Storm Shield core, whose `.ubulk` payload is present), which points at a
CUE4Parse offset issue for this build rather than missing data.


## Real render meshes (`ue_mesh.py`)

CUE4Parse reads zero LODs from this build's loose `UStaticMesh` exports (its
LOD header read drifts by a few bytes), but the buffers use the long-stable
layout. `ue_mesh.py` anchors on the position buffer (stride 12, count, bulk
element size 12, count) and reads positions → tangents/UVs → colours →
indices directly; the section array is found by matching triangle totals.
The `.uasset` inlines only small LODs; `.ubulk` holds the streamed LOD0/LOD1.
About 2,900 of 3,000 meshes in the 42.20 archive decode this way, including
every terrain model the four outposts place.

- `extract_render_meshes.py` — per-zone terrain GLBs (`zones/<id>/terrain-meshes.glb`,
  `twine/terrain-meshes.glb`); the renderer prefers them over collision hulls.
- `extract_build_pieces.py` — every wood/brick/metal piece at tiers 1–3
  (LOD1) with UVs and the Diffuse/NormalMap textures of each section's
  material instance, resolved by public export hash (`builds/builds.glb`).
- `extract_outpost_models.py` — the Storm Shield device and amplifier
  (`outpost/outpost.glb`). `recover_zone.py` records where each map places
  them (`stormShield`, `amplifiers` in the zone JSON).
- `compress_glb.mjs` — meshopt geometry + WebP textures for all of the above.

```sh
PY=~/.cache/penny-fn-assets/python-env/bin/python   # needs numpy too
$PY extract_render_meshes.py --terrain ../../assets/outpost-game/zones/pve_01/terrain.json \
  --cache-root ~/.cache/penny-fn-assets-42 --cache-root ~/.cache/penny-fn-assets --output /tmp/pve_01.glb
$PY extract_build_pieces.py --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/builds.glb
$PY extract_outpost_models.py --cache-root ~/.cache/penny-fn-assets-42 --output /tmp/outpost.glb
node compress_glb.mjs /tmp/builds.glb ../../assets/outpost-game/builds/builds.glb
```


## Traps and distant scenery

- `extract_trap_models.py` — the STW trap models keyed by the display names
  the save parser produces (`traps/traps.glb`, parts as `<name>#<n>`). Floor
  and ceiling traps pivot on the tile edge and wall traps on the wall plane,
  so they share the build-piece instance transform. Section materials are
  resolved from each slot's `MaterialInterface` import (by export hash) before
  falling back to the slot name.
- `extract_backdrops.py` — the skybox sublevels the zones stream in
  (Stonewood: `Skybox_Outpost` + `Skybox_Outpost_HomeBase`; Plankerton and
  Twine: `Skybox_Outpost`; Canny Valley: `Zone_Outpost_CannyValley_Skybox`),
  written as `backdrops/<map>.glb` + placements of scene-space world matrices
  with attached components composed through their parent chain. The storm
  ground's `M_Outpost_Terrain` is procedural (no colour map); the renderer
  gives such untextured scenery a dark storm tone.

`pakchunk30optional-WindowsClient` (the optional archive supplied on
2026-09-24) holds only Battle Royale optional mips. The STW textures that ship
as 64 px inline mips here (`T_Metal_L1*`, `T_Grasslands_*`,
`T_Cave_Exterior_Wall_*`) need the optional chunk that owns their packages.


## Material response and tier-1 metal

Section materials now also carry their `SpecularMasks` texture, converted to
glTF metallic-roughness (Fortnite: R specular, G metallic, B roughness →
glTF: G roughness, B metallic). Without it tier-2/3 metal rendered as flat,
rough grey; with it they read as glossy riveted steel and worn painted plate.

`T_Metal_L1` (and its normal/spec/mask) only exist as 64 px inline mips in
every archive supplied, including FModel/CUE4Parse-Conversion PNG exports.
`rebuild_metal_l1.py` reconstructs a 512 px version from the meshes' UV
islands (one per scrap sheet) filled from the upscaled original, with grain
and worn borders; `T_Metal_L1_rebuilt.png` is passed to the exporter with
`--override T_Metal_L1=T_Metal_L1_rebuilt.png`. It is a reconstruction, not
recovered game data — replace it if the real high-res payload turns up.


## Blueprint-accurate builds and traps (`extract_blueprint_models.py`)

`builds/builds.glb` and `traps/traps.glb` are now produced from the actor
blueprints rather than by guessing mesh names: every `PBWA_<W|S|M><tier>_<Shape>`
and `Trap_<Name>` blueprint's mesh components are resolved (export hashes)
with their relative transforms composed, so multi-part traps (anti-air base +
turret + head) are whole and at game scale, and every build blueprint gets its
exact mesh even where mesh and blueprint names differ
(`ArchwayLargeSupport` → `PBW_W1_ArchwaySupportLarge`). Tier spellings are
aliased (`HalfWall`/`HalfWallS`, `WindowC`/`WindowsC`, `Floor`/`Floor_2` …).
Trap seating: centre-pivoted floor traps move to the tile centre, and ceiling
traps drop so their top sits at −0.028 tiles, just under a slab (−0.025), so
they never show through the floor or roof above.

`extract_build_pieces.py` / `extract_trap_models.py` remain as the name-based
first pass and the home of the shared exporter.


## Real zone foliage (`extract_zone_scenery.py`)

Trees, rocks, shrubs and plants now come from each map itself: foliage actors
only store a transform, and their mesh is resolved through the component's
template (`Default__<Blueprint>_C:StaticMeshComponent0`) to the actor
blueprint's own mesh component. Output: `zones/<id>/scenery.glb|json` and
`twine/scenery.*` (the 42.20 cache resolves Twine's blueprints poorly, so Twine
uses the original cache). Foliage specifics handled by the exporter:
trunk sections use `Trunk_BaseColor`/`Trunk_Normal`; leaf cut-outs come from
`MaskTexture` (most varied channel → alpha, colour bled for mipmaps); leaf
colour comes from the `Color1_Base`/`Color2_Lit` vector params multiplied over
the greyscale atlas; impostor cards and unassigned slots are dropped.
Plankerton's grass is `T_Grasslands_AD_D` (autumn). Only Twine gets open sea;
the other outposts float above their backdrop ground as in-game.
