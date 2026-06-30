import type {
  GameState, PlayerState, FormationState, Wing,
  PendingAction, ReactionOption, FormationAction, DiceArea,
} from '../types';
import { getCard } from '../data/cards';
import { SCENARIOS } from '../data/scenarios';

export type GameAction =
  | { type: 'SELECT_SCENARIO'; scenarioId: string }
  | { type: 'ROLL_DICE' }
  | { type: 'ASSIGN_DICE'; diePoolIndices: number[]; formationId: string }
  | { type: 'RETURN_DIE'; formationId: string; dieIndex: number }
  | { type: 'END_ROLL_PHASE' }
  | { type: 'TAKE_ACTION'; formationId: string; actionIndex: number }
  | { type: 'TAKE_REACTION'; formationId: string; actionIndex: number }
  | { type: 'NO_REACTION' }
  | { type: 'PASS_ACTION' }
  | { type: 'RETIRE'; formationId: string }
  | { type: 'RESTART' };

// ── helpers ─────────────────────────────────────────────────────────────────

function makeFreshFormation(cardId: string): FormationState {
  const card = getCard(cardId);
  return {
    cardId,
    unitsRemaining: card.isSpecial ? 0 : card.strength,
    cubesOnCard: card.isSpecial ? 1 : 0,
    diceOnCard: [],
    isRouted: false,
    isRetired: false,
    hasPursued: false,
    inReserve: !!card.reserve,
    diceAddedThisRoll: [],
  };
}

function isActive(f: FormationState) {
  return !f.isRouted && !f.isRetired && !f.hasPursued;
}

function isPlayable(f: FormationState) {
  return isActive(f) && !f.inReserve;
}

/**
 * Validate that a set of new dice can be assigned to a formation given existing dice already there.
 * Doubles/Triples/Straight require the full pattern to be complete after adding the new dice.
 * Values/Any accept any count of valid dice.
 */
function validateDiceSetForArea(
  newDice: number[],
  existingDice: number[],
  diceArea: DiceArea,
): boolean {
  if (newDice.length === 0) return false;
  const allDice = [...existingDice, ...newDice];

  switch (diceArea.type) {
    case 'values': {
      if (!newDice.every(d => diceArea.values!.includes(d))) return false;
      if (diceArea.bracketed) return existingDice.length === 0 && newDice.length === 1;
      return true;
    }
    case 'any':
      return true;
    case 'doubles': {
      if (allDice.length !== 2) return false;
      return allDice[0] === allDice[1];
    }
    case 'triples': {
      if (allDice.length !== 3) return false;
      return allDice.every(d => d === allDice[0]);
    }
    case 'straight': {
      const count = diceArea.count!;
      if (allDice.length !== count) return false;
      const sorted = [...allDice].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) return false;
      }
      return true;
    }
  }
}

/** How many cards in the given wing have already received dice this roll phase? */
function wingAssignmentCount(player: PlayerState, wing: Wing): number {
  return player.formations.filter(f => {
    const c = getCard(f.cardId);
    return c.wing === wing && f.diceAddedThisRoll.length > 0;
  }).length;
}

/** Maximum cards allowed per wing this roll phase (accounting for special cards). */
function maxWingAssignments(playerIndex: 0 | 1, state: GameState, wing: Wing): number {
  const player = state.players[playerIndex];
  let max = 1;

  for (const f of player.formations) {
    if (!isPlayable(f)) continue;
    const card = getCard(f.cardId);
    if (card.specialRuleId === 'king-richard-iii' || card.specialRuleId === 'villars') {
      // TWO Blue + ONE DkBlue cards per turn
      if (wing === 'Blue') max = Math.max(max, 2);
      if (wing === 'DkBlue') max = Math.max(max, 1);
    }
    if (card.specialRuleId === 'wolfe' || card.specialRuleId === 'montcalm') {
      // +1 extra card (any wing) — effectively 2 per wing if they have only 1 wing
      max = Math.max(max, 2);
    }
  }
  return max;
}

/** Find the current attack target: first alive (not routed/retired) formation in the targets list. */
function findAttackTarget(
  targets: string[],
  opponentFormations: FormationState[],
  skipInReserve = false,
): FormationState | undefined {
  for (const targetName of targets) {
    const found = opponentFormations.find(f => {
      if (!isActive(f)) return false;
      if (skipInReserve && f.inReserve) return false;
      return getCard(f.cardId).name === targetName;
    });
    if (found) return found;
  }
  return undefined;
}

/**
 * Check if dice on a normal formation satisfy the dice area's minimum pattern.
 * Doubles needs 2 matching, Triples needs 3 matching, Straight-N needs N consecutive.
 * Values and Any just need at least 1 die (placement rules already ensure correct values).
 */
function meetsDiceAreaMinimum(diceArea: DiceArea, diceOnCard: number[]): boolean {
  switch (diceArea.type) {
    case 'values':
    case 'any':
      return diceOnCard.length >= 1;
    case 'doubles': {
      if (diceOnCard.length < 2) return false;
      return Object.values(diceFreq(diceOnCard)).some(c => c >= 2);
    }
    case 'triples': {
      if (diceOnCard.length < 3) return false;
      return Object.values(diceFreq(diceOnCard)).some(c => c >= 3);
    }
    case 'straight': {
      const count = diceArea.count!;
      if (diceOnCard.length < count) return false;
      const sorted = [...diceOnCard].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) return false;
      }
      return true;
    }
  }
}

/** Check if a formation has enough dice/cubes to take an action. */
function meetsRequirement(action: FormationAction, formation: FormationState): boolean {
  const card = getCard(formation.cardId);
  if (card.isSpecial) {
    return formation.cubesOnCard >= 1;
  }
  if (formation.diceOnCard.length === 0) return false;
  // Dice area minimum: Doubles needs 2 matching, Triples needs 3, Straight-N needs N consecutive
  if (!meetsDiceAreaMinimum(card.diceArea, formation.diceOnCard)) return false;
  const dice = formation.diceOnCard;
  const req = action.requirement;
  if (!req) return true;

  switch (req) {
    case 'Pair': {
      const counts = diceFreq(dice);
      return Object.values(counts).some(c => c >= 2);
    }
    case 'Two Pairs': {
      const counts = diceFreq(dice);
      return Object.values(counts).filter(c => c >= 2).length >= 2;
    }
    case 'Triplet': {
      const counts = diceFreq(dice);
      return Object.values(counts).some(c => c >= 3);
    }
    case 'Two Triplets': {
      const counts = diceFreq(dice);
      return Object.values(counts).filter(c => c >= 3).length >= 2;
    }
    case 'Full House': {
      const counts = diceFreq(dice);
      const vals = Object.entries(counts);
      const hasPair = vals.some(([, c]) => c >= 2);
      const hasTriplet = vals.some(([, c]) => c >= 3);
      return hasPair && hasTriplet && vals.filter(([, c]) => c >= 2).length >= 2;
    }
    case 'Five Dice':
      return dice.length >= 5;
  }
}

function diceFreq(dice: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const d of dice) counts[d] = (counts[d] ?? 0) + 1;
  return counts;
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Compute hits an attack deals to the target. */
function computeAttackHits(action: FormationAction, formation: FormationState): number {
  let hits = action.hits ?? 0;
  if (action.hitsPerDie) {
    const diceCount = getCard(formation.cardId).isSpecial ? 0 : formation.diceOnCard.length;
    hits += diceCount;
  }
  if (action.bonusHits) hits += action.bonusHits;
  return hits;
}

/** Compute self-hits the acting formation takes. */
function computeSelfHits(action: FormationAction): number {
  return action.selfHit ? 1 : 0;
}

/** Apply N hits to a formation. Returns new unitsRemaining (clamped to 0). */
function applyDamageToFormation(f: FormationState, hits: number, card = getCard(f.cardId)): FormationState {
  // Maryland 400 special rule: always -1 hit, max 1 hit per attack
  if (card.specialRuleId === 'maryland-400') {
    hits = Math.min(1, Math.max(0, hits - 1));
  }
  return {
    ...f,
    unitsRemaining: Math.max(0, f.unitsRemaining - hits),
  };
}

/** Mark a formation as routed and return its dice to pool. */
function routeFormation(player: PlayerState, formationId: string): { player: PlayerState; moraleLost: number } {
  const idx = player.formations.findIndex(f => f.cardId === formationId);
  if (idx === -1) return { player, moraleLost: 0 };
  const f = player.formations[idx];
  const card = getCard(f.cardId);
  const moraleLost = card.isStarred ? 2 : 1;
  const returnedDice = [...f.diceOnCard];
  const newFormations = player.formations.map((fm, i) =>
    i === idx ? { ...fm, isRouted: true, diceOnCard: [], diceAddedThisRoll: [] } : fm
  );
  return {
    player: { ...player, formations: newFormations, dicePool: [...player.dicePool, ...returnedDice] },
    moraleLost,
  };
}

/** Release formations that were in reserve behind formationName. */
function releaseReserves(player: PlayerState, triggerName: string): PlayerState {
  const updated = player.formations.map(f => {
    if (!f.inReserve) return f;
    const card = getCard(f.cardId);
    if (card.reserve === triggerName && !card.reserveCommanded) {
      return { ...f, inReserve: false };
    }
    return f;
  });
  return { ...player, formations: updated };
}

/** Process routing for a formation in a player's army. Handles cascade effects. */
function processRouting(
  state: GameState,
  routingPlayerIndex: 0 | 1,
  formationId: string,
  simultaneous = false,
): GameState {
  const routingPlayer = state.players[routingPlayerIndex];
  const opponentIndex = (1 - routingPlayerIndex) as 0 | 1;
  const opponent = state.players[opponentIndex];

  const routedCard = getCard(formationId);
  const { player: newRoutingPlayer, moraleLost } = routeFormation(routingPlayer, formationId);

  let log = [...state.log, `${routedCard.name} has been Routed!`];
  let moraleChange = simultaneous ? 0 : moraleLost;

  // Transfer morale cubes: routing side loses, opponent gains
  const newRoutingMorale = newRoutingPlayer.morale;
  let opponentMorale = opponent.morale + (simultaneous ? 0 : moraleLost);
  let routingMorale = newRoutingMorale;
  if (moraleChange > 0) {
    log = [...log, `${routingPlayer.factionName} loses ${moraleChange} Morale. Opponent gains ${moraleChange} Morale.`];
  }

  // Release reserves that were behind this formation
  let updatedRoutingPlayer = releaseReserves(newRoutingPlayer, routedCard.name);

  // Check for Stanleys special rule
  const stanleys = updatedRoutingPlayer.formations.find(f => {
    const c = getCard(f.cardId);
    return c.specialRuleId === 'the-stanleys' && !f.inReserve && !f.isRouted;
  });
  if (stanleys && routedCard.name === 'Northumberland') {
    // Stanleys doesn't cause Northumberland to rout (Stanleys causes Northumberland to rout, not the other way)
    // This is handled when The Stanleys come out of reserve
  }

  // Check if Rupert's Lifeguard should intercept this routing
  const lifeguard = updatedRoutingPlayer.formations.find(f => {
    const c = getCard(f.cardId);
    return c.specialRuleId === 'rupert-lifeguard' && f.cubesOnCard >= 1;
  });
  if (lifeguard && (routedCard.name === 'Northern Horse' || routedCard.name === 'Byron')) {
    // Intercept: formation doesn't rout, lifeguard is removed
    const lIdx = updatedRoutingPlayer.formations.findIndex(f => f.cardId === lifeguard.cardId);
    const fIdx = updatedRoutingPlayer.formations.findIndex(f => f.cardId === formationId);
    const formations = updatedRoutingPlayer.formations.map((f, i) => {
      if (i === fIdx) return { ...f, isRouted: false, unitsRemaining: 1 };
      if (i === lIdx) return { ...f, isRouted: true, cubesOnCard: 0 };
      return f;
    });
    updatedRoutingPlayer = { ...updatedRoutingPlayer, formations };
    log = [...log, `Rupert's Lifeguard intercepts! ${routedCard.name} survives with 1 unit.`];
    moraleChange = 0;
    opponentMorale = opponent.morale;
    routingMorale = newRoutingPlayer.morale;
    // Don't further process routing
    const newPlayers: [PlayerState, PlayerState] = routingPlayerIndex === 0
      ? [updatedRoutingPlayer, { ...opponent, morale: opponentMorale }]
      : [{ ...opponent, morale: opponentMorale }, updatedRoutingPlayer];
    return checkWin({ ...state, players: newPlayers, log });
  }

  updatedRoutingPlayer = { ...updatedRoutingPlayer, morale: routingMorale };

  // Check for Pursuit: opponent formations that must pursue this routed formation
  let updatedOpponent = { ...opponent, morale: opponentMorale };
  for (const oppFormation of updatedOpponent.formations) {
    if (!isPlayable(oppFormation) || !getCard(oppFormation.cardId).pursuit) continue;
    const card = getCard(oppFormation.cardId);
    const attackTargets = card.actions.find(a => a.actionType === 'Attack')?.targets ?? [];
    if (attackTargets.includes(routedCard.name)) {
      // This formation must pursue
      const returnedDice = [...oppFormation.diceOnCard];
      updatedOpponent = {
        ...updatedOpponent,
        formations: updatedOpponent.formations.map(f =>
          f.cardId === oppFormation.cardId
            ? { ...f, hasPursued: true, diceOnCard: [], diceAddedThisRoll: [] }
            : f
        ),
        dicePool: [...updatedOpponent.dicePool, ...returnedDice],
      };
      // Release opponent reserves triggered by this pursuit
      updatedOpponent = releaseReserves(updatedOpponent, card.name);
      log = [...log, `${card.name} pursues ${routedCard.name} and leaves play.`];
    }
  }

  const newPlayers: [PlayerState, PlayerState] = routingPlayerIndex === 0
    ? [updatedRoutingPlayer, updatedOpponent]
    : [updatedOpponent, updatedRoutingPlayer];

  return checkWin({ ...state, players: newPlayers, log });
}

/** Find Screen reactions available from defender's formations. */
function findScreenReactions(
  attackerName: string,
  defenderFormations: FormationState[],
): ReactionOption[] {
  const reactions: ReactionOption[] = [];
  for (const f of defenderFormations) {
    if (!isPlayable(f)) continue;
    const card = getCard(f.cardId);
    if (card.isSpecial && f.cubesOnCard === 0) continue;
    if (!card.isSpecial && f.diceOnCard.length === 0) continue;

    card.actions.forEach((a, idx) => {
      if (a.actionType !== 'Screen') return;
      if (!a.targets) return;
      const matches = a.targets.includes('Any') || a.targets.includes(attackerName);
      if (!matches) return;
      if (a.requirement && !meetsRequirement(a, f)) return;
      reactions.push({
        formationId: f.cardId,
        actionIndex: idx,
        label: `${card.name}: Screen (cancels attack)`,
      });
    });
  }
  return reactions;
}

/** Find Counterattack reactions available from the target formation. */
function findCounterattackReactions(
  attackerName: string,
  targetFormation: FormationState,
): ReactionOption[] {
  const reactions: ReactionOption[] = [];
  const card = getCard(targetFormation.cardId);
  if (!isPlayable(targetFormation) || targetFormation.diceOnCard.length === 0) return reactions;

  card.actions.forEach((a, idx) => {
    if (a.actionType !== 'Counterattack') return;
    const targets = a.targets ?? [];
    const matches = targets.includes('Any') || targets.includes(attackerName);
    if (!matches) return;
    if (a.requirement && !meetsRequirement(a, targetFormation)) return;
    // Check english-fleet suppression
    reactions.push({
      formationId: targetFormation.cardId,
      actionIndex: idx,
      label: `${card.name}: Counterattack (${a.description})`,
    });
  });
  return reactions;
}

/** Find Absorb reactions available from defender's formations. */
function findAbsorbReactions(
  targetName: string,
  defenderFormations: FormationState[],
): ReactionOption[] {
  const reactions: ReactionOption[] = [];
  for (const f of defenderFormations) {
    if (!isPlayable(f)) continue;
    const card = getCard(f.cardId);
    if (f.diceOnCard.length === 0) return reactions;

    card.actions.forEach((a, idx) => {
      if (a.actionType !== 'Absorb') return;
      const targets = a.targets ?? [];
      const matches = targets.includes('Any') || targets.includes(targetName);
      if (!matches) return;
      if (a.requirement && !meetsRequirement(a, f)) return;
      reactions.push({
        formationId: f.cardId,
        actionIndex: idx,
        label: `${card.name}: Absorb (take hits instead)${a.absorb1Only ? ' — 1 hit only' : ''}`,
      });
    });
  }
  return reactions;
}

function checkWin(state: GameState): GameState {
  // Check morale
  for (let i = 0; i < 2; i++) {
    if (state.players[i].morale <= 0 && state.players[1 - i].morale > 0) {
      return {
        ...state,
        phase: 'game-over',
        winner: (1 - i) as 0 | 1,
        winReason: `${state.players[i].factionName} ran out of Morale!`,
      };
    }
  }
  if (state.players[0].morale <= 0 && state.players[1].morale <= 0) {
    // Both at 0 — whoever caused it wins (handled by simultaneous rout rules)
    // Treat as draw (shouldn't normally happen)
    return state;
  }

  // Plains of Abraham special: British wins by routing all 3 French normal formations
  const scenario = SCENARIOS.find(s => s.id === state.scenarioId);
  if (scenario?.specialVictoryCondition === 'plains-of-abraham') {
    return checkPlainsOfAbrahamWin(state);
  }

  // Check "no attacks possible" for the current player's OPPONENT at start of their turn
  // This check is done at the start of each player's action phase (handled elsewhere)
  return state;
}

function checkPlainsOfAbrahamWin(state: GameState): GameState {
  // British (player 0) wins by routing all 3 French normal formations (not Montcalm) without losing any
  // French win if any of their normal formations routes, OR if British loses any formation
  const british = state.players[0];
  const french = state.players[1];

  const britishLost = british.formations.some(f => !getCard(f.cardId).isSpecial && !isActive(f));
  const frenchNormal = french.formations.filter(f => !getCard(f.cardId).isSpecial);
  const allFrenchRouted = frenchNormal.every(f => !isActive(f));
  const anyFrenchRouted = frenchNormal.some(f => !isActive(f));

  if (britishLost || anyFrenchRouted) {
    // Whoever achieved this wins
    if (britishLost && !anyFrenchRouted) {
      return { ...state, phase: 'game-over', winner: 1, winReason: 'A British formation was lost! French win.' };
    }
    if (anyFrenchRouted && !britishLost) {
      return { ...state, phase: 'game-over', winner: 0, winReason: 'All French formations routed! British win.' };
    }
    if (anyFrenchRouted && britishLost) {
      // Simultaneous — French win (they rout and that's their win condition)
      return { ...state, phase: 'game-over', winner: 1, winReason: 'A British formation was lost! French win.' };
    }
  }
  if (allFrenchRouted) {
    return { ...state, phase: 'game-over', winner: 0, winReason: 'All French formations routed! British win.' };
  }
  return state;
}

function checkNoAttacksPossibleWin(state: GameState): GameState {
  // At the beginning of a player's turn, check if they can ever attack
  const i = state.currentPlayerIndex;
  const opponentIndex = (1 - i) as 0 | 1;
  const myFormations = state.players[i].formations.filter(isPlayable);
  const opponentFormations = state.players[opponentIndex].formations;

  const canAttack = myFormations.some(f => {
    const card = getCard(f.cardId);
    return card.actions.some(a => {
      if (a.actionType !== 'Attack') return false;
      const targets = a.targets ?? [];
      return targets.some(t => opponentFormations.some(of => isActive(of) && getCard(of.cardId).name === t));
    });
  });

  if (!canAttack) {
    return {
      ...state,
      phase: 'game-over',
      winner: opponentIndex,
      winReason: `${state.players[i].factionName} can no longer attack any enemy formation!`,
    };
  }
  return state;
}

// ── Scenario Initialization ──────────────────────────────────────────────────

function initializeScenario(scenarioId: string): GameState {
  const scenario = SCENARIOS.find(s => s.id === scenarioId)!;

  const p0Formations = scenario.firstPlayer.cardIds.map(makeFreshFormation);
  const p1Formations = scenario.secondPlayer.cardIds.map(makeFreshFormation);

  // The Fog: starts with 3 cubes
  for (const f of [...p0Formations, ...p1Formations]) {
    const card = getCard(f.cardId);
    if (card.specialRuleId === 'the-fog') {
      f.cubesOnCard = 3;
    }
  }

  const state: GameState = {
    phase: 'action-phase',
    currentPlayerIndex: 0,
    skippedPlayerIndex: null,
    actionTakenThisTurn: false,
    availableReactions: [],
    players: [
      {
        factionName: scenario.firstPlayer.factionName,
        morale: scenario.firstPlayer.morale,
        dicePool: [],
        formations: p0Formations,
        diceAssignedToWings: {},
      },
      {
        factionName: scenario.secondPlayer.factionName,
        morale: scenario.secondPlayer.morale,
        dicePool: [],
        formations: p1Formations,
        diceAssignedToWings: {},
      },
    ],
    log: [
      `Battle begins: ${scenario.name}`,
      `${scenario.firstPlayer.factionName} goes first.`,
    ],
    scenarioId,
  };

  return checkNoAttacksPossibleWin(state);
}

// ── Roll Phase ────────────────────────────────────────────────────────────────

function handleRollDice(state: GameState): GameState {
  const pi = state.currentPlayerIndex;
  const player = state.players[pi];
  // Roll fresh dice for pool
  const totalDice = 6;
  const existing = player.formations.reduce((acc, f) => acc + f.diceOnCard.length, 0);
  const poolSize = totalDice - existing;
  const rolledPool = Array.from({ length: poolSize }, rollDie);

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = { ...player, dicePool: rolledPool };
  return {
    ...state,
    players: newPlayers,
    log: [...state.log, `${player.factionName} rolls ${rolledPool.join(', ')}`],
  };
}

function handleAssignDice(state: GameState, diePoolIndices: number[], formationId: string): GameState {
  if (!canAssignDiceSet(state, state.currentPlayerIndex, diePoolIndices, formationId)) return state;

  const pi = state.currentPlayerIndex;
  const player = state.players[pi];
  const fIdx = player.formations.findIndex(f => f.cardId === formationId);
  const card = getCard(formationId);
  const dies = diePoolIndices.map(i => player.dicePool[i]);

  const newPool = player.dicePool.filter((_, i) => !diePoolIndices.includes(i));

  if (card.isSpecial) {
    const newFormations = player.formations.map((f, i) =>
      i === fIdx
        ? { ...f, cubesOnCard: f.cubesOnCard + 1, diceAddedThisRoll: [...f.diceAddedThisRoll, ...dies] }
        : f
    );
    const newPlayers = [...state.players] as [PlayerState, PlayerState];
    newPlayers[pi] = { ...player, dicePool: newPool, formations: newFormations };
    return { ...state, players: newPlayers };
  }

  const newFormations = player.formations.map((f, i) =>
    i === fIdx
      ? { ...f, diceOnCard: [...f.diceOnCard, ...dies], diceAddedThisRoll: [...f.diceAddedThisRoll, ...dies] }
      : f
  );
  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = { ...player, dicePool: newPool, formations: newFormations };
  return { ...state, players: newPlayers };
}

function handleReturnDie(state: GameState, formationId: string, dieIndex: number): GameState {
  const pi = state.currentPlayerIndex;
  const player = state.players[pi];
  const fIdx = player.formations.findIndex(f => f.cardId === formationId);
  if (fIdx === -1) return state;
  const formation = player.formations[fIdx];
  const die = formation.diceOnCard[dieIndex];
  if (die === undefined) return state;

  const newFormations = player.formations.map((f, i) =>
    i === fIdx
      ? {
          ...f,
          diceOnCard: f.diceOnCard.filter((_, j) => j !== dieIndex),
          diceAddedThisRoll: f.diceAddedThisRoll.filter((_, j) => j !== dieIndex),
        }
      : f
  );

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = {
    ...player,
    formations: newFormations,
    dicePool: [...player.dicePool, die],
  };
  return { ...state, players: newPlayers };
}

function handleEndRollPhase(state: GameState): GameState {
  const pi = state.currentPlayerIndex;
  const nextPi = (1 - pi) as 0 | 1;

  // Discard unassigned pool dice and clear roll-phase tracking
  const clearRoll = (player: PlayerState): PlayerState => ({
    ...player,
    dicePool: [],
    formations: player.formations.map(f => ({ ...f, diceAddedThisRoll: [] })),
    diceAssignedToWings: {},
  });

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = clearRoll(newPlayers[pi]);

  const nextPlayer = newPlayers[nextPi];
  // Skip next player's action phase if they reacted last turn
  const skipped = state.skippedPlayerIndex === nextPi;

  let nextState: GameState = {
    ...state,
    players: newPlayers,
    currentPlayerIndex: nextPi,
    // Keep skippedPlayerIndex so the reactor sees the message during their roll phase,
    // then clear it on their subsequent end-roll (at that point nextPi won't match)
    skippedPlayerIndex: skipped ? nextPi : null,
    actionTakenThisTurn: false,
    phase: skipped ? 'roll-phase' : 'action-phase',
    log: [...state.log, `${nextPlayer.factionName}'s turn begins.`],
  };

  // Check "no attacks possible" at start of action phase
  if (!skipped) {
    nextState = checkNoAttacksPossibleWin(nextState);
  }

  return nextState;
}

// ── Action Phase ─────────────────────────────────────────────────────────────

function handlePassAction(state: GameState): GameState {
  const pi = state.currentPlayerIndex;
  return {
    ...state,
    phase: 'roll-phase',
    log: [...state.log, `${state.players[pi].factionName} passes their action.`],
  };
}

function handleRetire(state: GameState, formationId: string): GameState {
  const pi = state.currentPlayerIndex;
  const player = state.players[pi];
  const fIdx = player.formations.findIndex(f => f.cardId === formationId);
  if (fIdx === -1) return state;
  const formation = player.formations[fIdx];
  const card = getCard(formationId);
  if (!card.retire || !isPlayable(formation)) return state;

  let newPlayer: PlayerState = {
    ...player,
    formations: player.formations.map((f, i) =>
      i === fIdx ? { ...f, isRetired: true, diceOnCard: [], diceAddedThisRoll: [] } : f
    ),
  };
  newPlayer = releaseReserves(newPlayer, card.name);

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = newPlayer;

  const released = newPlayer.formations.filter(
    f => !player.formations.find(p => p.cardId === f.cardId && !p.inReserve) && !f.inReserve
  );
  const releaseMsg = released.length > 0
    ? ` ${released.map(f => getCard(f.cardId).name).join(', ')} enters from reserve.`
    : '';

  return {
    ...state,
    players: newPlayers,
    phase: 'roll-phase',
    log: [...state.log, `${card.name} retires from the field.${releaseMsg}`],
  };
}

function handleTakeAction(state: GameState, formationId: string, actionIndex: number): GameState {
  const pi = state.currentPlayerIndex;
  const oppIdx = (1 - pi) as 0 | 1;
  const player = state.players[pi];

  const fIdx = player.formations.findIndex(f => f.cardId === formationId);
  if (fIdx === -1) return state;
  const formation = player.formations[fIdx];
  if (!isPlayable(formation)) return state;

  const card = getCard(formationId);
  if (actionIndex >= card.actions.length) return state;
  const action = card.actions[actionIndex];

  const isReactiveAction = action.actionType === 'Screen'
    || action.actionType === 'Counterattack'
    || action.actionType === 'Absorb';

  // Null action: requirement not met, OR reactive action dispatched in action phase
  // (Screen/Counterattack/Absorb can never be taken proactively, so the only
  // thing the player can do with dice on such a card is clear them this way)
  if (!meetsRequirement(action, formation) || isReactiveAction) {
    const hasDice = card.isSpecial ? formation.cubesOnCard > 0 : formation.diceOnCard.length > 0;
    if (!hasDice) return state;
    const nullPlayers = [...state.players] as [PlayerState, PlayerState];
    nullPlayers[pi] = clearFormationDice(nullPlayers[pi], fIdx, card.isSpecial);
    return {
      ...state,
      players: nullPlayers,
      phase: 'roll-phase',
      log: [...state.log, `${player.factionName} clears dice from ${card.name} (null action).`],
    };
  }
  if (card.isSpecial && formation.cubesOnCard === 0) return state;
  if (!card.isSpecial && formation.diceOnCard.length === 0) return state;

  switch (action.actionType) {
    case 'Attack':
      return handleAttack(state, pi, oppIdx, formation, fIdx, action, actionIndex);
    case 'Bombard':
      return handleBombard(state, pi, oppIdx, formation, fIdx, action);
    case 'Command':
      return handleCommand(state, pi, formation, fIdx, action);
    case 'Screen':
    case 'Counterattack':
    case 'Absorb':
      return state; // unreachable now, but kept for exhaustiveness
  }
}

function clearFormationDice(
  player: PlayerState,
  fIdx: number,
  isSpecial: boolean,
): PlayerState {
  if (isSpecial) {
    const newFormations = player.formations.map((fm, i) =>
      i === fIdx ? { ...fm, cubesOnCard: fm.cubesOnCard - 1 } : fm
    );
    return { ...player, formations: newFormations };
  }
  // Expended dice are discarded, not returned to the pool
  const newFormations = player.formations.map((fm, i) =>
    i === fIdx ? { ...fm, diceOnCard: [], diceAddedThisRoll: [] } : fm
  );
  return { ...player, formations: newFormations };
}

function handleAttack(
  state: GameState,
  pi: 0 | 1,
  oppIdx: 0 | 1,
  formation: FormationState,
  _fIdx: number,
  action: FormationAction,
  actionIndex: number,
): GameState {
  const card = getCard(formation.cardId);
  const opponent = state.players[oppIdx];

  // Find target
  const targets = action.targets ?? [];
  const skipInReserve = action.conditionNotInReserve ?? false;
  const targetFormation = findAttackTarget(targets, opponent.formations, skipInReserve);
  if (!targetFormation) {
    // All targets removed — null action: clear dice and proceed
    const fIdx = state.players[pi].formations.findIndex(f => f.cardId === formation.cardId);
    const nullPlayers = [...state.players] as [PlayerState, PlayerState];
    nullPlayers[pi] = clearFormationDice(nullPlayers[pi], fIdx, card.isSpecial);
    return {
      ...state,
      players: nullPlayers,
      phase: 'roll-phase',
      log: [...state.log, `${card.name} has no valid targets — dice cleared.`],
    };
  }

  const targetCard = getCard(targetFormation.cardId);

  // Special: De Castelnau can't attack in-reserve target
  if (action.conditionNotInReserve && targetFormation.inReserve) return state;

  // Special: Sulla gets extra hit if The Fourth Line is in play
  let extraHits = 0;
  if (card.specialRuleId === 'sulla' && targets.includes('Pompey')) {
    const fourthLine = state.players[pi].formations.find(f =>
      getCard(f.cardId).name === 'The Fourth Line' && isActive(f)
    );
    if (fourthLine) extraHits = 1;
  }

  // Compute hits
  let hitsToApply = computeAttackHits(action, formation) + extraHits;
  const selfHits = computeSelfHits(action);

  // Special: Rupert's Lifeguard reduces hits to Tillier's Left and Right
  if (
    targetCard.name === "Tillier's Left" || targetCard.name === "Tillier's Right"
  ) {
    const lifeguard = opponent.formations.find(f => {
      const c = getCard(f.cardId);
      return c.specialRuleId === 'rupert-lifeguard' && f.cubesOnCard >= 1 && isPlayable(f);
    });
    if (lifeguard) {
      hitsToApply = Math.max(0, hitsToApply - 1);
    }
  }

  // Special: Soimonoff hit reduction (until first Fog cube is lifted)
  // Track fog state by checking if The Fog has all 3 cubes still (first hasn't been lifted)
  if (targetCard.specialRuleId === 'soimonoff') {
    const fog = opponent.formations.find(f => getCard(f.cardId).specialRuleId === 'the-fog');
    if (fog && fog.cubesOnCard === 3) {
      // First fog cube not yet lifted — Soimonoff gets -1 hit
      hitsToApply = Math.max(0, hitsToApply - 1);
    }
  }

  // Check English Fleet suppression on Don Juan Jose counterattack
  // (handled in findCounterattackReactions)

  // Find available reactions
  let screenReactions = findScreenReactions(card.name, opponent.formations);
  let counterReactions = findCounterattackReactions(card.name, targetFormation);
  let absorbReactions = findAbsorbReactions(targetCard.name, opponent.formations);

  // Apply English Fleet suppression
  const englishFleet = state.players[oppIdx].formations.find(f => {
    const c = getCard(f.cardId);
    return c.specialRuleId === 'english-fleet' && f.cubesOnCard > 0 && isPlayable(f);
  });
  if (englishFleet) {
    counterReactions = counterReactions.filter(r => {
      const c = getCard(r.formationId);
      return c.name !== 'Don Juan Jose';
    });
    screenReactions = screenReactions.filter(r => {
      const c = getCard(r.formationId);
      return c.name !== 'Spanish Right Cavalry';
    });
  }

  const allReactions: ReactionOption[] = [...screenReactions, ...counterReactions, ...absorbReactions];

  const pendingAction: PendingAction = {
    actingPlayerIndex: pi,
    formationId: formation.cardId,
    actionIndex,
    targetFormationId: targetFormation.cardId,
    hitsToApply,
    selfHitsToApply: selfHits,
  };

  if (allReactions.length > 0) {
    return {
      ...state,
      phase: 'awaiting-reaction',
      pendingAction,
      availableReactions: allReactions,
      log: [
        ...state.log,
        `${card.name} attacks ${targetCard.name} for ${hitsToApply} hit(s). Opponent may react.`,
      ],
    };
  }

  // No reactions — apply immediately
  return applyAttackEffects(state, pendingAction, null);
}

function applyAttackEffects(
  state: GameState,
  pending: PendingAction,
  reaction: ReactionOption | null,
): GameState {
  const pi = pending.actingPlayerIndex;
  const oppIdx = (1 - pi) as 0 | 1;
  const actingCard = getCard(pending.formationId);

  let newState = { ...state };
  const newPlayers = [...state.players] as [PlayerState, PlayerState];

  // Clear dice from acting formation
  const actingFIdx = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
  newPlayers[pi] = clearFormationDice(newPlayers[pi], actingFIdx, actingCard.isSpecial);

  if (reaction === null) {
    // Apply full attack hits to target
    if (pending.targetFormationId) {
      const targetFIdx = newPlayers[oppIdx].formations.findIndex(f => f.cardId === pending.targetFormationId);
      if (targetFIdx !== -1) {
        newPlayers[oppIdx] = {
          ...newPlayers[oppIdx],
          formations: newPlayers[oppIdx].formations.map((f, i) =>
            i === targetFIdx ? applyDamageToFormation(f, pending.hitsToApply) : f
          ),
        };
      }
    }
    // Apply self-hits
    if (pending.selfHitsToApply > 0) {
      const actingF2 = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
      newPlayers[pi] = {
        ...newPlayers[pi],
        formations: newPlayers[pi].formations.map((f, i) =>
          i === actingF2 ? applyDamageToFormation(f, pending.selfHitsToApply) : f
        ),
      };
    }
  }

  newState = { ...newState, players: newPlayers, phase: 'roll-phase', pendingAction: undefined, availableReactions: [] };

  // Process routing for target
  if (pending.targetFormationId && reaction === null) {
    const targetF = newState.players[oppIdx].formations.find(f => f.cardId === pending.targetFormationId);
    if (targetF && targetF.unitsRemaining === 0) {
      newState = processRouting(newState, oppIdx, pending.targetFormationId);
    }
  }

  // Process routing for acting formation (self-hits)
  if (pending.selfHitsToApply > 0 && reaction === null) {
    const actingF = newState.players[pi].formations.find(f => f.cardId === pending.formationId);
    if (actingF && actingF.unitsRemaining === 0) {
      newState = processRouting(newState, pi, pending.formationId);
    }
  }

  if (newState.phase !== 'game-over') {
    newState = checkWin(newState);
  }

  return newState;
}

function handleBombard(
  state: GameState,
  pi: 0 | 1,
  oppIdx: 0 | 1,
  formation: FormationState,
  fIdx: number,
  _action: FormationAction,
): GameState {
  const card = getCard(formation.cardId);
  const opponent = state.players[oppIdx];

  // Cannot remove last Morale Cube
  if (opponent.morale <= 1) {
    return {
      ...state,
      log: [...state.log, `${card.name} cannot Bombard — would remove opponent's last Morale Cube.`],
    };
  }

  const newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = clearFormationDice(newPlayers[pi], fIdx, card.isSpecial);
  newPlayers[oppIdx] = { ...newPlayers[oppIdx], morale: opponent.morale - 1 };

  return {
    ...state,
    players: newPlayers,
    phase: 'roll-phase',
    log: [...state.log, `${card.name} Bombards! ${opponent.factionName} loses 1 Morale Cube.`],
  };
}

function handleCommand(
  state: GameState,
  pi: 0 | 1,
  formation: FormationState,
  fIdx: number,
  action: FormationAction,
): GameState {
  const card = getCard(formation.cardId);
  const commandTarget = action.commandTarget;
  if (!commandTarget) return state;

  let newPlayers = [...state.players] as [PlayerState, PlayerState];
  newPlayers[pi] = clearFormationDice(newPlayers[pi], fIdx, card.isSpecial);

  // Activate the commanded formation
  const targetFIdx = newPlayers[pi].formations.findIndex(
    f => getCard(f.cardId).name === commandTarget && f.inReserve
  );

  let logMsg = `${card.name} issues Command for ${commandTarget}.`;

  if (targetFIdx !== -1) {
    newPlayers[pi] = {
      ...newPlayers[pi],
      formations: newPlayers[pi].formations.map((f, i) =>
        i === targetFIdx ? { ...f, inReserve: false } : f
      ),
    };
    logMsg += ` ${commandTarget} enters the battle!`;
  }

  // Special: Pauloff's Right adds Morale Cube when commanding Pauloff's Left
  if (card.specialRuleId === 'pauloffs-right' && commandTarget === "Pauloff's Left") {
    newPlayers[pi] = { ...newPlayers[pi], morale: newPlayers[pi].morale + 1 };
    logMsg += ` Russian Empire gains 1 Morale Cube!`;
  }

  // The Stanleys special: when coming out of reserve, Northumberland immediately routs
  if (targetFIdx !== -1) {
    const targetCard = getCard(newPlayers[pi].formations[targetFIdx].cardId);
    if (targetCard.specialRuleId === 'the-stanleys') {
      // Find Northumberland on the OPPONENT's side (York)
      const northumFIdx = newPlayers[pi].formations.findIndex(
        f => getCard(f.cardId).name === 'Northumberland'
      );
      if (northumFIdx !== -1 && isActive(newPlayers[pi].formations[northumFIdx])) {
        logMsg += ` The Stanleys betray! Northumberland immediately Routs!`;
        const tempState = { ...state, players: newPlayers };
        const afterRouting = processRouting(tempState, pi, newPlayers[pi].formations[northumFIdx].cardId, false);
        return { ...afterRouting, phase: 'roll-phase', log: [...afterRouting.log.slice(0, -1), logMsg] };
      }
    }

    // The Fog special: when commanding, remove top cube and resolve effect
    if (targetCard.specialRuleId === 'the-fog' || card.specialRuleId === 'the-fog') {
      return handleFogCommand(state, pi, newPlayers, fIdx, logMsg);
    }
  }

  return {
    ...state,
    players: newPlayers,
    phase: 'roll-phase',
    log: [...state.log, logMsg],
  };
}

function handleFogCommand(
  state: GameState,
  pi: 0 | 1,
  newPlayers: [PlayerState, PlayerState],
  _fIdx: number,
  baseMsg: string,
): GameState {
  // Find The Fog card
  const fogFIdx = newPlayers[pi].formations.findIndex(f => getCard(f.cardId).specialRuleId === 'the-fog');
  if (fogFIdx === -1) return { ...state, players: newPlayers, phase: 'roll-phase' };

  const fog = newPlayers[pi].formations[fogFIdx];
  const cubesRemaining = fog.cubesOnCard;
  let logMsg = baseMsg;

  if (cubesRemaining <= 0) {
    logMsg += ' The fog has already fully lifted.';
    return { ...state, players: newPlayers, phase: 'roll-phase', log: [...state.log, logMsg] };
  }

  // Remove top cube and resolve effect
  // Effects are resolved from cube 3 down to 1 (or in order as lifted)
  const cubeIndex = 4 - cubesRemaining; // 1st lift = cube 1 effect, etc.

  newPlayers[pi] = {
    ...newPlayers[pi],
    formations: newPlayers[pi].formations.map((f, i) =>
      i === fogFIdx ? { ...f, cubesOnCard: f.cubesOnCard - 1 } : f
    ),
  };

  switch (cubeIndex) {
    case 1:
      logMsg += ' Fog Cube 1 lifted: Soimonoff loses special hit reduction.';
      break;
    case 2: {
      // British Troops out of reserve
      const btFIdx = newPlayers[pi].formations.findIndex(
        f => getCard(f.cardId).name === 'British Troops' && f.inReserve
      );
      if (btFIdx !== -1) {
        newPlayers[pi] = {
          ...newPlayers[pi],
          formations: newPlayers[pi].formations.map((f, i) =>
            i === btFIdx ? { ...f, inReserve: false } : f
          ),
        };
        logMsg += ' Fog Cube 2 lifted: British Troops enter the battle!';
      }
      break;
    }
    case 3: {
      // French Troops out of reserve
      const ftFIdx = newPlayers[pi].formations.findIndex(
        f => getCard(f.cardId).name === 'French Troops' && f.inReserve
      );
      if (ftFIdx !== -1) {
        newPlayers[pi] = {
          ...newPlayers[pi],
          formations: newPlayers[pi].formations.map((f, i) =>
            i === ftFIdx ? { ...f, inReserve: false } : f
          ),
        };
        logMsg += ' Fog Cube 3 lifted: French Troops enter the battle!';
      }
      break;
    }
  }

  return {
    ...state,
    players: newPlayers,
    phase: 'roll-phase',
    log: [...state.log, logMsg],
  };
}

// ── Reaction Phase ───────────────────────────────────────────────────────────

function handleTakeReaction(state: GameState, formationId: string, actionIndex: number): GameState {
  const pending = state.pendingAction!;
  const pi = pending.actingPlayerIndex;
  const oppIdx = (1 - pi) as 0 | 1;

  const reactionPlayer = state.players[oppIdx];
  const reactionFIdx = reactionPlayer.formations.findIndex(f => f.cardId === formationId);
  if (reactionFIdx === -1) return state;

  const reactionCard = getCard(formationId);
  const action = reactionCard.actions[actionIndex];
  if (!action) return state;

  let newState = { ...state };
  const newPlayers = [...state.players] as [PlayerState, PlayerState];

  // Clear reaction formation dice/cubes
  newPlayers[oppIdx] = clearFormationDice(newPlayers[oppIdx], reactionFIdx, reactionCard.isSpecial);
  // Skipped action phase for reactor
  newPlayers[oppIdx] = { ...newPlayers[oppIdx] };

  newState = { ...newState, players: newPlayers };

  switch (action.actionType) {
    case 'Screen': {
      // Cancel attack — no hits on either side
      // Acting formation still loses dice (happens in applyAttackEffects even with Screen)
      const actingFIdx = newState.players[pi].formations.findIndex(f => f.cardId === pending.formationId);
      const actingCard = getCard(pending.formationId);
      newPlayers[pi] = clearFormationDice(newPlayers[pi], actingFIdx, actingCard.isSpecial);

      // Special: Wolfe/Montcalm Screen removes the card from play
      if (reactionCard.specialRuleId === 'wolfe' || reactionCard.specialRuleId === 'montcalm') {
        newPlayers[oppIdx] = {
          ...newPlayers[oppIdx],
          formations: newPlayers[oppIdx].formations.map((f, i) =>
            i === reactionFIdx ? { ...f, isRetired: true } : f
          ),
        };
      }

      newState = {
        ...newState,
        players: newPlayers,
        phase: 'roll-phase',
        skippedPlayerIndex: oppIdx,
        pendingAction: undefined,
        availableReactions: [],
        log: [
          ...newState.log,
          `${reactionCard.name} Screens! Attack cancelled. ${state.players[oppIdx].factionName} skips next action phase.`,
        ],
      };
      return newState;
    }

    case 'Counterattack': {
      // Both sides take hits simultaneously
      const counterHits = action.hits ?? 0;
      const counterSelfReduce = action.selfReduceHits ?? 0;
      const actualHitsOnTarget = Math.max(0, pending.hitsToApply - counterSelfReduce);
      const actualHitsOnAttacker = counterHits;

      const actingFIdx = newState.players[pi].formations.findIndex(f => f.cardId === pending.formationId);
      const actingCard = getCard(pending.formationId);
      newPlayers[pi] = clearFormationDice(newPlayers[pi], actingFIdx, actingCard.isSpecial);

      // Apply hits to target (defender)
      const tFIdx = newPlayers[oppIdx].formations.findIndex(f => f.cardId === pending.targetFormationId);
      if (tFIdx !== -1) {
        newPlayers[oppIdx] = {
          ...newPlayers[oppIdx],
          formations: newPlayers[oppIdx].formations.map((f, i) =>
            i === tFIdx ? applyDamageToFormation(f, actualHitsOnTarget) : f
          ),
        };
      }

      // Apply counter-hits to attacker
      const aFIdx = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
      if (aFIdx !== -1) {
        newPlayers[pi] = {
          ...newPlayers[pi],
          formations: newPlayers[pi].formations.map((f, i) =>
            i === aFIdx ? applyDamageToFormation(f, actualHitsOnAttacker) : f
          ),
        };
      }

      // Apply self-hits on attacker
      if (pending.selfHitsToApply > 0) {
        const aF2 = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
        if (aF2 !== -1) {
          newPlayers[pi] = {
            ...newPlayers[pi],
            formations: newPlayers[pi].formations.map((f, i) =>
              i === aF2 ? applyDamageToFormation(f, pending.selfHitsToApply) : f
            ),
          };
        }
      }

      newState = {
        ...newState,
        players: newPlayers,
        phase: 'roll-phase',
        skippedPlayerIndex: oppIdx,
        pendingAction: undefined,
        availableReactions: [],
        log: [
          ...newState.log,
          `${reactionCard.name} Counterattacks! Both sides take hits simultaneously. ${state.players[oppIdx].factionName} skips next action phase.`,
        ],
      };

      // Check routing — simultaneous if both rout
      const attackerF = newState.players[pi].formations.find(f => f.cardId === pending.formationId);
      const defenderF = newState.players[oppIdx].formations.find(f => f.cardId === pending.targetFormationId);
      const bothRout = attackerF?.unitsRemaining === 0 && defenderF?.unitsRemaining === 0;

      if (attackerF?.unitsRemaining === 0) {
        newState = processRouting(newState, pi, pending.formationId!, bothRout);
      }
      if (defenderF?.unitsRemaining === 0 && pending.targetFormationId) {
        newState = processRouting(newState, oppIdx, pending.targetFormationId, bothRout);
      }

      return checkWin(newState);
    }

    case 'Absorb': {
      // Absorb formation takes the hits instead of target
      const absorbHits = action.absorb1Only ? 1 : pending.hitsToApply;

      newPlayers[oppIdx] = {
        ...newPlayers[oppIdx],
        formations: newPlayers[oppIdx].formations.map((f, i) =>
          i === reactionFIdx ? applyDamageToFormation(f, absorbHits) : f
        ),
      };

      // Self-hits on attacker still apply
      if (pending.selfHitsToApply > 0) {
        const aFIdx = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
        const actingCard = getCard(pending.formationId);
        newPlayers[pi] = clearFormationDice(newPlayers[pi], aFIdx, actingCard.isSpecial);
        newPlayers[pi] = {
          ...newPlayers[pi],
          formations: newPlayers[pi].formations.map((f, i) =>
            i === aFIdx ? applyDamageToFormation(f, pending.selfHitsToApply) : f
          ),
        };
      } else {
        const aFIdx = newPlayers[pi].formations.findIndex(f => f.cardId === pending.formationId);
        const actingCard = getCard(pending.formationId);
        newPlayers[pi] = clearFormationDice(newPlayers[pi], aFIdx, actingCard.isSpecial);
      }

      newState = {
        ...newState,
        players: newPlayers,
        phase: 'roll-phase',
        skippedPlayerIndex: oppIdx,
        pendingAction: undefined,
        availableReactions: [],
        log: [
          ...newState.log,
          `${reactionCard.name} Absorbs! Takes ${absorbHits} hit(s) instead. ${state.players[oppIdx].factionName} skips next action phase.`,
        ],
      };

      // Check absorbing formation routing
      const absorbF = newState.players[oppIdx].formations.find(f => f.cardId === formationId);
      if (absorbF?.unitsRemaining === 0) {
        newState = processRouting(newState, oppIdx, formationId);
      }
      // Check attacker self-hits routing
      if (pending.selfHitsToApply > 0) {
        const attackerF = newState.players[pi].formations.find(f => f.cardId === pending.formationId);
        if (attackerF?.unitsRemaining === 0) {
          newState = processRouting(newState, pi, pending.formationId);
        }
      }

      return checkWin(newState);
    }

    default:
      return state;
  }
}

function handleNoReaction(state: GameState): GameState {
  if (!state.pendingAction) return state;

  // Reactions are mandatory unless the card explicitly marks them voluntary (e.g. Wolfe, Montcalm).
  // If any available reaction is mandatory, the defender cannot decline.
  const hasMandatoryReaction = state.availableReactions.some(r => {
    const card = getCard(r.formationId);
    const action = card.actions[r.actionIndex];
    return action.voluntary !== true;
  });
  if (hasMandatoryReaction) return state;

  const pending = state.pendingAction;
  const oppIdx = (1 - pending.actingPlayerIndex) as 0 | 1;

  const newState = applyAttackEffects(
    { ...state, skippedPlayerIndex: oppIdx },
    pending,
    null,
  );

  return {
    ...newState,
    log: [...newState.log, `${state.players[oppIdx].factionName} declines to react.`],
  };
}

// ── Main Reducer ─────────────────────────────────────────────────────────────

export const defaultState: GameState = {
  phase: 'scenario-select',
  currentPlayerIndex: 0,
  skippedPlayerIndex: null,
  actionTakenThisTurn: false,
  availableReactions: [],
  players: [
    { factionName: '', morale: 0, dicePool: [], formations: [], diceAssignedToWings: {} },
    { factionName: '', morale: 0, dicePool: [], formations: [], diceAssignedToWings: {} },
  ],
  log: [],
  scenarioId: '',
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'RESTART':
      return defaultState;
    case 'SELECT_SCENARIO':
      return initializeScenario(action.scenarioId);
    case 'ROLL_DICE':
      return handleRollDice(state);
    case 'ASSIGN_DICE':
      return handleAssignDice(state, action.diePoolIndices, action.formationId);
    case 'RETURN_DIE':
      return handleReturnDie(state, action.formationId, action.dieIndex);
    case 'END_ROLL_PHASE':
      return handleEndRollPhase(state);
    case 'TAKE_ACTION':
      return handleTakeAction(state, action.formationId, action.actionIndex);
    case 'TAKE_REACTION':
      return handleTakeReaction(state, action.formationId, action.actionIndex);
    case 'NO_REACTION':
      return handleNoReaction(state);
    case 'PASS_ACTION':
      return handlePassAction(state);
    case 'RETIRE':
      return handleRetire(state, action.formationId);
    default:
      return state;
  }
}

/** Returns true if the selected pool dice can all be assigned to the given formation. */
export function canAssignDiceSet(
  state: GameState,
  playerIndex: 0 | 1,
  diePoolIndices: number[],
  formationId: string,
): boolean {
  if (diePoolIndices.length === 0) return false;
  const player = state.players[playerIndex];
  const dies = diePoolIndices.map(i => player.dicePool[i]);
  if (dies.some(d => d === undefined)) return false;

  const fIdx = player.formations.findIndex(f => f.cardId === formationId);
  if (fIdx === -1) return false;
  const formation = player.formations[fIdx];
  if (!isPlayable(formation)) return false;

  const card = getCard(formationId);

  // Wing slot: free if formation hasn't received dice yet this roll, else already claimed
  const wing = card.wing;
  const alreadyInWing = wingAssignmentCount(player, wing);
  const maxInWing = maxWingAssignments(playerIndex, state, wing);
  if (formation.diceAddedThisRoll.length === 0 && alreadyInWing >= maxInWing) return false;

  // Clinton special rule
  if (card.specialRuleId === 'clinton') {
    const grant = player.formations.find(f => getCard(f.cardId).name === 'Grant');
    const hessians = player.formations.find(f => getCard(f.cardId).name === 'Hessians');
    if (!grant || !hessians || !isActive(grant) || !isActive(hessians)) return false;
  }

  if (card.isSpecial) {
    if (formation.cubesOnCard >= (card.specialMax ?? 1)) return false;
    return validateDiceSetForArea(dies, formation.diceAddedThisRoll, card.diceArea);
  }

  return validateDiceSetForArea(dies, formation.diceAddedThisRoll, card.diceArea);
}
