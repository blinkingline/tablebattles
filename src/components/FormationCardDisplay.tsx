import type { FormationCard, FormationState, GameState, FormationAction, DiceArea } from '../types';
import type { GameAction } from '../engine/gameReducer';
import { canAssignDie } from '../engine/gameReducer';

interface Props {
  card: FormationCard;
  formation: FormationState;
  state: GameState;
  playerIndex: 0 | 1;
  dispatch: (action: GameAction) => void;
  isActive: boolean;
  selectedDieIndex: number | null;
  onDieSelected: (index: number | null) => void;
}

function diceFreq(dice: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const d of dice) counts[d] = (counts[d] ?? 0) + 1;
  return counts;
}

function meetsDiceAreaMin(diceArea: DiceArea, diceOnCard: number[]): boolean {
  switch (diceArea.type) {
    case 'values':
    case 'any':
      return diceOnCard.length >= 1;
    case 'doubles':
      return diceOnCard.length >= 2 && Object.values(diceFreq(diceOnCard)).some(c => c >= 2);
    case 'triples':
      return diceOnCard.length >= 3 && Object.values(diceFreq(diceOnCard)).some(c => c >= 3);
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

function checkRequirement(action: FormationAction, formation: FormationState, card: FormationCard): boolean {
  if (card.isSpecial) return formation.cubesOnCard >= 1;
  if (formation.diceOnCard.length === 0) return false;
  if (!meetsDiceAreaMin(card.diceArea, formation.diceOnCard)) return false;
  const dice = formation.diceOnCard;
  const req = action.requirement;
  if (!req) return true;
  switch (req) {
    case 'Pair': return Object.values(diceFreq(dice)).some(c => c >= 2);
    case 'Two Pairs': return Object.values(diceFreq(dice)).filter(c => c >= 2).length >= 2;
    case 'Triplet': return Object.values(diceFreq(dice)).some(c => c >= 3);
    case 'Two Triplets': return Object.values(diceFreq(dice)).filter(c => c >= 3).length >= 2;
    case 'Full House': {
      const vals = Object.entries(diceFreq(dice));
      return vals.some(([, c]) => c >= 3) && vals.filter(([, c]) => c >= 2).length >= 2;
    }
    case 'Five Dice': return dice.length >= 5;
  }
}

const WING_COLORS: Record<string, string> = {
  Red: '#c0392b',
  Pink: '#d4809e',
  Blue: '#2980b9',
  DkBlue: '#1a4a7a',
};

const WING_BG: Record<string, string> = {
  Red: 'rgba(192,57,43,0.18)',
  Pink: 'rgba(212,128,158,0.18)',
  Blue: 'rgba(41,128,185,0.18)',
  DkBlue: 'rgba(26,74,122,0.18)',
};

function diceAreaLabel(card: FormationCard): string {
  const da = card.diceArea;
  switch (da.type) {
    case 'values': {
      const vals = da.values!.join('/');
      return da.bracketed ? `${vals} (max 1 die)` : vals;
    }
    case 'doubles': return 'Doubles (2 matching)';
    case 'triples': return 'Triples (3 matching)';
    case 'straight': return `Straight ${da.count}`;
    case 'any': return 'Any';
  }
}

function actionTargetLine(action: FormationAction): string | null {
  const cmd = action.commandTarget;
  const tgts = action.targets;
  switch (action.actionType) {
    case 'Attack':
    case 'Bombard':
      return tgts && tgts.length > 0 ? `→ ${tgts.join(' / ')}` : null;
    case 'Screen':
      return tgts ? `blocks: ${tgts.join(' / ')}` : null;
    case 'Counterattack':
      return tgts ? `vs: ${tgts.join(' / ')}` : null;
    case 'Absorb':
      return tgts ? `for: ${tgts.join(' / ')}` : null;
    case 'Command':
      return cmd ? `→ ${cmd}` : (tgts ? `→ ${tgts.join(' / ')}` : null);
    default:
      return null;
  }
}

export default function FormationCardDisplay({
  card, formation, state, playerIndex, dispatch, isActive, selectedDieIndex, onDieSelected,
}: Props) {
  const isRouted = formation.isRouted;
  const isRetired = formation.isRetired;
  const hasPursued = formation.hasPursued;
  const inReserve = formation.inReserve;
  const isDead = isRouted || isRetired || hasPursued;

  const isRollPhase = state.phase === 'roll-phase';
  const isActionPhase = state.phase === 'action-phase';
  const isReactionPhase = state.phase === 'awaiting-reaction';
  const isCurrentPlayer = state.currentPlayerIndex === playerIndex;

  const canReceiveDie = isActive && isRollPhase && isCurrentPlayer &&
    selectedDieIndex !== null &&
    canAssignDie(state, playerIndex, selectedDieIndex, card.id);

  const reactionOptions = state.availableReactions.filter(r => r.formationId === card.id);
  const isReactionTarget = isActive && isReactionPhase && !isCurrentPlayer && reactionOptions.length > 0;

  const hasDiceOrCubes = card.isSpecial ? formation.cubesOnCard > 0 : formation.diceOnCard.length > 0;
  // Whether this card's active player can act from it right now
  const isMyTurn = isActive && isActionPhase && isCurrentPlayer && !isDead && !inReserve;
  const canTakeAction = isMyTurn && hasDiceOrCubes
    && card.actions.some(a =>
      (a.actionType === 'Attack' || a.actionType === 'Bombard' || a.actionType === 'Command')
      && checkRequirement(a, formation, card)
    );

  const wingColor = WING_COLORS[card.wing] ?? '#888';
  const wingBg = WING_BG[card.wing] ?? 'rgba(128,128,128,0.1)';

  const cardOpacity = isDead ? 0.35 : inReserve ? 0.55 : 1;
  const cardBorder = canReceiveDie
    ? '2px solid #c9a84c'
    : isReactionTarget
    ? '2px solid #4a9c5e'
    : canTakeAction
    ? '2px solid rgba(201,168,76,0.8)'
    : '1px solid rgba(255,255,255,0.1)';
  const cardGlow = (canTakeAction || canReceiveDie || isReactionTarget)
    ? canReceiveDie
      ? '0 0 12px rgba(201,168,76,0.5)'
      : isReactionTarget
      ? '0 0 12px rgba(74,156,94,0.4)'
      : '0 0 10px rgba(201,168,76,0.35)'
    : undefined;

  function handleCardClick() {
    if (canReceiveDie && selectedDieIndex !== null) {
      const pool = state.players[playerIndex].dicePool;
      const dieValue = pool[selectedDieIndex];
      dispatch({ type: 'ASSIGN_DIE', diePoolIndex: selectedDieIndex, formationId: card.id });
      const nextIdx = pool.findIndex((v, i) => v === dieValue && i !== selectedDieIndex);
      if (nextIdx !== -1) {
        onDieSelected(nextIdx > selectedDieIndex ? nextIdx - 1 : nextIdx);
      } else {
        onDieSelected(null);
      }
    }
  }

  function handleDieOnCardClick(dieIndex: number) {
    if (isActive && isRollPhase && isCurrentPlayer) {
      dispatch({ type: 'RETURN_DIE', formationId: card.id, dieIndex });
    }
  }

  return (
    <div
      className="rounded-lg select-none transition-all"
      style={{
        background: wingBg,
        border: cardBorder,
        boxShadow: cardGlow,
        opacity: cardOpacity,
        width: '190px',
        position: 'relative',
        cursor: canReceiveDie ? 'pointer' : 'default',
      }}
      onClick={canReceiveDie ? handleCardClick : undefined}
      title={canReceiveDie ? `Assign die to ${card.name}` : undefined}
    >
      {/* Wing colour bar */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 rounded-l-lg"
        style={{ background: wingColor }}
      />

      <div className="pl-2 pr-2 pt-2 pb-1.5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <span className="font-bold leading-tight" style={{ color: '#e8e0d0', fontSize: '0.8rem' }}>
              {card.name}
            </span>
            {card.isStarred && (
              <span style={{ color: '#c9a84c', fontSize: '0.75rem' }} title="Starred — 2 Morale on rout">★</span>
            )}
          </div>
          <span className="font-mono shrink-0 mt-px" style={{ color: wingColor, fontSize: '0.65rem' }}>
            {card.wing}
          </span>
        </div>

        {/* ── Status ── */}
        {(isDead || inReserve) && (
          <div className="mb-1 text-xs font-bold">
            {isRouted && <span style={{ color: '#e05c5c' }}>ROUTED</span>}
            {isRetired && <span style={{ color: '#9a8c7e' }}>RETIRED</span>}
            {hasPursued && <span style={{ color: '#9a8c7e' }}>PURSUED</span>}
            {inReserve && !isDead && <span style={{ color: '#6b9ebc' }}>IN RESERVE</span>}
          </div>
        )}

        {/* ── Strength ── */}
        {card.isSpecial ? (
          <div className="flex items-center gap-1 mb-1">
            <span style={{ color: '#9a8c7e', fontSize: '0.65rem' }}>
              Sp.{card.specialMax === 1 ? 'I' : card.specialMax === 2 ? 'II' : 'III'}
            </span>
            <div className="flex gap-0.5">
              {Array.from({ length: card.specialMax ?? 1 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-sm"
                  style={
                    i < formation.cubesOnCard
                      ? { background: '#c9a84c' }
                      : { background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)' }
                  }
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 mb-1 flex-wrap">
            {Array.from({ length: card.strength }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-sm"
                style={{
                  background: i < formation.unitsRemaining ? '#8eb8d0' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
            ))}
            <span className="ml-0.5" style={{ color: '#9a8c7e', fontSize: '0.65rem' }}>
              {formation.unitsRemaining}/{card.strength}
            </span>
          </div>
        )}

        {/* ── Dice area ── */}
        <div className="mb-1 flex items-center gap-1">
          <span style={{ color: '#9a8c7e', fontSize: '0.65rem' }}>Dice area:</span>
          <span style={{ color: '#c9a84c', fontSize: '0.7rem', fontWeight: 600 }}>{diceAreaLabel(card)}</span>
        </div>

        {/* ── Dice on card ── */}
        {formation.diceOnCard.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {formation.diceOnCard.map((val, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); handleDieOnCardClick(i); }}
                className="w-6 h-6 rounded font-bold flex items-center justify-center"
                style={{
                  background: 'rgba(201,168,76,0.25)',
                  border: '1px solid rgba(201,168,76,0.6)',
                  color: '#c9a84c',
                  fontSize: '0.75rem',
                  cursor: isActive && isRollPhase && isCurrentPlayer ? 'pointer' : 'default',
                }}
                title={isActive && isRollPhase && isCurrentPlayer ? `Return ${val} to pool` : `Die: ${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        )}

        {/* ── Special rule text ── */}
        {card.specialRuleText && (
          <div className="mb-1.5 italic leading-snug" style={{ color: '#7a9ea8', fontSize: '0.6rem' }}>
            {card.specialRuleText}
          </div>
        )}

        {/* ── Divider ── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginBottom: '5px' }} />

        {/* ── Actions (always shown) ── */}
        <div className="flex flex-col gap-1">
          {card.actions.map((action, i) => {
            const isActiveType = action.actionType === 'Attack'
              || action.actionType === 'Bombard'
              || action.actionType === 'Command';
            const reqMet = checkRequirement(action, formation, card);
            const reactionOpt = reactionOptions.find(r => r.actionIndex === i);

            const canClickAction = isMyTurn && isActiveType && hasDiceOrCubes && reqMet;
            const canClickReaction = isReactionTarget && !!reactionOpt;
            const isClickable = canClickAction || canClickReaction;

            // Colour scheme per state
            let bg: string, border: string, typeColor: string, detailColor: string, descColor: string;
            if (canClickAction) {
              bg = 'rgba(201,168,76,0.14)';
              border = '1px solid rgba(201,168,76,0.45)';
              typeColor = '#d4a840';
              detailColor = '#a89060';
              descColor = '#b09860';
            } else if (canClickReaction) {
              bg = 'rgba(74,156,94,0.18)';
              border = '1px solid rgba(74,156,94,0.5)';
              typeColor = '#4ab870';
              detailColor = '#3a9458';
              descColor = '#3a8850';
            } else if (!isActiveType) {
              // Reaction-type action, not currently triggerable
              bg = 'rgba(40,65,90,0.25)';
              border = '1px solid rgba(60,90,120,0.3)';
              typeColor = '#5a80a0';
              detailColor = '#4a6070';
              descColor = '#4a6070';
            } else if (isMyTurn && isActiveType && hasDiceOrCubes && !reqMet) {
              // Active type, has dice, but req not met — show why
              bg = 'rgba(120,60,40,0.15)';
              border = '1px solid rgba(150,80,60,0.3)';
              typeColor = '#8b5540';
              detailColor = '#704535';
              descColor = '#704535';
            } else {
              // Inactive / other player / no dice
              bg = 'rgba(40,40,40,0.3)';
              border = '1px solid rgba(80,80,80,0.2)';
              typeColor = '#604840';
              detailColor = '#504038';
              descColor = '#504038';
            }

            const reqLabel = action.requirement ? ` [${action.requirement}]` : '';
            const targetLine = actionTargetLine(action);
            const optLabel = action.voluntary ? ' (optional)' : '';

            return (
              <button
                key={i}
                onClick={(e) => {
                  if (canClickAction) {
                    e.stopPropagation();
                    dispatch({ type: 'TAKE_ACTION', formationId: card.id, actionIndex: i });
                  } else if (canClickReaction) {
                    e.stopPropagation();
                    dispatch({ type: 'TAKE_REACTION', formationId: card.id, actionIndex: i });
                  }
                  // Otherwise let the click bubble up to the card for die assignment
                }}
                className="text-left rounded transition-all"
                style={{
                  background: bg,
                  border,
                  cursor: isClickable ? 'pointer' : 'default',
                  padding: '3px 5px',
                  lineHeight: '1.35',
                }}
                onMouseEnter={(e) => {
                  if (canClickAction) (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.28)';
                  else if (canClickReaction) (e.currentTarget as HTMLElement).style.background = 'rgba(74,156,94,0.32)';
                }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = bg; }}
                disabled={!isClickable}
                title={
                  isMyTurn && isActiveType && hasDiceOrCubes && !reqMet
                    ? `Need ${action.requirement}`
                    : action.description
                }
              >
                {/* Type + requirement */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', flexWrap: 'wrap' }}>
                  <span style={{ color: typeColor, fontSize: '0.68rem', fontWeight: 700 }}>
                    {action.actionType}
                  </span>
                  {reqLabel && (
                    <span style={{ color: detailColor, fontSize: '0.62rem', fontWeight: 600 }}>
                      {reqLabel}
                    </span>
                  )}
                  {optLabel && (
                    <span style={{ color: detailColor, fontSize: '0.58rem', fontStyle: 'italic' }}>
                      {optLabel}
                    </span>
                  )}
                  {/* Unmet requirement indicator */}
                  {isMyTurn && isActiveType && hasDiceOrCubes && !reqMet && action.requirement && (
                    <span style={{ color: '#c05030', fontSize: '0.6rem' }}>✗ need {action.requirement}</span>
                  )}
                </div>
                {/* Target line */}
                {targetLine && (
                  <div style={{ color: '#7aaccc', fontSize: '0.6rem', marginTop: '1px' }}>
                    {targetLine}
                  </div>
                )}
                {/* Description */}
                <div style={{ color: descColor, fontSize: '0.6rem', marginTop: '1px' }}>
                  {action.description}
                </div>
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
