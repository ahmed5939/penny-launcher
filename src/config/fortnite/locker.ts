/**
 * The Battle Royale locker, described once.
 *
 * Epic models a locker as a set of *loadout schemas* (Character, Emotes,
 * Wraps, …), each holding *slots* keyed by a `CosmeticLoadoutSlotTemplate`
 * id. This module is the one place those ids live: the main process needs
 * them to read and write the EOS locker, and the renderer needs the same
 * grouping to draw the slot board, so neither owns them.
 *
 * Everything here is data. It is imported by the main process, so it must
 * stay free of Electron and of the renderer's asset blobs.
 */

export type LockerSlotKey = keyof typeof slotTemplates

/**
 * Slot key → the `slotTemplate` Epic keys the slot by inside a loadout.
 *
 * The key is ours; the value is Epic's. Anything not in here is a slot we
 * deliberately do not surface, and reading one back off the API drops it.
 */
export const slotTemplates = {
  // Character schema
  character: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Character',
  backpack: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Backpack',
  pickaxe: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Pickaxe',
  glider: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Glider',
  contrail: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Contrails',
  shoes: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Shoes',
  aura: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Aura',

  // Emotes schema
  emote0: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_0',
  emote1: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_1',
  emote2: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_2',
  emote3: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_3',
  emote4: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_4',
  emote5: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_5',
  emote6: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_6',
  emote7: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Emote_7',

  // Wraps schema
  wrap0: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_0',
  wrap1: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_1',
  wrap2: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_2',
  wrap3: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_3',
  wrap4: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_4',
  wrap5: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_5',
  wrap6: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Wrap_6',

  // Platform schema
  bannerIcon: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Banner_Icon',
  bannerColor: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Banner_Color',
  musicpack: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_LobbyMusic',
  loadingscreen: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_LoadingScreen',

  // Sparks schema (instruments)
  guitar: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Guitar',
  bass: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Bass',
  drum: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Drum',
  keyboard: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Keyboard',
  microphone: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Microphone',

  // JamTracks schema
  jamSong0: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong0',
  jamSong1: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong1',
  jamSong2: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong2',
  jamSong3: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong3',
  jamSong4: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong4',
  jamSong5: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong5',
  jamSong6: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong6',
  jamSong7: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_JamSong7',

  // Vehicle schema (sports car)
  vehicleBody: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Body',
  vehicleSkin: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Skin',
  vehicleWheel: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Wheel',
  vehicleDriftSmoke:
    'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_DriftSmoke',
  vehicleBooster: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Booster',

  // Vehicle schema (SUV)
  suvBody: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Body_SUV',
  suvSkin: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Skin_SUV',
  suvWheel: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Wheel_SUV',
  suvDriftSmoke:
    'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_DriftSmoke_SUV',
  suvBooster: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_Vehicle_Booster_SUV',

  // Mimosa schema (companion)
  mimosaMain: 'CosmeticLoadoutSlotTemplate:LoadoutSlot_MimosaMain',
} as const

/** Epic's `slotTemplate` back to our slot key. */
export const slotKeysByTemplate = Object.fromEntries(
  Object.entries(slotTemplates).map(([key, template]) => [template, key])
) as Record<string, LockerSlotKey>

/**
 * Which schema a slot belongs to.
 *
 * Only consulted when a slot is missing from the account's current loadout —
 * equipping a shoe on an account that has never worn one, say. The normal
 * path rebuilds the payload out of what Epic just returned, so it never has
 * to guess.
 */
export const schemaBySlot: Record<LockerSlotKey, string> = {
  character: 'CosmeticLoadout:LoadoutSchema_Character',
  backpack: 'CosmeticLoadout:LoadoutSchema_Character',
  pickaxe: 'CosmeticLoadout:LoadoutSchema_Character',
  glider: 'CosmeticLoadout:LoadoutSchema_Character',
  contrail: 'CosmeticLoadout:LoadoutSchema_Character',
  shoes: 'CosmeticLoadout:LoadoutSchema_Character',
  aura: 'CosmeticLoadout:LoadoutSchema_Character',

  emote0: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote1: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote2: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote3: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote4: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote5: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote6: 'CosmeticLoadout:LoadoutSchema_Emotes',
  emote7: 'CosmeticLoadout:LoadoutSchema_Emotes',

  wrap0: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap1: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap2: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap3: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap4: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap5: 'CosmeticLoadout:LoadoutSchema_Wraps',
  wrap6: 'CosmeticLoadout:LoadoutSchema_Wraps',

  bannerIcon: 'CosmeticLoadout:LoadoutSchema_Platform',
  bannerColor: 'CosmeticLoadout:LoadoutSchema_Platform',
  musicpack: 'CosmeticLoadout:LoadoutSchema_Platform',
  loadingscreen: 'CosmeticLoadout:LoadoutSchema_Platform',

  guitar: 'CosmeticLoadout:LoadoutSchema_Sparks',
  bass: 'CosmeticLoadout:LoadoutSchema_Sparks',
  drum: 'CosmeticLoadout:LoadoutSchema_Sparks',
  keyboard: 'CosmeticLoadout:LoadoutSchema_Sparks',
  microphone: 'CosmeticLoadout:LoadoutSchema_Sparks',

  jamSong0: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong1: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong2: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong3: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong4: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong5: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong6: 'CosmeticLoadout:LoadoutSchema_JamTracks',
  jamSong7: 'CosmeticLoadout:LoadoutSchema_JamTracks',

  vehicleBody: 'CosmeticLoadout:LoadoutSchema_Vehicle',
  vehicleSkin: 'CosmeticLoadout:LoadoutSchema_Vehicle',
  vehicleWheel: 'CosmeticLoadout:LoadoutSchema_Vehicle',
  vehicleDriftSmoke: 'CosmeticLoadout:LoadoutSchema_Vehicle',
  vehicleBooster: 'CosmeticLoadout:LoadoutSchema_Vehicle',

  suvBody: 'CosmeticLoadout:LoadoutSchema_Vehicle_SUV',
  suvSkin: 'CosmeticLoadout:LoadoutSchema_Vehicle_SUV',
  suvWheel: 'CosmeticLoadout:LoadoutSchema_Vehicle_SUV',
  suvDriftSmoke: 'CosmeticLoadout:LoadoutSchema_Vehicle_SUV',
  suvBooster: 'CosmeticLoadout:LoadoutSchema_Vehicle_SUV',

  mimosaMain: 'CosmeticLoadout:LoadoutSchema_Mimosa',
}

/**
 * The `templateId` prefixes an item must carry to be legal in a slot.
 *
 * This is what turns "everything the account owns" into "everything you can
 * put here", so the picker never offers a glider for a wrap slot.
 */
export const backendTypesBySlot: Record<LockerSlotKey, Array<string>> = {
  character: ['AthenaCharacter'],
  backpack: ['AthenaBackpack'],
  pickaxe: ['AthenaPickaxe'],
  glider: ['AthenaGlider'],
  contrail: ['AthenaSkyDiveContrail'],
  shoes: ['CosmeticShoes'],
  aura: ['SparksAura'],

  emote0: ['AthenaDance'],
  emote1: ['AthenaDance'],
  emote2: ['AthenaDance'],
  emote3: ['AthenaDance'],
  emote4: ['AthenaDance'],
  emote5: ['AthenaDance'],
  emote6: ['AthenaDance'],
  emote7: ['AthenaDance'],

  wrap0: ['AthenaItemWrap'],
  wrap1: ['AthenaItemWrap'],
  wrap2: ['AthenaItemWrap'],
  wrap3: ['AthenaItemWrap'],
  wrap4: ['AthenaItemWrap'],
  wrap5: ['AthenaItemWrap'],
  wrap6: ['AthenaItemWrap'],

  bannerIcon: ['HomebaseBannerIcon'],
  bannerColor: ['HomebaseBannerColor'],
  musicpack: ['AthenaMusicPack'],
  loadingscreen: ['AthenaLoadingScreen'],

  guitar: ['SparksGuitar'],
  bass: ['SparksBass'],
  drum: ['SparksDrums'],
  keyboard: ['SparksKeyboard'],
  microphone: ['SparksMicrophone'],

  jamSong0: ['SparksSong'],
  jamSong1: ['SparksSong'],
  jamSong2: ['SparksSong'],
  jamSong3: ['SparksSong'],
  jamSong4: ['SparksSong'],
  jamSong5: ['SparksSong'],
  jamSong6: ['SparksSong'],
  jamSong7: ['SparksSong'],

  vehicleBody: ['VehicleCosmetics_Body'],
  vehicleSkin: ['VehicleCosmetics_Skin'],
  vehicleWheel: ['VehicleCosmetics_Wheel'],
  vehicleDriftSmoke: ['VehicleCosmetics_DriftTrail'],
  vehicleBooster: ['VehicleCosmetics_Booster'],

  suvBody: ['VehicleCosmetics_Body'],
  suvSkin: ['VehicleCosmetics_Skin'],
  suvWheel: ['VehicleCosmetics_Wheel'],
  suvDriftSmoke: ['VehicleCosmetics_DriftTrail'],
  suvBooster: ['VehicleCosmetics_Booster'],

  mimosaMain: ['CosmeticMimosa'],
}

export type LockerSlotCategory = {
  label: string
  slots: Array<LockerSlotKey>
}

/**
 * How the slot board is grouped on screen, in the order the game itself
 * presents them: the thing you look like, then what you do, then the
 * long tail of vehicle and instrument slots most accounts never touch.
 */
export const lockerSlotCategories: Array<LockerSlotCategory> = [
  {
    label: 'Character',
    slots: [
      'character',
      'backpack',
      'pickaxe',
      'glider',
      'contrail',
      'shoes',
      'aura',
    ],
  },
  {
    label: 'Emotes',
    slots: [
      'emote0',
      'emote1',
      'emote2',
      'emote3',
      'emote4',
      'emote5',
      'emote6',
      'emote7',
    ],
  },
  {
    label: 'Wraps',
    slots: [
      'wrap0',
      'wrap1',
      'wrap2',
      'wrap3',
      'wrap4',
      'wrap5',
      'wrap6',
    ],
  },
  {
    label: 'Lobby',
    slots: ['bannerIcon', 'bannerColor', 'musicpack', 'loadingscreen'],
  },
  {
    label: 'Instruments',
    slots: ['guitar', 'bass', 'drum', 'keyboard', 'microphone'],
  },
  {
    label: 'Jam Tracks',
    slots: [
      'jamSong0',
      'jamSong1',
      'jamSong2',
      'jamSong3',
      'jamSong4',
      'jamSong5',
      'jamSong6',
      'jamSong7',
    ],
  },
  {
    label: 'Car (Sports)',
    slots: [
      'vehicleBody',
      'vehicleSkin',
      'vehicleWheel',
      'vehicleDriftSmoke',
      'vehicleBooster',
    ],
  },
  {
    label: 'Car (SUV)',
    slots: ['suvBody', 'suvSkin', 'suvWheel', 'suvDriftSmoke', 'suvBooster'],
  },
  {
    label: 'Companion',
    slots: ['mimosaMain'],
  },
]

/** What a slot is called on the board, when its key is not self-explanatory. */
export const slotLabels: Record<LockerSlotKey, string> = {
  character: 'Outfit',
  backpack: 'Back Bling',
  pickaxe: 'Pickaxe',
  glider: 'Glider',
  contrail: 'Contrail',
  shoes: 'Shoes',
  aura: 'Aura',

  emote0: 'Emote 1',
  emote1: 'Emote 2',
  emote2: 'Emote 3',
  emote3: 'Emote 4',
  emote4: 'Emote 5',
  emote5: 'Emote 6',
  emote6: 'Emote 7',
  emote7: 'Emote 8',

  wrap0: 'Wrap 1',
  wrap1: 'Wrap 2',
  wrap2: 'Wrap 3',
  wrap3: 'Wrap 4',
  wrap4: 'Wrap 5',
  wrap5: 'Wrap 6',
  wrap6: 'Wrap 7',

  bannerIcon: 'Banner',
  bannerColor: 'Banner Colour',
  musicpack: 'Lobby Music',
  loadingscreen: 'Loading Screen',

  guitar: 'Guitar',
  bass: 'Bass',
  drum: 'Drums',
  keyboard: 'Keyboard',
  microphone: 'Microphone',

  jamSong0: 'Track 1',
  jamSong1: 'Track 2',
  jamSong2: 'Track 3',
  jamSong3: 'Track 4',
  jamSong4: 'Track 5',
  jamSong5: 'Track 6',
  jamSong6: 'Track 7',
  jamSong7: 'Track 8',

  vehicleBody: 'Body',
  vehicleSkin: 'Decal',
  vehicleWheel: 'Wheels',
  vehicleDriftSmoke: 'Drift Trail',
  vehicleBooster: 'Boost',

  suvBody: 'Body',
  suvSkin: 'Decal',
  suvWheel: 'Wheels',
  suvDriftSmoke: 'Drift Trail',
  suvBooster: 'Boost',

  mimosaMain: 'Companion',
}

export const lockerSlotKeys = Object.keys(slotTemplates) as Array<LockerSlotKey>

export function isLockerSlotKey(value: string): value is LockerSlotKey {
  return value in slotTemplates
}

/**
 * The cosmetic groups the card generator can be pointed at.
 *
 * `all` is every group at once; the rest map onto the `templateId` prefixes
 * the athena profile files an item under. Kept separate from `slotTemplates`
 * because a card is drawn per *kind of thing*, not per slot — one "Emotes"
 * shelf, not eight identical emote slots.
 */
export const cardCosmeticGroups = {
  outfit: ['AthenaCharacter'],
  backpack: ['AthenaBackpack'],
  pickaxe: ['AthenaPickaxe'],
  glider: ['AthenaGlider'],
  contrail: ['AthenaSkyDiveContrail'],
  shoes: ['CosmeticShoes'],
  emote: ['AthenaDance'],
  wrap: ['AthenaItemWrap'],
  music: ['AthenaMusicPack'],
  loadingscreen: ['AthenaLoadingScreen'],
  banner: ['HomebaseBannerIcon'],
  instrument: [
    'SparksGuitar',
    'SparksBass',
    'SparksDrums',
    'SparksKeyboard',
    'SparksMicrophone',
  ],
  track: ['SparksSong'],
  vehicle: [
    'VehicleCosmetics_Body',
    'VehicleCosmetics_Skin',
    'VehicleCosmetics_Wheel',
    'VehicleCosmetics_DriftTrail',
    'VehicleCosmetics_Booster',
  ],
  companion: ['CosmeticMimosa'],
} as const

export type CardCosmeticGroup = keyof typeof cardCosmeticGroups

export const cardCosmeticGroupLabels: Record<CardCosmeticGroup, string> = {
  outfit: 'Outfits',
  backpack: 'Back Blings',
  pickaxe: 'Pickaxes',
  glider: 'Gliders',
  contrail: 'Contrails',
  shoes: 'Shoes',
  emote: 'Emotes',
  wrap: 'Wraps',
  music: 'Music Packs',
  loadingscreen: 'Loading Screens',
  banner: 'Banners',
  instrument: 'Instruments',
  track: 'Jam Tracks',
  vehicle: 'Car Cosmetics',
  companion: 'Companions',
}

/**
 * Card shelf order. Outfits first because that is what anyone looking at a
 * locker card is actually there to see.
 */
export const cardCosmeticGroupOrder = Object.keys(
  cardCosmeticGroups
) as Array<CardCosmeticGroup>

export function isCardCosmeticGroup(
  value: string
): value is CardCosmeticGroup {
  return value in cardCosmeticGroups
}

/**
 * Backend type → the shelf it belongs on.
 *
 * The inverse of `cardCosmeticGroups`, which is the direction both the card
 * generator and the collection grid actually read it in: they hold an item
 * and need its shelf, not a shelf and need its items.
 */
export const cardGroupByBackendType = new Map<string, CardCosmeticGroup>(
  cardCosmeticGroupOrder.flatMap((group) =>
    cardCosmeticGroups[group].map(
      (backendType) => [backendType, group] as [string, CardCosmeticGroup]
    )
  )
)

/**
 * The two gradient stops a cosmetic tile is drawn with, per rarity.
 *
 * fortnite-api collapses the licensed and collaboration series into the same
 * `rarity` field as the ordinary ladder, so one table covers both. Used by
 * the slot board, the picker and the card generator, which is why it lives
 * here rather than beside any one of them.
 */
export const cosmeticRarityColors: Record<string, [string, string]> = {
  common: ['#5f6b74', '#39434a'],
  uncommon: ['#5bb033', '#2f6b1c'],
  rare: ['#25a2e5', '#14588c'],
  epic: ['#a03fe0', '#5c1f86'],
  legendary: ['#e2802c', '#8c4611'],
  mythic: ['#e6c033', '#8f7310'],
  marvel: ['#c4231e', '#6b0f0d'],
  dc: ['#3b5fb5', '#1b2c5e'],
  starwars: ['#2f3d4d', '#0f1720'],
  icon: ['#38c5d1', '#146b74'],
  gaminglegends: ['#7b6cf0', '#3a2c96'],
  dark: ['#a4319b', '#4d1149'],
  shadow: ['#4a4a4a', '#1c1c1c'],
  slurp: ['#20b6b0', '#0d5a57'],
  frozen: ['#8fd4f2', '#3e7b96'],
  lava: ['#d9762b', '#7a2f0c'],
}

export const cosmeticFallbackColors: [string, string] = ['#4a5058', '#22262b']

/** Best tier first, so a shelf opens with the things worth seeing. */
export const cosmeticRarityWeights: Record<string, number> = {
  gaminglegends: 200,
  marvel: 190,
  starwars: 180,
  dc: 170,
  icon: 160,
  dark: 150,
  shadow: 140,
  slurp: 130,
  frozen: 120,
  lava: 110,
  mythic: 105,
  legendary: 100,
  epic: 90,
  rare: 80,
  uncommon: 70,
  common: 60,
}

/**
 * `RRGGBBAA` (fortnite-api's series palette) → `#RRGGBB`.
 *
 * The alpha byte is dropped rather than honoured: these are tile gradients
 * drawn onto an opaque surface, and a half-transparent stop would read as a
 * washed-out tile rather than a tinted one.
 */
export function normalizeSeriesColor(value: string | undefined) {
  if (!value) {
    return null
  }

  const hex = value.replace(/^#/, '')

  return /^[0-9a-fA-F]{6,8}$/.test(hex) ? `#${hex.slice(0, 6)}` : null
}

/**
 * The two gradient stops for one cosmetic.
 *
 * A series palette wins when the item has one — that is the colour the game
 * itself draws, and it is what makes a Marvel tile look like a Marvel tile
 * even though its rarity token says `marvel` and nothing about red.
 */
export function cosmeticTileColors(cosmetic: {
  rarity?: string | null
  seriesColors?: Array<string> | null
}): [string, string] {
  const series = (cosmetic.seriesColors ?? [])
    .map(normalizeSeriesColor)
    .filter((color): color is string => color !== null)

  if (series.length >= 2) {
    return [series[0], series[series.length - 1]]
  }

  return (
    cosmeticRarityColors[cosmetic.rarity?.toLowerCase() ?? ''] ??
    cosmeticFallbackColors
  )
}

export function cosmeticRarityWeight(rarity: string | null | undefined) {
  return cosmeticRarityWeights[rarity?.toLowerCase() ?? ''] ?? 50
}

/** Rarity tokens worth offering as a card filter, best first. */
export const cardRarityOptions = [
  'gaminglegends',
  'marvel',
  'starwars',
  'dc',
  'icon',
  'dark',
  'shadow',
  'slurp',
  'frozen',
  'lava',
  'mythic',
  'legendary',
  'epic',
  'rare',
  'uncommon',
  'common',
] as const

export const cardRarityLabels: Record<string, string> = {
  gaminglegends: 'Gaming Legends',
  marvel: 'Marvel',
  starwars: 'Star Wars',
  dc: 'DC',
  icon: 'Icon',
  dark: 'Dark',
  shadow: 'Shadow',
  slurp: 'Slurp',
  frozen: 'Frozen',
  lava: 'Lava',
  mythic: 'Mythic',
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
}
