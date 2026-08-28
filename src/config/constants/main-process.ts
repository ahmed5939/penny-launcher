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
  /** Renderer → main: repaint the caption buttons for the active theme. */
  WindowChromeTheme = 'window:chrome-theme',

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

  ImportAccountsFromAerial = 'accounts:import-from-aerial',
  ResponseImportAccountsFromAerial = 'accounts:import-from-aerial:response',

  OpenEpicGamesSettings = 'epicgames:open-settings',
  OpenEpicGamesSettingsNotification = 'epicgames:open-settings:notification',

  GenerateExchangeCode = 'auth:generate:exchange',
  ResponseGenerateExchangeCode = 'auth:generate:exchange:response',

  SyncAccessToken = 'auth:access-token:sync',

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

  /**
   * Party
   */

  PartyClaimAction = 'party:claim',
  PartyClaimActionNotification = 'party:claim:notification',
  PartyKickAction = 'party:kick',
  PartyKickActionNotification = 'party:kick:notification',
  PartyKickActionGlobalNotification = 'party:kick:global:notification',
  PartyLeaveAction = 'party:leave',
  PartyLeaveActionNotification = 'party:leave:notification',

  ClaimRewardsClientNotification = 'claim-rewards:client:notification',
  ClaimRewardsClientGlobalSyncNotification = 'claim-rewards:client:global:sync:notification',
  ClaimRewardsClientGlobalAutoClaimedNotification = 'claim-rewards:client:global-auto-claimed:notification',

  PartyLoadFriends = 'party:load:friends',
  PartyLoadFriendsNotification = 'party:load:friends:notification',
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
   * Outpost
   */

  OutpostInfoRequest = 'outpost:info:request',
  OutpostBaseRequest = 'outpost:base:request',

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
   * Taxi Service
   */

  TaxiServiceServiceRequestData = 'taxi-service:service:request:data',
  TaxiServiceServiceAddAccounts = 'taxi-service:service:add',
  // TaxiServiceServiceAddAccountsNotification = 'taxi-service:service:add:notification',
  TaxiServiceServiceResponseData = 'taxi-service:service:response:data',
  TaxiServiceServiceStart = 'taxi-service:service:start',
  TaxiServiceServiceStartNotification = 'taxi-service:service:start:notification',
  TaxiServiceServiceReload = 'taxi-service:service:reload',
  TaxiServiceServiceReloadNotification = 'taxi-service:service:reload:notification',
  TaxiServiceServiceRemove = 'taxi-service:service:remove',
  TaxiServiceServiceRemoveNotification = 'taxi-service:service:remove:notification',
  TaxiServiceServiceActionUpdate = 'taxi-service:service:action:update',
  TaxiServiceServiceActionUpdateNotification = 'taxi-service:service:action:update:notification',

  TaxiServiceWhitelistAdd = 'taxi-service:whitelist:add',
  TaxiServiceWhitelistRemove = 'taxi-service:whitelist:remove',

  TaxiServiceServiceLog = 'taxi-service:service:log',

  TaxiServiceServiceNotifications = 'taxi-service:service:notifications',

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
   * Devices Auth Management
   */

  DevicesAuthRequestData = 'devices-auth:request:data',
  DevicesAuthResponseData = 'devices-auth:response:data',
  DevicesAuthRemove = 'devices-auth:remove',
  DevicesAuthRemoveNotification = 'devices-auth:remove:notification',

  /**
   * Server Status
   */

  ServerStatusRequest = 'server-status:request',
  ServerStatusResponse = 'server-status:response',

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
  LockerEquip = 'locker:equip',
  LockerEquipNotification = 'locker:equip:notification',
  LockerCardGenerate = 'locker:card:generate',
  LockerCardProgress = 'locker:card:progress',
  LockerCardNotification = 'locker:card:notification',
  LockerCardOpen = 'locker:card:open',
  LockerCardExport = 'locker:card:export',

  /**
   * Schedules
   */

  ScheduleRequestAccounts = 'schedule:request:accounts',
  ScheduleResponseAccounts = 'schedule:response:accounts',

  ScheduleResponseProviders = 'schedule:response:providers',

  /**
   * Plugins
   */

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
   * Endurance
   */

  EnduranceStatusRequest = 'endurance:status:request',
  EnduranceStart = 'endurance:start',
  EnduranceStop = 'endurance:stop',
  EnduranceConfigUpdate = 'endurance:config:update',
  EnduranceCalibrateStart = 'endurance:calibrate:start',
  EnduranceCalibrateCancel = 'endurance:calibrate:cancel',
  EnduranceNotification = 'endurance:notification',
}
