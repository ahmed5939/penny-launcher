# Outpost zone exporter

Extracts a Storm Shield zone's terrain layout from Fortnite's cooked level
packages into the JSON the outpost 3D explorer renders
(`src/config/constants/outpost-zones/<zoneId>.json`).

Only coordinates, footprints and class names are written out — no meshes,
textures or other game content is copied into this repository.

## What you need

1. **Zone assets**, exported from your own Fortnite install with FModel
   ("Save folder's packages") for at least:
   - `STW_Zones/Content/Maps/Zones/Outpost/Zone_Outpost_<Zone>.umap`
   - `FortniteGame/Content/Packages/DS_Fortnite_Terrain_NoLOD/**`
   - `FortniteGame/Content/Environments/Sets/Vulcano/**` (Twine Peaks lava)
2. **Type mappings** (`.usmap`) matching that build, e.g. from
   `https://uedb.dev/svc/api/v1/fortnite/mappings`.
3. The .NET SDK and a clone of [CUE4Parse](https://github.com/FabianFG/CUE4Parse)
   next to this folder, with the patches below.

## CUE4Parse patches

FModel writes loose `.uasset` files that keep the IoStore (Zen) layout, but
CUE4Parse only takes the Zen path for files inside a `.utoc`, and Zen packages
resolve their classes against `global.utoc`, which loose exports do not include.
Four small changes make loose zone packages readable:

1. `FileProvider/AbstractFileProvider.cs` — in `LoadPackage`, detect a
   non-legacy magic (`FPackageFileSummary.PACKAGE_FILE_TAG`) and construct an
   `IoPackage` instead of a legacy `Package`.
2. `FileProvider/Vfs/AbstractVfsFileProvider.cs` — make `GlobalData` settable
   so a synthesized table can be supplied.
3. `UE4/IO/IoGlobalData.cs`, `UE4/IO/Objects/FScriptObjectEntry.cs`,
   `UE4/IO/Objects/FMappedName.cs` — add public constructors so that table can
   be built (see `GlobalDataBuilder.cs`, which rebuilds the script-import
   hashes UE generates with `CityHash64` over the lowercased path).
4. `UE4/Assets/Exports/StaticMesh/FStaticMeshRenderData.cs` — wrap the Nanite
   and ray-tracing payload reads in `try/catch`. They sit after the LOD
   buffers and are not needed here.

## Run

```
dotnet run -- <assetsDir> <mappings.usmap> TwinePeaks pve_04 \
  ../../src/config/constants/outpost-zones/pve_04.json
```

Zone ids: `pve_01` Stonewood, `pve_02` Plankerton, `pve_03` Canny Valley,
`pve_04` Twine Peaks.

## Known limitation

Fortnite's terrain meshes are Nanite-only (the package is literally named
`DS_Fortnite_Terrain_NoLOD`), and their geometry does not survive as classic
LOD buffers in loose exports. The exporter therefore uses each mesh's
`ExtendedBounds` property — which does parse — to record the exact footprint
and top height of every placed tile, and the explorer builds a heightfield
from those. Rendering the true Nanite silhouettes would need the mesh geometry
exported separately (FModel can save models as glTF).
