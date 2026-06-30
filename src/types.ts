export type Wing = 'Red' | 'Pink' | 'Blue' | 'DkBlue';

export type DiceAreaType = 'values' | 'doubles' | 'triples' | 'straight' | 'any';

export interface DiceArea {
  type: DiceAreaType;
  values?: number[];    // for type 'values' — allowed die face values
  bracketed?: boolean;  // only 1 die per turn
  count?: number;       // for type 'straight' (e.g. 4 for Straight-4)
}

export type ActionType = 'Attack' | 'Counterattack' | 'Screen' | 'Bombard' | 'Command' | 'Absorb';
export type Requirement = 'Pair' | 'Two Pairs' | 'Triplet' | 'Two Triplets' | 'Full House' | 'Five Dice';

export interface FormationAction {
  actionType: ActionType;
  requirement?: Requirement;
  voluntary?: boolean;
  // Attack/Counterattack targets (ordered for Attack; any-matching for Screen/Counterattack)
  targets?: string[];
  // Hit effects
  hits?: number;           // fixed hits dealt to target
  hitsPerDie?: boolean;    // 1 hit per die on acting card
  bonusHits?: number;      // extra hits added on top of per-die (for "1 hit, PLUS 1 hit per die")
  selfHit?: boolean;       // acting formation loses 1 unit
  selfReduceHits?: number; // counterattack protection: reduce hits this formation takes
  absorb1Only?: boolean;   // absorb variant: takes 1 hit only instead of all
  // Command
  commandTarget?: string;
  // Special conditions
  conditionNotInReserve?: boolean;
  description: string;
}

export interface FormationCard {
  id: string;             // e.g. '07A', '01B', '217A'
  name: string;
  wing: Wing;
  strength: number;
  isSpecial: boolean;     // roman numeral → uses cubes
  specialMax?: number;    // max cubes (I=1, II=2, III=3)
  isStarred: boolean;     // double morale penalty on rout
  diceArea: DiceArea;
  actions: FormationAction[];
  retire?: boolean;
  reserve?: string;           // triggering formation name
  reserveCommanded?: boolean; // must be commanded out (not automatic)
  pursuit?: boolean;
  flavorText?: string;
  specialRuleText?: string;
  specialRuleId?: string;     // identifies engine-enforced special rules
  noDice?: boolean;           // card never accepts dice assignment (e.g. Rupert's Lifeguard)
}

export type GamePhase =
  | 'scenario-select'
  | 'action-phase'
  | 'awaiting-reaction'
  | 'roll-phase'
  | 'game-over';

export interface PendingAction {
  actingPlayerIndex: 0 | 1;
  formationId: string;
  actionIndex: number;
  targetFormationId?: string;
  hitsToApply: number;
  selfHitsToApply: number;
}

export interface ReactionOption {
  formationId: string;
  actionIndex: number;
  label: string;
}

export interface FormationState {
  cardId: string;
  unitsRemaining: number;
  cubesOnCard: number;
  diceOnCard: number[];
  isRouted: boolean;
  isRetired: boolean;
  hasPursued: boolean;
  inReserve: boolean;
  diceAddedThisRoll: number[]; // dice placed on this formation during the current roll phase
}

export interface PlayerState {
  factionName: string;
  morale: number;
  dicePool: number[];
  formations: FormationState[];
  diceAssignedToWings: Partial<Record<Wing, number>>; // wing → count of formations assigned
}

export interface GameState {
  phase: GamePhase;
  currentPlayerIndex: 0 | 1;
  skippedPlayerIndex: 0 | 1 | null; // which player will skip their next action phase (due to reacting)
  actionTakenThisTurn: boolean;
  pendingAction?: PendingAction;
  availableReactions: ReactionOption[];
  winner?: 0 | 1;
  winReason?: string;
  players: [PlayerState, PlayerState];
  log: string[];
  scenarioId: string;
}

export interface ScenarioSide {
  factionName: string;
  cardIds: string[];
  morale: number;
}

export interface Scenario {
  id: string;
  name: string;
  date: string;
  description: string;
  firstPlayer: ScenarioSide;
  secondPlayer: ScenarioSide;
  scenarioNumber: string;
  specialVictoryCondition?: 'plains-of-abraham';
}
