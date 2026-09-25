# Penny Launcher UX standard

This is how a screen in the launcher is built. It exists so any tool looks
like the rest of the app without being designed from scratch, and so a
second person can extend a page without guessing.

The machine-checkable rules are enforced by
`src/components/page/ux-standard.test.ts`. The rest are for review. When a
rule and a real need conflict, change the kit, not the page.

## 1. Build from the kit

Everything a tool page needs is exported from `src/components/page`
(`import { … } from '../../components/page'`). Item visuals live in
`src/components/items`. Do not rebuild these locally.

| Need | Use | Not |
|---|---|---|
| Page title, description, page-wide buttons | `PageHeader` | a bare `<h1>` |
| "Beta" / "Read-only" labels | `ToolBadges` in `PageHeader status` | hand-made `Chip`s |
| Refresh / Rescan | `RefreshButton` | a `Button` + your own spinner |
| Load data for the selected account | `useAccountResource` + `AccountResourceGate` | `useEffect` + `useState` trio |
| Summary numbers | `StatRow` of `StatTile` | custom tiles |
| A content section | `Panel` + `PanelHeader` + `PanelBody` / `PanelFooter` | bordered `div`s |
| Filters above a list | `FilterBar` containing `SearchField` and `Picker`s | a raw `<select>`, an unlabelled `Input` |
| 2–3 mutually exclusive views | `Segmented` (in place) or `PageTabs` (whole page) | a row of toggle `Button`s |
| Lists longer than a page | `paginate()` + `Pager` | Previous/Next buttons |
| Nothing to show | `EmptyState` (inside a panel: `className="border-0 bg-transparent py-8"`) | a `<p>` |
| Something went wrong / needs attention | `Callout` (`danger`, `warning`, `info`, `success`) | red text |
| Progress toward a total | `ProgressBar` | a hand-drawn bar |
| An ID the user may need to copy | `KeyValue copyable` | plain text |
| Export to a file | `downloadJson` | a copy of the blob/anchor code |
| Settings rows | `FieldGroup` of `FieldRow` | a `label` + control |
| Items, one by one (finder, backpack, book) | `ItemCard` in `ItemCardGrid` | `ItemIcon` + text |
| Items by the hundred (vault shelves) | `ItemTile` | `ItemCard` |
| An item dialog | `Dialog` + `DetailHeader` + `DetailSection` + `PerkSlotRow` | a native `<dialog>` |
| A number that is the point of the page | `AnimatedNumber` (once per page) | animating every count |

## 2. Page anatomy

Every tool page, top to bottom:

1. `PageHeader`: the page title over the game's zone key art, bled to the
   pane edges (`art="twine-peaks"` etc.; picked from the title when
   omitted), a one- or two-sentence `description`, `status` badges and
   page-wide `actions` (usually `RefreshButton`). It must be the page's first
   element — it pulls itself up and out to the pane edges.
2. The gate: no account → error → loading (see §3).
3. `StatRow` — up to four numbers that answer "how am I doing?" first.
4. Panels. Filters sit in a `FilterBar` directly under the `PanelHeader` of
   the list they filter; pagination in the same panel's footer.
5. Caveats: one `text-xs text-muted-foreground` paragraph at the bottom
   stating data sources, what is estimated, and what the page does not do.

## 3. Loading data for an account

```tsx
const resource = useAccountResource((id) => window.electronAPI.requestThing(id), {
  owner: (result) => result.accountId,   // drop replies for another account
})
…
<AccountResourceGate icon={Icon} resource={resource} what="the thing">
  {(data) => <Contents data={data} key={data.accountId} />}
</AccountResourceGate>
```

- The hook is keyed on the account id: token refreshes do not refetch; an
  account switch clears the old data at once and discards late replies.
- **Filter and selection state lives in the child keyed by account id**, so
  switching account resets it without a line of reset code.
- During a refresh the last data stays on screen; only the button spins.
- `loading={{ title, description }}` when the wait is long enough to read —
  say what is happening ("Scanning four inventories…").
- IPC takes an account id, never an `AccountData`. The main process looks
  the account up; tokens never reach the renderer.

## 4. Words

- Sentence case everywhere: "Needs upgrading", not "Needs Upgrading".
- Options say what they mean alone: "All rarities", "Last week", "Off — keep
  everything". A `Picker`'s `label` is its accessible name; the visible text
  is the selected option.
- Error messages say what failed and what to do: "Could not load the
  backpack (HTTP 503). Try Refresh."
- Name the game's things as the game does: Collection Book, Storm Shield,
  F.O.R.T., Ventures. British spelling in prose ("favourite") matches the
  existing app.
- Never present an estimate as fact. Unknown is "unavailable", not 0; a
  derived level is "at least level 11".

## 5. Look: a game client, not a dashboard

- Group by tone, not by outline. A `Panel` is a fill one step off the page
  with no border; don't wrap every group in a bordered card.
- Stats are a line of figures (`StatRow`), not a row of boxed KPI tiles.
- Icons stand alone. No tinted icon squares, no gradient orbs, blurred
  blobs or watermarks, no uppercase letter-spaced eyebrows.
- Game art leads: zone art in headers, item art on cards, rarity as the
  colour system.
- Behave like a Windows window, not a web page. Controls and in-app links
  keep the arrow cursor. Menus fade and slide from their anchor, and dialogs
  settle from 105%; nothing pops from `zoom-in-95`. Right-click menus are
  native (`popupContextMenu`). Ctrl+wheel, pinch, file drops and link drags
  do nothing unless a component claims them (`src/lib/native-input.ts`).

## 6. Colour and type

- Colour comes from theme tokens (`text-primary`, `text-warning`,
  `bg-muted`, `border-border`…) or a named palette in config:
  rarity → `raritiesColor` (`config/constants/resources`),
  F.O.R.T. → `fortStats` (`config/constants/fortnite/fort`). No hex in pages.
- Rarity colour belongs to rarity. Common stays neutral on cards; the vault
  keeps its stricter Rare-and-up ladder.
- `StatTile accent` is for the one tile the page is about. A row where every
  tile is coloured has no emphasis left.
- Tones mean the same thing everywhere: `success` done/good, `warning` needs
  attention or is incomplete, `danger` failed or destructive, `accent`
  notable/selected, `neutral` a plain label.
- Type ranks: `micro-label` for captions and eyebrows, `section-label` for
  dialog sections, `figure` for every number (tabular), `text-xs` for
  hints.
- Sizes come from the named scale in `tailwind.config.js`, never
  `text-[…]`: `text-3xs` (9px, badges on art), `text-2xs` (10px),
  `text-caption` (11px), `text-xs` (12px, hints), `text-ui` (13px, dense
  body text and list rows), `text-sm` (14px), `text-title` (15px, small
  headings), `text-display-sm` / `text-display` / `text-display-lg` (22 /
  28 / 32px, page and hero titles). A new size goes in the config and in
  `cn`'s tailwind-merge list (`src/lib/utils.ts`), not in a page.
- Status colour is a token (`text-success`, `bg-warning/10`,
  `border-destructive/30`), never the Tailwind palette (`text-amber-400`).

## 7. Actions and safety

- Read-only tools say so (`ToolBadges readOnly`) and have no mutating
  control anywhere in their tree.
- An action that spends, recycles or changes an account asks twice: the
  button turns `destructive` and reads "Confirm — spends materials" on the
  first press (see `UpgradeActions` in `item-detail.tsx`).
- Only offer an action the server will accept: hide Level +1 at a tier cap,
  hide Evolve at tier 5. A button that always fails is worse than none.
- Destructive settings are worded by what they destroy
  (`RecycleCeilingPicker`: "Rare and below"), default off, and use the same
  control on every page they appear.

## 8. Accessibility

- Every control has an accessible name (`Picker label`, `SearchField
  label`, `aria-label` on icon-only buttons).
- Loading regions have `role="status"`, failures `role="alert"` — the gate
  does this for you.
- Clickable cards are buttons (`ItemCard onClick`) so they take focus and
  Enter; dialogs close on Escape (Radix does this).
- Progress is a `ProgressBar` (`role="progressbar"` with values).
- `AnimatedNumber` respects `prefers-reduced-motion`.

## 9. Adding a page

1. Route under `src/routes/<area>/<name>/` with a thin `-page.tsx` that
   re-exports the view; feature logic under `src/features/<name>/`.
2. Nav entry in `src/config/navigation.ts` (icon matches the page header;
   `beta: true` while unvalidated; `needsAccount` if it reads an account)
   and its label in `src/locales/en-US/sidebar.json`.
3. Pure model + tests first; main-process reader in `src/kernel/core/`;
   preload action; then the view from the kit.
4. `npx vitest run src/components/page` must pass. Besides the kit rules
   above it fails on: `text-[…]` sizes, Tailwind palette colours, a raw
   `Input` search, a hand-built refresh (`RefreshCw` outside
   `RefreshButton`), a bare `<h2>`, red-text errors, and a `toast()`
   without a tone (`toast.success` / `.error` / `.warning` / `.info`).
   Allow-lists in the test hold only files with a stated reason.
