using System.Text.Json;
using CUE4Parse.FileProvider;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.StaticMesh;
using CUE4Parse.UE4.Assets.Objects;
using CUE4Parse.UE4.Objects.Core.Math;
using CUE4Parse.UE4.Versions;
using ZoneExporter;

var assetsDir = args[0];
var usmapPath = args[1];
var zoneName = args.Length > 2 ? args[2] : "TwinePeaks";
var zoneId = args.Length > 3 ? args[3] : "pve_04";
var outPath = args.Length > 4 ? args[4] : "/tmp/zone.json";
const float Cell = 512f;

var provider = new DefaultFileProvider(assetsDir, SearchOption.AllDirectories, new VersionContainer(EGame.GAME_UE5_6));
provider.MappingsContainer = new FileUsmapTypeMappingsProvider(usmapPath);
provider.Initialize();
provider.GlobalData = GlobalDataBuilder.Build(provider.MappingsContainer.MappingsForGame!.Types.Keys);

var assetByName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
foreach (var key in provider.Files.Keys)
    if (key.EndsWith(".uasset")) assetByName.TryAdd(Path.GetFileNameWithoutExtension(key), key);
var namesByLength = assetByName.Keys.OrderByDescending(n => n.Length).ToArray();

/* Mesh bounds cache: ExtendedBounds is a property, so it reads cleanly. */
var boundsCache = new Dictionary<string, (FVector Origin, FVector Extent)?>(StringComparer.OrdinalIgnoreCase);
(FVector Origin, FVector Extent)? BoundsOf(string mesh)
{
    if (boundsCache.TryGetValue(mesh, out var cached)) return cached;
    (FVector, FVector)? result = null;
    try
    {
        var sm = provider.LoadPackage(assetByName[mesh]).GetExports().OfType<UStaticMesh>().FirstOrDefault();
        var b = sm?.GetOrDefault<FStructFallback?>("ExtendedBounds", null);
        if (b != null)
            result = (b.GetOrDefault("Origin", new FVector(0, 0, 0)), b.GetOrDefault("BoxExtent", new FVector(0, 0, 0)));
    }
    catch { }
    boundsCache[mesh] = result;
    return result;
}

static double R(double v, int d = 3) => Math.Round(v, d);

var floors = new List<double[]>();
var rocks = new List<double[]>();
var shore = new List<double[]>();
var lava = new List<double[]>();
var props = new List<double[]>();
double[]? spawn = null;
var unresolved = 0;

var pkg = provider.LoadPackage(provider.Files.Keys.First(k => k.Contains($"Zone_Outpost_{zoneName}")));

for (var i = 0; i < pkg.ExportMapLength; i++)
{
    UObject? component;
    try { component = pkg.ExportsLazy[i].Value; } catch { continue; }
    if (component is null) continue;

    var cls = component.Class?.Name.Text;
    var actorName = component.Outer?.Name.Text ?? component.Name;

    if (cls == "SceneComponent" && actorName.StartsWith("PlayerSpawnPlacementActor") && spawn is null)
    {
        var p = component.GetOrDefault("RelativeLocation", new FVector(0, 0, 0));
        spawn = [R(p.X / Cell), R(p.Y / Cell), R(p.Z / Cell)];
        continue;
    }

    if (cls is not ("FortStaticMeshComponent" or "StaticMeshComponent" or "BaseBuildingStaticMeshComponent")) continue;

    var mesh = namesByLength.FirstOrDefault(n => actorName.StartsWith(n, StringComparison.OrdinalIgnoreCase));

    if (mesh is null)
    {
        /*
         * Blueprint actors (trees, rocks, chests) have no matching mesh
         * asset — their geometry lives inside the blueprint. They still get
         * placed as scenery, classified from the actor's own name.
         */
        unresolved++;

        var bpName = System.Text.RegularExpressions.Regex.Replace(actorName, @"[_\d]+$", "");
        if (!System.Text.RegularExpressions.Regex.IsMatch(bpName, @"Tree|Palm|Rock|Plant|Shrub|Log|Vein|Chest|Cactus|Foliage", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            continue;

        var bpLoc = component.GetOrDefault("RelativeLocation", new FVector(0, 0, 0));
        var bpRot = component.GetOrDefault("RelativeRotation", new FRotator(0, 0, 0));
        var bpScale = component.GetOrDefault("RelativeScale3D", new FVector(1, 1, 1));
        var bpKind = System.Text.RegularExpressions.Regex.IsMatch(bpName, "Palm|Cactus|Tree(?!_?Log)", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 0
            : System.Text.RegularExpressions.Regex.IsMatch(bpName, "Rock|Vein", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 1
            : System.Text.RegularExpressions.Regex.IsMatch(bpName, "Plant|Shrub|Foliage", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 2 : 4;

        props.Add([R(bpLoc.X / Cell), R(bpLoc.Y / Cell), R(bpLoc.Z / Cell), bpKind, R(bpRot.Yaw, 1), R(bpScale.X, 2)]);
        continue;
    }

    var loc = component.GetOrDefault("RelativeLocation", new FVector(0, 0, 0));
    var rot = component.GetOrDefault("RelativeRotation", new FRotator(0, 0, 0));
    var scale = component.GetOrDefault("RelativeScale3D", new FVector(1, 1, 1));

    var isProp = System.Text.RegularExpressions.Regex.IsMatch(mesh, @"Palm|Tree|Rock|Plant|Shrub|Log|Vein|Chest", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

    if (isProp)
    {
        var kind = System.Text.RegularExpressions.Regex.IsMatch(mesh, "Palm|Tree(?!_Log)", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 0
            : System.Text.RegularExpressions.Regex.IsMatch(mesh, "Rock|Vein", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 1
            : System.Text.RegularExpressions.Regex.IsMatch(mesh, "Plant|Shrub", System.Text.RegularExpressions.RegexOptions.IgnoreCase) ? 2 : 4;
        props.Add([R(loc.X / Cell), R(loc.Y / Cell), R(loc.Z / Cell), kind, R(rot.Yaw, 1), R(scale.X, 2)]);
        continue;
    }

    /*
     * Footprint and top height from the mesh's own bounds, turned by the
     * actor's yaw: a quarter turn swaps the X/Y half-extents and rotates
     * the bounds' centre offset. Multi-cell pieces (cave ramps span three
     * cells) therefore cover the cells they really occupy.
     */
    var b = BoundsOf(mesh);
    double halfX = 0.5, halfY = 0.5, offX = 0, offY = 0, top = 0;

    if (b is { } bb)
    {
        var quarter = ((int) Math.Round(rot.Yaw / 90f) % 4 + 4) % 4;
        double ox = bb.Origin.X / Cell * scale.X, oy = bb.Origin.Y / Cell * scale.Y;
        double ex = Math.Abs(bb.Extent.X / Cell * scale.X), ey = Math.Abs(bb.Extent.Y / Cell * scale.Y);
        (offX, offY) = quarter switch
        {
            0 => (ox, oy),
            1 => (-oy, ox),
            2 => (-ox, -oy),
            _ => (oy, -ox),
        };
        (halfX, halfY) = quarter % 2 == 0 ? (ex, ey) : (ey, ex);
        top = (bb.Origin.Z + bb.Extent.Z) / Cell * scale.Z;
    }

    double[] entry = [R(loc.X / Cell + offX), R(loc.Y / Cell + offY), R(loc.Z / Cell + top), R(halfX), R(halfY)];

    if (System.Text.RegularExpressions.Regex.IsMatch(mesh, @"^S_Elevation_Ground|^S_Cave_Ramp2?_(Floor|Ground)|^S_GeoSlope"))
        floors.Add(entry);
    else if (System.Text.RegularExpressions.Regex.IsMatch(mesh, @"^S_Shoreline"))
        shore.Add(entry);
    else if (System.Text.RegularExpressions.Regex.IsMatch(mesh, @"Volcano_Lava|LavaFalls|Lava_Plane|LavaFissure|Lava_\dx\d|Fissure"))
        lava.Add(entry);
    else if (System.Text.RegularExpressions.Regex.IsMatch(mesh, @"^S_Cliff|^S_Cave_|^S_Elevation|Lava_Wall_Accents"))
        rocks.Add(entry);
    else
        props.Add([R(loc.X / Cell), R(loc.Y / Cell), R(loc.Z / Cell), 4, R(rot.Yaw, 1), R(scale.X, 2)]);
}

var all = floors.Concat(rocks).Concat(shore).ToList();
var bounds = new
{
    minX = (int) Math.Floor(all.Min(p => p[0] - p[3])),
    maxX = (int) Math.Ceiling(all.Max(p => p[0] + p[3])),
    minY = (int) Math.Floor(all.Min(p => p[1] - p[4])),
    maxY = (int) Math.Ceiling(all.Max(p => p[1] + p[4])),
};
var waterZ = R(shore.Count > 0 ? shore.Min(p => p[2]) : floors.Min(p => p[2]));

var result = new
{
    bounds,
    cell = (int) Cell,
    floors,
    lava,
    props,
    rocks,
    shore,
    source = $"Zone_Outpost_{zoneName}.umap",
    spawn,
    waterZ,
    zoneId,
};
File.WriteAllText(outPath, JsonSerializer.Serialize(result));
Console.WriteLine($"### {outPath}: floors={floors.Count} rocks={rocks.Count} shore={shore.Count} lava={lava.Count} props={props.Count} unresolved={unresolved}");
Console.WriteLine($"### bounds x {bounds.minX}..{bounds.maxX} y {bounds.minY}..{bounds.maxY} waterZ={waterZ} size={new FileInfo(outPath).Length / 1024}KB");
