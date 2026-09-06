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
