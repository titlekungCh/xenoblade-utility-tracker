// Game metadata, per-game tab order, and category display definitions.
// The big item lists live in web/data/<game>.json (catalogs). This file only
// describes HOW each category is shown + tracked, and which categories each
// game has, in what order.

// ---- Field types (per-row trackable controls) ----
//  check  : boolean toggle (absent/false = not done)
//  num    : number stepper (0..max); `doneAt` marks the "done" threshold
//  status : 3-state cycle  0 Not started / 1 In progress / 2 Done
//
// A category's `doneKey` names the field that decides completion %.

export const CATEGORY_DEFS = {
  monsters: {
    label: "Unique Monsters", icon: "🐲",
    doneKey: "killed",
    defaultSort: { key: "level", dir: "asc" },
    fields: [{ key: "killed", type: "check", label: "Killed" }],
    columns: [
      { key: "level", label: "Lv", cls: "num" },
      { key: "location", label: "Location" },
      { key: "soulhack", label: "Soul Hack" },
      { key: "dlc", label: "DLC" },
    ],
  },
  quests: {
    label: "Quests", icon: "📜",
    doneKey: "status", doneAt: 2,
    fields: [{ key: "status", type: "status", label: "Status" }],
    columns: [
      { key: "type", label: "Type" },
      { key: "location", label: "Location" },
      { key: "dlc", label: "DLC" },
    ],
  },
  heart2heart: {
    label: "Heart-to-Hearts", icon: "💬",
    doneKey: "viewed",
    fields: [{ key: "viewed", type: "check", label: "Viewed" }],
    columns: [
      { key: "characters", label: "Characters" },
      { key: "location", label: "Location" },
      { key: "dlc", label: "DLC" },
    ],
  },
  // XC1
  skilltrees: {
    label: "Skill Trees", icon: "🌳",
    doneKey: "complete",
    fields: [{ key: "complete", type: "check", label: "Maxed" }],
    columns: [
      { key: "character", label: "Character" },
      { key: "branch", label: "Branch" },
    ],
    groupBy: "character",
  },
  skillbooks: {
    label: "Skill Books", icon: "📕",
    doneKey: "unlocked",
    fields: [{ key: "unlocked", type: "check", label: "Unlocked" }],
    columns: [
      { key: "character", label: "Character" },
      { key: "source", label: "Source" },
    ],
    groupBy: "character",
  },
  // XCX / XC3
  classes: {
    label: "Classes", icon: "🎖️",
    doneKey: "mastered",
    fields: [
      { key: "unlocked", type: "check", label: "Unlocked" },
      { key: "rank", type: "num", label: "Rank", max: 10 },
      { key: "mastered", type: "check", label: "Mastered" },
    ],
    columns: [
      { key: "tree", label: "Tree/Line" },
      { key: "weapon", label: "Weapon" },
    ],
  },
  soulhack: {
    label: "Soul Hack Arts", icon: "💠",
    doneKey: "acquired",
    fields: [
      { key: "acquired", type: "check", label: "Acquired" },
      { key: "upgraded", type: "check", label: "Upgraded" },
    ],
    columns: [
      { key: "kind", label: "Type" },
      { key: "source", label: "From Monster" },
    ],
  },
  skells: {
    label: "Skells", icon: "🤖",
    doneKey: "acquired",
    fields: [{ key: "acquired", type: "check", label: "Acquired" }],
    columns: [
      { key: "frame", label: "Frame" },
      { key: "source", label: "Source" },
    ],
  },
  survey: {
    label: "Survey (Segments)", icon: "🛰️",
    doneKey: "surveyed",
    fields: [{ key: "surveyed", type: "check", label: "Surveyed" }],
    columns: [
      { key: "region", label: "Continent" },
      { key: "task", label: "Recon Task" },
    ],
    groupBy: "region",
  },
  // XC2
  blades: {
    label: "Blades", icon: "⚔️",
    doneKey: "complete",
    fields: [
      { key: "unlocked", type: "check", label: "Bonded" },
      { key: "complete", type: "check", label: "Chart 100%" },
    ],
    columns: [
      { key: "element", label: "Element" },
      { key: "rarity", label: "Rarity" },
      { key: "driver", label: "Driver" },
    ],
  },
  mercmissions: {
    label: "Merc Missions", icon: "🗺️",
    doneKey: "done",
    fields: [{ key: "done", type: "check", label: "Cleared" }],
    columns: [
      { key: "region", label: "Region" },
      { key: "kind", label: "Type" },
    ],
    groupBy: "region",
  },
  // Torna
  community: {
    label: "Community", icon: "🤝",
    doneKey: "registered",
    fields: [{ key: "registered", type: "check", label: "Registered" }],
    columns: [
      { key: "title", label: "Title" },
      { key: "location", label: "Location" },
    ],
  },
  // Future Connected
  ponspector: {
    label: "Ponspectors", icon: "🔍",
    doneKey: "recruited",
    fields: [{ key: "recruited", type: "check", label: "Recruited" }],
    columns: [
      { key: "number", label: "#", cls: "num" },
      { key: "location", label: "Location" },
    ],
  },
  // XC1 / XC1·FC / XCX
  collectopedia: {
    label: "Collectopedia", icon: "📔",
    doneKey: "collected",
    fields: [{ key: "collected", type: "check", label: "Collected" }],
    columns: [
      { key: "category", label: "Category" },
      { key: "area", label: "Area" },
    ],
    groupBy: "area",
  },
  // XC1 / XCX — ground (player-worn) armour appearances
  fashiongear: {
    label: "Fashion Gear", icon: "👕",
    doneKey: "unlocked",
    fields: [{ key: "unlocked", type: "check", label: "Unlocked" }],
    columns: [
      { key: "type", label: "Class" },
      { key: "source", label: "Source" },
    ],
    groupBy: "group",
  },
  // XCX — Skell (mech) armour, tracked separately from player ground armour
  skellarmor: {
    label: "Skell Armor", icon: "🚀",
    doneKey: "unlocked",
    fields: [{ key: "unlocked", type: "check", label: "Unlocked" }],
    columns: [
      { key: "type", label: "Class" },
      { key: "source", label: "Source" },
    ],
    groupBy: "group",
  },
  // XC3
  soultree: {
    label: "Ouroboros Soul Tree", icon: "🔮",
    doneKey: "unlocked",
    fields: [{ key: "unlocked", type: "check", label: "Unlocked" }],
    columns: [
      { key: "kind", label: "Type" },
      { key: "effect", label: "Effect" },
    ],
    groupBy: "character",
  },
  // XC3 / XC3·FR — custom renderer (gem + per-resource farm tracking)
  gems: {
    label: "Gems (Tier X)", icon: "💎",
    render: "gems",
    doneKey: "crafted",
    fields: [{ key: "crafted", type: "check", label: "Tier X Crafted" }],
    columns: [
      { key: "category", label: "Category" },
      { key: "effect", label: "Effect" },
    ],
  },
};

// A "campaign" is one entry in the top switcher. Base games and their DLC
// expansions are SEPARATE campaigns that share a catalog file (`data`) but are
// filtered by `dlc` ("" = base game, else the expansion's dlc tag). Progress is
// keyed by the campaign id, so base and DLC ticks never mix.
//   `cats`   — candidate category tabs (after Dashboard); a tab is shown only if
//              it actually has items for this campaign's `dlc` (so DLC campaigns
//              auto-show just the categories that have expansion content).
//   `accent` — themes the top bar + progress bars.
// A campaign only shows a cat that has items for its dlc, so listing a DLC-only
// cat here (e.g. ponspector for FC, community for Torna) is safe: the base game
// hides it automatically.
const XC1_CATS = ["monsters", "quests", "heart2heart", "skilltrees", "skillbooks", "collectopedia", "fashiongear", "ponspector"];
const XCX_CATS = ["monsters", "quests", "heart2heart", "classes", "skells", "survey", "collectopedia", "fashiongear", "skellarmor"];
const XC2_CATS = ["monsters", "quests", "heart2heart", "blades", "mercmissions", "community"];
const XC3_CATS = ["monsters", "quests", "heart2heart", "classes", "soulhack", "soultree", "gems"];

export const CAMPAIGNS = {
  xc1: {
    id: "xc1", data: "xc1", dlc: "", name: "Xenoblade Chronicles 1",
    short: "XC1", accent: "#3f7fb0", cats: XC1_CATS,
  },
  "xc1-fc": {
    id: "xc1-fc", data: "xc1", dlc: "Future Connected", name: "XC1 · Future Connected",
    short: "Future Connected", accent: "#6fb0c8", cats: XC1_CATS,
  },
  xcx: {
    id: "xcx", data: "xcx", dlc: "", name: "Xenoblade Chronicles X",
    short: "XCX", accent: "#5aa0a0", cats: XCX_CATS,
  },
  xc2: {
    id: "xc2", data: "xc2", dlc: "", name: "Xenoblade Chronicles 2",
    short: "XC2", accent: "#c79a3a", cats: XC2_CATS,
  },
  "xc2-torna": {
    id: "xc2-torna", data: "xc2", dlc: "Torna", name: "XC2 · Torna ~ The Golden Country",
    short: "Torna", accent: "#d8772f", cats: XC2_CATS,
  },
  xc3: {
    id: "xc3", data: "xc3", dlc: "", name: "Xenoblade Chronicles 3",
    short: "XC3", accent: "#c0392b", cats: XC3_CATS,
  },
  "xc3-fr": {
    id: "xc3-fr", data: "xc3", dlc: "Future Redeemed", name: "XC3 · Future Redeemed",
    short: "Future Redeemed", accent: "#9b59b6", cats: XC3_CATS,
  },
};

// Base game first, its DLC right after it.
export const CAMPAIGN_ORDER = ["xc1", "xc1-fc", "xcx", "xc2", "xc2-torna", "xc3", "xc3-fr"];
