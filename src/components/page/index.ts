/**
 * The page kit.
 *
 * Every tool screen is built from these, so a page is a short list of
 * intentions rather than a pile of layout classes, and fixing the look of
 * one thing fixes it everywhere.
 */
export { AccountToolbar } from './account-toolbar'
export { ActionTile } from './action-tile'
export { Callout, type CalloutTone } from './callout'
export { Chip, type ChipTone } from './chip'
export { CopyField } from './copy-field'
export { EmptySlot, type EmptySlotSize } from './empty-slot'
export { EmptyState } from './empty-state'
export { FieldGroup, FieldRow } from './field-row'
export {
  IconWell,
  type IconWellSize,
  type IconWellTone,
} from './icon-well'
export { Kbd } from './kbd'
export { KeyValue } from './key-value'
export { ListRow } from './list-row'
export { PageHeader } from './page-header'
export { Panel, PanelBody, PanelFooter, PanelHeader } from './panel'
export { PanelSectionHeader } from './panel-section-header'
export { ProgressBar } from './progress'
export { ScopeToolbar } from './scope-toolbar'
export { Segmented, type SegmentedOption } from './segmented'
export {
  StatRow,
  StatTile,
  StatusDot,
  StatusLegend,
  StatusPill,
  type StatusTone,
} from './stat'

/*
 * The reward vocabulary. It lived inside the missions route until four other
 * screens needed it and could not import out of a route; `-reward-chip.tsx`
 * and `-mission-data.ts` are re-export shims onto these now.
 */
export * from './rarity'
export * from './reward'
export { PageTabs, PageTabPanel } from './page-tabs'
