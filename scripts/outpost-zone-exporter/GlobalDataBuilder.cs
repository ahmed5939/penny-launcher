using System.Text;
using CUE4Parse.UE4.IO;
using CUE4Parse.UE4.IO.Objects;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.Utils;

namespace ZoneExporter;

/// <summary>
/// Loose Zen packages reference their classes as script imports — 64-bit
/// hashes of paths like "/Script/Engine.StaticMesh" — which normally resolve
/// against global.utoc. Exports from FModel do not include that container, so
/// this rebuilds the lookup by hashing candidate paths (every type name in
/// the mappings against the modules Fortnite actually ships) and keeping the
/// ones the packages ask for.
/// </summary>
public static class GlobalDataBuilder
{
    public static readonly string[] Modules =
    [
        "CoreUObject", "Engine", "FortniteGame", "Landscape", "Niagara",
        "GameplayTags", "GameplayAbilities", "AIModule", "NavigationSystem",
        "PhysicsCore", "AudioMixer", "MovieScene", "LevelSequence", "Chaos",
        "GeometryCollectionEngine", "InteractiveToolsFramework", "Water",
        "FortniteUI", "SlateCore", "UMG", "CinematicCamera", "AnimGraphRuntime",
        "ClothingSystemRuntimeNv", "SkeletalMeshDescription",
    ];

    /// <summary>
    /// UE's FPackageObjectIndex::FromScriptPath — CityHash64 over the
    /// lowercased path as UTF-16, with the top two bits reserved for the type.
    /// </summary>
    public static FPackageObjectIndex ScriptIndex(string path)
    {
        /* UE flattens the outer separators to '/' and lowercases the rest. */
        var normalized = new char[path.Length];

        for (var i = 0; i < path.Length; i++)
        {
            var c = path[i];
            normalized[i] = c is '.' or ':' ? '/' : FPackageId.ToLower(c);
        }

        var hash = CityHash.CityHash64(Encoding.Unicode.GetBytes(normalized));
        hash &= ~(3ul << 62);
        return new FPackageObjectIndex((1ul << 62) | hash);
    }

    public static IoGlobalData Build(IEnumerable<string> typeNames)
    {
        var names = new List<FNameEntrySerialized>();
        var entries = new Dictionary<FPackageObjectIndex, FScriptObjectEntry>();

        void Add(string path, string leafName)
        {
            var index = ScriptIndex(path);
            if (entries.ContainsKey(index)) return;

            var nameIndex = (uint) names.Count;
            names.Add(new FNameEntrySerialized(leafName));
            entries[index] = new FScriptObjectEntry(
                new FMappedName(nameIndex, 0, FMappedName.EType.Global),
                index,
                FPackageObjectIndex.InvalidObjectIndex,
                FPackageObjectIndex.InvalidObjectIndex);
        }

        foreach (var module in Modules)
        {
            Add($"/Script/{module}", module);

            foreach (var type in typeNames)
            {
                Add($"/Script/{module}.{type}", type);
                /* Class default objects are addressed as Default__<Class>. */
                Add($"/Script/{module}.Default__{type}", $"Default__{type}");
            }
        }

        return new IoGlobalData([.. names], entries);
    }
}
