export enum ElectronAPIEventKeys {
  /**
   * Settings
   */

  AppLanguageRequest = 'settings:language:request',
  AppLanguageInit = 'settings:language:init',
  AppLanguageNotification = 'settings:language:notification',
  AppLanguageUpdate = 'settings:language:update',

  SettingsDetectPath = 'settings:detect:path',
  GameInstallStatus = 'game-install:status',
  GameInstallDetect = 'game-install:detect',
  GameInstallChooseFolder = 'game-install:choose-folder',
  GameInstallOpenOfficial = 'game-install:open-official',

  RequestSettings = 'request:settings',
  OnLoadSettings = 'on:load:settings',
  UpdateSettings = 'settings:update',

  CustomProcessKill = 'custom-process:kill',
  CustomProcessStatus = 'custom-process:status',

  DevSettingsRequest = 'dev-settings:request',
  DevSettingsResponse = 'dev-settings:response',

  CustomizableMenuSettingsRequest = 'customizable-menu-settings:request',
  CustomizableMenuSettingsResponse = 'customizable-menu-settings:response',
  CustomizableMenuSettingsUpdate = 'customizable-menu-settings:update',



  /**
   * General Methods
   */

  OpenExternalURL = 'open-external-url',

  CloseWindow = 'window:close',
  MinimizeWindow = 'window:minimize',
  MaximizeWindow = 'window:maximize-toggle',
  /** Main → renderer: maximised state, and whether Mica is painting. */
  WindowChromeState = 'window:chrome-state',
  AppearanceSet = 'appearance:set',
  AppearanceChanged = 'appearance:changed',

  /** Main → Penny's separate, non-injected game overlay window. */
  OverlaySnapshot = 'overlay:snapshot',

  /**
   * Windows shell surfaces — things that keep working while the window is
   * hidden, which is most of the time for this app.
   */
  TaskbarProgress = 'shell:taskbar-progress',
  TaskbarBadge = 'shell:taskbar-badge',
  TaskbarJumpList = 'shell:taskbar-jump-list',
  NativeNotify = 'shell:notify',
  ContextMenuPopup = 'shell:context-menu:popup',
  ContextMenuSelected = 'context-menu:selected',
  /** Main → renderer: a jump-list entry asked for a different account. */
  ScopeRequest = 'shell:scope-request',
  /** Renderer → main: what the tray menu should say. */
  TraySummary = 'shell:tray-summary',

  /**
   * Events
   */

  OnAccountsLoaded = 'on:accounts-loaded',
  OnRemoveAccount = 'on:account-remove',

  /**
   * Requests
   */

  RequestNewVersionStatus = 'request:new-version-status',
  ResponseNewVersionStatus = 'response:new-version-status',

  RequestAccounts = 'request:accounts',

  RequestProviderAndAccessTokenOnStartup = 'request:provider-with-access-token:on-startup',
  ResponseProviderAndAccessTokenOnStartup = 'request:provider-with-access-token:on-startup:response',

  /**
   * Accounts
   */

  UpdateAccountBasicInfo = 'account:custom-display-name:update',
  ResponseUpdateAccountBasicInfo = 'account:custom-display-name:response',

  AccountsOrderingSync = 'accounts-ordering:sync',

  /**
   * Authentication
   */

  CreateAuthWithExchange = 'auth:create:exchange',
  ResponseAuthWithExchange = 'auth:create:exchange:response',

  CreateAuthWithAuthorization = 'auth:create:authorization',
  ResponseAuthWithAuthorization = 'auth:create:authorization:response',

  CreateAuthWithDevice = 'auth:create:device',
  ResponseAuthWithDevice = 'auth:create:device:response',

  CreateAuthWithQuickLogin = 'auth:create:quick',
  CancelAuthWithQuickLogin = 'auth:create:quick:cancel',
  QuickLoginStatus = 'auth:create:quick:status',
  ResponseAuthWithQuickLogin = 'auth:create:quick:response',

  ImportAccountsFromAerial = 'accounts:import-from-aerial',
  ResponseImportAccountsFromAerial = 'accounts:import-from-aerial:response',

  OpenEpicGamesSettings = 'epicgames:open-settings',
  OpenEpicGamesSettingsNotification = 'epicgames:open-settings:notification',

  GenerateExchangeCode = 'auth:generate:exchange',
  ResponseGenerateExchangeCode = 'auth:generate:exchange:response',

  SyncAccessToken = 'auth:access-token:sync',
  CheckAllAccountStatuses = 'auth:account-status:check-all',

  EULAVerificationRequest = 'eula:request',
  EULAVerificationResponse = 'eula:response',

  /**
   * Launcher
   */

  LauncherStart = 'launcher:start',
  LauncherNotification = 'launcher:notification',

  /**
   * STW Operations
   */

  XPBoostsAccountProfileRequest = 'xpboosts:account-profile:request',
  XPBoostsAccountProfileResponse = 'xpboosts:account-profile:response',
  XPBoostsSearchUser = 'xpboosts:search:user',
  XPBoostsSearchUserNotification = 'xpboosts:search:user:notification',
  XPBoostsGeneralSearchUser = 'xpboosts:general-search:user',
  XPBoostsGeneralSearchUserNotification = 'xpboosts:general-search:user:notification',
  XPBoostsConsumePersonal = 'xpboosts:consume:personal',
  XPBoostsConsumePersonalNotification = 'xpboosts:consume:personal:notification',
  XPBoostsConsumeTeammate = 'xpboosts:consume:teammate',
  XPBoostsConsumeTeammateNotification = 'xpboosts:consume:teammate:notification',
  XPBoostsConsumeTeammateProgressionNotification = 'xpboosts:consume:teammate:progression:notification',
  PartyClaimActionNotification = 'party:claim:notification',
  PartyKickActionNotification = 'party:kick:notification',
  PartyKickActionGlobalNotification = 'party:kick:global:notification',

  ClaimRewardsClientNotification = 'claim-rewards:client:notification',
  ClaimRewardsClientGlobalSyncNotification = 'claim-rewards:client:global:sync:notification',
  ClaimRewardsClientGlobalAutoClaimedNotification = 'claim-rewards:client:global-auto-claimed:notification',
  PartyAddNewFriendAction = 'party:friend:add',
  PartyAddNewFriendActionNotification = 'party:friend:add:notification',
  PartyInviteAction = 'party:invite',
  PartyInviteActionNotification = 'party:invite:notification',
  PartyRemoveFriendAction = 'party:friend:remove',
  PartyRemoveFriendActionNotification = 'party:friend:remove:notification',

  /**
   * Advanced Mode
   */

  HomeWorldInfoRequest = 'home:world-info:request',
  HomeWorldInfoResponse = 'home:world-info:response',
  HomeFetchPlayerRequest = 'home:fetch-player:request',
  HomeFetchPlayerResponse = 'home:fetch-player:response',
  HomePennyDBMissionsRequest = 'home:pennydb-missions:request',
  HomePennyDBMissionsResponse = 'home:pennydb-missions:response',

  WorldInfoRequestData = 'advanced-mode:world-info:request:data',
  WorldInfoResponseData = 'advanced-mode:world-info:response:data',
  WorldInfoSaveFile = 'advanced-mode:world-info:save:file',
  WorldInfoSaveNotification = 'advanced-mode:world-info:save:notification',
  WorldInfoRequestFiles = 'advanced-mode:world-info:request:files',
  WorldInfoResponseFiles = 'advanced-mode:world-info:response:files',
  WorldInfoDeleteFile = 'advanced-mode:world-info:delete:file',
  WorldInfoDeleteNotification = 'advanced-mode:world-info:delete:notification',
  WorldInfoExportFile = 'advanced-mode:world-info:export:file',
  WorldInfoExportFileNotification = 'advanced-mode:world-info:export:notification',
  WorldInfoOpenFile = 'advanced-mode:world-info:open:file',
  WorldInfoOpenFileNotification = 'advanced-mode:world-info:open:notification',
  WorldInfoRenameFile = 'advanced-mode:world-info:rename:file',
  WorldInfoRenameFileNotification = 'advanced-mode:world-info:rename:notification',

  MatchmakingTrackStatus = 'advanced-mode:matchmaking-track:status',
  MatchmakingTrackStatusNotification = 'advanced-mode:matchmaking-track:status:notification',

  /**
   * File Tweaks — hidden, personal-key gated (see kernel/core/file-tweaks).
   */

  FileTweaksUnlock = 'file-tweaks:unlock',
  FileTweaksLockStatus = 'file-tweaks:lock-status',

  FileTweaksDevBuildsStatus = 'file-tweaks:devbuilds:status',
  FileTweaksDevBuildsToggle = 'file-tweaks:devbuilds:toggle',
  FileTweaksDevStairsStatus = 'file-tweaks:devstairs:status',
  FileTweaksDevStairsToggle = 'file-tweaks:devstairs:toggle',
  FileTweaksAirStrikeStatus = 'file-tweaks:airstrike:status',
  FileTweaksAirStrikeToggle = 'file-tweaks:airstrike:toggle',

  FileTweaksTrapsData = 'file-tweaks:traps:data',
  FileTweaksTrapStatus = 'file-tweaks:trap:status',
  FileTweaksTrapApply = 'file-tweaks:trap:apply',
  FileTweaksTrapRevert = 'file-tweaks:trap:revert',
  FileTweaksTrapsRevertAll = 'file-tweaks:traps:revert-all',

  FileTweaksBaseStatus = 'file-tweaks:base:status',
  FileTweaksBaseApply = 'file-tweaks:base:apply',
  FileTweaksBaseRevert = 'file-tweaks:base:revert',

  FileTweaksWorkerPower = 'file-tweaks:worker-power',

  /**
   * Outpost
   */

  OutpostInfoRequest = 'outpost:info:request',
  OutpostBaseRequest = 'outpost:base:request',
  OutpostReportExport = 'outpost:report:export',

  /**
   * Automation
   */

  AutomationServiceRequestData = 'automation:service:request:data',
  AutomationServiceResponseData = 'automation:service:response:data',
  AutomationServiceStart = 'automation:service:start',
  AutomationServiceStartNotification = 'automation:service:start:notification',
  AutomationServiceReload = 'automation:service:reload',
  AutomationServiceReloadNotification = 'automation:service:reload:notification',
  AutomationServiceRemove = 'automation:service:remove',
  AutomationServiceRemoveNotification = 'automation:service:remove:notification',
  AutomationServiceActionUpdate = 'automation:service:action:update',
  AutomationServiceActionUpdateNotification = 'automation:service:action:update:notification',

  /**
   * Urns
   */

  UrnsServiceRequestData = 'urns:service:request:data',
  UrnsServiceResponseData = 'urns:service:response:data',
  UrnsServiceAdd = 'urns:service:add',
  UrnsServiceAddNotification = 'urns:service:add:notification',
  UrnsServiceUpdate = 'urns:service:update',
  UrnsServiceUpdateNotification = 'urns:service:update:notification',
  UrnsServiceRemove = 'urns:service:remove',
  UrnsServiceRemoveNotification = 'urns:service:remove:notification',

  /**
   * Auto-llamas
   */

  AutoLlamasLoadAccountsRequest = 'auto-llamas:load:accounts:request',
  AutoLlamasLoadAccountsResponse = 'auto-llamas:load:accounts:response',
  AutoLlamasAccountAdd = 'auto-llamas:account:add',
  AutoLlamasAccountUpdate = 'auto-llamas:account:update',
  AutoLlamasAccountRemove = 'auto-llamas:account:remove',
  AutoLlamasAccountCheck = 'auto-llamas:account:check',
  AutoLlamasAccountCheckLoading = 'auto-llamas:account:check:loading',

  /**
   * V-Bucks Information
   */

  VBucksInformationRequest = 'vbucks-information:request:data',
  VBucksInformationResponseData = 'vbucks-information:response:data',

  /**
   * Gifts Information
   */

  GiftsInformationRequest = 'gifts-information:request:data',
  GiftsInformationResponseData = 'gifts-information:response:data',

  /**
   * Redeem Codes
   */

  RedeemCodesRedeem = 'redeem-codes:redeem',
  RedeemCodesRedeenNotification = 'redeem-codes:redeem:notification',

  /**
   * Server Status
   */

  ServerStatusRequest = 'server-status:request',
  ServerStatusResponse = 'server-status:response',

  /**
   * In-game news (Fortnite public content CMS, global)
   */
  GameNewsRequest = 'game:news:request',
  GameNewsResponse = 'game:news:response',

  /**
   * FN Launch
   */

  FnLaunchSettingsRequest = 'fn-launch:settings:request',
  FnLaunchSettingsUpdate = 'fn-launch:settings:update',
  FnLaunchGameSettingsRequest = 'fn-launch:game-settings:request',
  FnLaunchGameSettingsUpdate = 'fn-launch:game-settings:update',
  FnLaunchGameSettingsRestore = 'fn-launch:game-settings:restore',

  /**
   * Friends Manager
   */

  FriendsManagerRequest = 'friends-manager:request',
  FriendsManagerResponse = 'friends-manager:response',
  FriendsManagerSearch = 'friends-manager:search',
  FriendsManagerSearchResponse = 'friends-manager:search:response',
  FriendsManagerAction = 'friends-manager:action',
  FriendsManagerBulkAction = 'friends-manager:bulk-action',
  FriendsManagerActionNotification = 'friends-manager:action:notification',

  /**
   * Account Health
   */

  AccountHealthRequest = 'account-health:request',
  AccountHealthResponse = 'account-health:response',

  /**
   * Expeditions
   */

  ExpeditionsRequest = 'expeditions:request',
  ExpeditionsResponse = 'expeditions:response',
  ExpeditionsCollect = 'expeditions:collect',
  ExpeditionsCollectNotification = 'expeditions:collect:notification',
  ExpeditionsAction = 'expeditions:action',
  ExpeditionsActionNotification = 'expeditions:action:notification',
  AutoExpeditionsStatus = 'auto-expeditions:status',
  AutoExpeditionsUpdate = 'auto-expeditions:update',
  AutoExpeditionsEnsureStarted = 'auto-expeditions:ensure-started',

  /**
   * Item database
   */

  ItemDatabaseRequest = 'item-database:request',
  ItemDatabaseResponse = 'item-database:response',
  ItemDatabaseRefresh = 'item-database:refresh',

  /**
   * Event timeline
   */

  TimelineRequest = 'timeline:request',
  TimelineResponse = 'timeline:response',

  /**
   * PennyDB leaderboards
   */

  LeaderboardRequest = 'leaderboard:request',
  LeaderboardResponse = 'leaderboard:response',

  /**
   * Quest log
   */

  QuestsRequest = 'quests:request',
  QuestsResponse = 'quests:response',
  QuestsPin = 'quests:pin',
  QuestsPinNotification = 'quests:pin:notification',

  /**
   * Hero loadouts
   */

  LoadoutsRequest = 'loadouts:request',
  LoadoutsResponse = 'loadouts:response',
  LoadoutEdit = 'loadouts:edit',
  LoadoutEditNotification = 'loadouts:edit:notification',

  /**
   * Item modification
   */

  ItemAction = 'item-action:perform',
  ItemActionNotification = 'item-action:notification',

  /**
   * Survivor squads
   */

  SquadsRequest = 'squads:request',
  SquadsResponse = 'squads:response',
  SquadsAssign = 'squads:assign',
  SquadsAssignNotification = 'squads:assign:notification',

  /**
   * Inventory
   */

  InventoryRequest = 'inventory:request',
  InventoryResponse = 'inventory:response',
  InventoryRecycle = 'inventory:recycle',
  InventoryRecycleNotification = 'inventory:recycle:notification',

  /**
   * Shop
   */

  ShopRequest = 'shop:request',
  ShopResponse = 'shop:response',
  ShopPurchase = 'shop:purchase',
  ShopPurchaseNotification = 'shop:purchase:notification',
  ShopOpen = 'shop:open',
  ShopOpenNotification = 'shop:open:notification',
  /** Public PennyDB catalog — read-only, not a purchase path. */
  ShopCatalogRequest = 'shop:catalog:request',
  ShopCatalogResponse = 'shop:catalog:response',

  /**
   * BR Locker
   */

  LockerRequest = 'locker:request',
  LockerResponse = 'locker:response',
  /** Everything the account owns, so the slot pickers can filter locally. */
  LockerOwnedRequest = 'locker:owned:request',
  LockerOwnedResponse = 'locker:owned:response',
  /** Every sidekick in the catalogue, flagged owned or not. */
  LockerCompanionsRequest = 'locker:companions:request',
  LockerCompanionsResponse = 'locker:companions:response',
  LockerEquip = 'locker:equip',
  LockerEquipNotification = 'locker:equip:notification',
  LockerCardGenerate = 'locker:card:generate',
  LockerCardProgress = 'locker:card:progress',
  LockerCardNotification = 'locker:card:notification',
  LockerCardOpen = 'locker:card:open',
  LockerCardExport = 'locker:card:export',

  /**
   * BR Sprites
   */

  /** Every BR sprite Epic has released, flagged owned / lost / missing. */
  SpritesRequest = 'sprites:request',
  SpritesResponse = 'sprites:response',
  /** Every linked account's collection, one reply per account as it lands. */
  SpritesAllRequest = 'sprites:all:request',
  SpritesAllResponse = 'sprites:all:response',
  /** Collection change log and per-account last-known state, from disk. */
  SpritesHistoryRequest = 'sprites:history:request',
  SpritesHistoryResponse = 'sprites:history:response',
  /** Background sweep for collection changes (toast on new/lost/mastered). */
  SpritesWatchSet = 'sprites:watch:set',

  /**
   * Epic account extras: avatars and social standing
   */

  /** Equipped-skin avatars for linked accounts (and friends) by account id. */
  AccountAvatarsRequest = 'account:avatars:request',
  AccountAvatarsResponse = 'account:avatars:response',
  /** Social bans and warnings for every linked account. */
  AccountStandingRequest = 'account:standing:request',
  AccountStandingResponse = 'account:standing:response',

  /**
   * Library: entitlements + catalogue, store offers, Epic cloud saves
   */

  LibraryRequest = 'library:request',
  LibraryResponse = 'library:response',
  LibraryStoreRequest = 'library:store:request',
  LibraryStoreResponse = 'library:store:response',
  CloudSavesRequest = 'library:cloud-saves:request',
  CloudSavesResponse = 'library:cloud-saves:response',
  CloudSavesDownload = 'library:cloud-saves:download',
  CloudSavesDownloadProgress = 'library:cloud-saves:download:progress',

  /**
   * Creative islands (Fortnite's Discover service + Epic's public ecosystem API)
   */

  /** Discovery panels: titles, art, live player counts. */
  IslandsDiscoveryRequest = 'islands:discovery:request',
  IslandsDiscoveryResponse = 'islands:discovery:response',
  /** One island's ecosystem metrics (peak players, plays, favourites…). */
  IslandsMetricsRequest = 'islands:metrics:request',
  IslandsMetricsResponse = 'islands:metrics:response',
  /** Watched islands and their player-count thresholds. */
  IslandsWatchlistRequest = 'islands:watchlist:request',
  IslandsWatchlistResponse = 'islands:watchlist:response',
  IslandsWatchlistUpdate = 'islands:watchlist:update',

  /**
   * Schedules
   */

  ScheduleRequestAccounts = 'schedule:request:accounts',
  ScheduleResponseAccounts = 'schedule:response:accounts',

  ScheduleResponseProviders = 'schedule:response:providers',

  /**
   * Plugins
   */

  PluginReview = 'plugins:review',
  PluginAccept = 'plugins:accept',
  PluginDiscard = 'plugins:discard',
  PluginManage = 'plugins:manage',
  PluginSettings = 'plugins:settings',
  PluginMode = 'plugins:mode',
  PluginsList = 'plugins:list',
  PluginsMarketplaceList = 'plugins:marketplace:list',
  PluginInstall = 'plugins:install',
  PluginRemove = 'plugins:remove',
  PluginReadme = 'plugins:readme',
  PluginsDirectoryOpen = 'plugins:directory:open',
  PluginOpen = 'plugins:open',
  PluginNavigate = 'plugins:navigate',
  PluginAccountScopeSync = 'plugins:account-scope:sync',

  /**
   * Playtime (the launcher's GraphQL gateway, per linked account)
   */

  /** Time played per launcher app for every linked account. */
  AccountPlaytimeRequest = 'account:playtime:request',
  AccountPlaytimeResponse = 'account:playtime:response',
  /** One game's Epic achievements for one linked account (invoke). */
  AccountAchievementsRequest = 'account:achievements:request',
  /** Two-factor, email and linked platforms for every linked account. */
  AccountSecurityRequest = 'account:security:request',
  AccountSecurityResponse = 'account:security:response',
  /** Competitive rank per track for every linked account (Habanero). */
  AccountRankedRequest = 'account:ranked:request',
  AccountRankedResponse = 'account:ranked:response',
  /** Each linked account's own competitive event history (events service). */
  AccountTournamentsRequest = 'account:tournaments:request',
  AccountTournamentsResponse = 'account:tournaments:response',
  /** Battle Royale career stats for every linked account. */
  AccountBrStatsRequest = 'account:br-stats:request',
  AccountBrStatsResponse = 'account:br-stats:response',

  /**
   * Cross-account Library and the Epic Games Store
   */

  /** Every linked account's Epic library and game profile. */
  LibraryOverviewRequest = 'library:overview:request',
  LibraryOverviewResponse = 'library:overview:response',
  /** The store's free games, this week and next (invoke). */
  FreeGamesRequest = 'store:free-games:request',
  /** A game's player rating and critic score (invoke). */
  GameDetailsRequest = 'store:game-details:request',
  /** A store page in the browser, signed in as one linked account (invoke). */
  StoreOpenSignedIn = 'store:open-signed-in',
  /** Start Fortnite straight into one mode for one account. */
  LauncherStartMode = 'launcher:start:mode',
  /** Penny Rewind's game-profile facts for every linked account. */
  RewindFactsRequest = 'rewind:facts:request',
  RewindFactsResponse = 'rewind:facts:response',

  /**
   * Fortnite presence: one account's friend-facing status while the game
   * is closed. All invoke, all account-id only; the snapshot pushed back
   * holds no credentials.
   */

  PresenceStart = 'presence:start',
  PresenceUpdate = 'presence:update',
  PresenceStop = 'presence:stop',
  PresenceStatus = 'presence:status',
  PresenceChanged = 'presence:changed',
}
