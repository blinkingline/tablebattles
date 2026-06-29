import type { FormationCard, FormationState, GameState } from '../types';
import type { GameAction } from '../engine/gameReducer';
import { canAssignDie } from '../engine/gameReducer';

interface Props {
  card: FormationCard;
  formation: FormationState;
  state: GameState;
  playerIndex: 0 | 1;
  dispatch: (action: GameAction) => void;
  isActive: boolean; // this player's active turn
  selectedDieIndex: number | null;
  onDieSelected: (index: number | null) => void;
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
      return da.bracketed ? `(${vals})` : vals;
    }
    case 'doubles': return 'Doubles';
    case 'triples': return 'Triples';
    case 'straight': return `Straight (${da.count})`;
    case 'any': return 'Any';
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

  // Can this formation receive the selected die?
  const canReceiveDie = isActive && isRollPhase && isCurrentPlayer &&
    selectedDieIndex !== null &&
    canAssignDie(state, playerIndex, selectedDieIndex, card.id);

  // Check if any action is available during action phase
  // Is this formation a valid reaction target?
  const reactionOptions = state.availableReactions.filter(r => r.formationId === card.id);
  const isReactionTarget = isActive && isReactionPhase && !isCurrentPlayer && reactionOptions.length > 0;

  // Active formation can take an action
  const canTakeAction = isActive && isActionPhase && isCurrentPlayer && !isDead && !inReserve
    && (card.isSpecial ? formation.cubesOnCard > 0 : formation.diceOnCard.length > 0);

  const wingColor = WING_COLORS[card.wing] ?? '#888';
  const wingBg = WING_BG[card.wing] ?? 'rgba(128,128,128,0.1)';

  const cardOpacity = isDead ? 0.35 : inReserve ? 0.55 : 1;
  const cardBorder = canReceiveDie
    ? '2px solid #c9a84c'
    : isReactionTarget
    ? '2px solid #4a9c5e'
    : canTakeAction
    ? '1px solid rgba(201,168,76,0.4)'
    : '1px solid rgba(255,255,255,0.1)';

  function handleCardClick() {
    if (canReceiveDie && selectedDieIndex !== null) {
      dispatch({ type: 'ASSIGN_DIE', diePoolIndex: selectedDieIndex, formationId: card.id });
      onDieSelected(null);
    }
  }

  function handleDieOnCardClick(dieIndex: number) {
    if (isActive && isRollPhase && isCurrentPlayer) {
      dispatch({ type: 'RETURN_DIE', formationId: card.id, dieIndex });
    }
  }

  function handleActionClick(actionIndex: number) {
    dispatch({ type: 'TAKE_ACTION', formationId: card.id, actionIndex });
  }

  function handleReactionClick(actionIndex: number) {
    dispatch({ type: 'TAKE_REACTION', formationId: card.id, actionIndex });
  }

  return (
    <div
      className="rounded-lg p-3 text-xs cursor-pointer select-none transition-all"
      style={{
        background: wingBg,
        border: cardBorder,
        opacity: cardOpacity,
        minWidth: '160px',
        maxWidth: '200px',
        position: 'relative',
      }}
      onClick={canReceiveDie ? handleCardClick : undefined}
      title={canReceiveDie ? `Assign die to ${card.name}` : card.name}
    >
      {/* Wing indicator */}
      <div
        className="absolute top-0 left-0 bottom-0 w-1.5 rounded-l-lg"
        style={{ background: wingColor }}
      />

      <div className="pl-1.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-1 mb-1">
          <div>
            <span className="font-bold text-sm leading-tight" style={{ color: '#e8e0d0' }}>
              {card.name}
            </span>
            {card.isStarred && (
              <span className="ml-1" style={{ color: '#c9a84c' }} title="Starred — 2 Morale on rout">★</span>
            )}
          </div>
          <span className="text-xs font-mono shrink-0" style={{ color: wingColor }}>
            {card.wing}
          </span>
        </div>

        {/* Status badges */}
        {(isDead || inReserve) && (
          <div className="mb-1">
            {isRouted && <span className="text-xs font-bold" style={{ color: '#e05c5c' }}>ROUTED</span>}
            {isRetired && <span className="text-xs font-bold" style={{ color: '#9a8c7e' }}>RETIRED</span>}
            {hasPursued && <span className="text-xs font-bold" style={{ color: '#9a8c7e' }}>PURSUED</span>}
            {inReserve && !isDead && <span className="text-xs font-bold" style={{ color: '#6b9ebc' }}>IN RESERVE</span>}
          </div>
        )}

        {/* Strength / Units */}
        {card.isSpecial ? (
          <div className="flex items-center gap-1 mb-1">
            <span style={{ color: '#9a8c7e' }}>Special {card.specialMax === 1 ? 'I' : card.specialMax === 2 ? 'II' : 'III'}</span>
            <div className="flex gap-0.5 ml-1">
              {Array.from({ length: formation.cubesOnCard }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: '#c9a84c' }} title="Cube" />
              ))}
              {Array.from({ length: Math.max(0, (card.specialMax ?? 1) - formation.cubesOnCard) }).map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-sm" style={{ background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)' }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 mb-1">
            {Array.from({ length: card.strength }).map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{
                  background: i < formation.unitsRemaining ? '#8eb8d0' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                title={i < formation.unitsRemaining ? 'Unit' : 'Lost'}
              />
            ))}
            <span className="ml-1" style={{ color: '#9a8c7e' }}>
              {formation.unitsRemaining}/{card.strength}
            </span>
          </div>
        )}

        {/* Dice area */}
        <div className="mb-1">
          <span style={{ color: '#9a8c7e' }}>Dice Area: </span>
          <span style={{ color: '#c9a84c' }}>{diceAreaLabel(card)}</span>
        </div>

        {/* Dice on card */}
        {formation.diceOnCard.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {formation.diceOnCard.map((val, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); handleDieOnCardClick(i); }}
                className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center"
                style={{
                  background: 'rgba(201,168,76,0.25)',
                  border: '1px solid rgba(201,168,76,0.6)',
                  color: '#c9a84c',
                  cursor: isActive && isRollPhase && isCurrentPlayer ? 'pointer' : 'default',
                }}
                title={isActive && isRollPhase && isCurrentPlayer ? `Return ${val} to pool` : `Die: ${val}`}
              >
                {val}
              </button>
            ))}
          </div>
        )}

        {/* Special rule text */}
        {card.specialRuleText && (
          <div className="mb-1 text-xs italic leading-snug" style={{ color: '#7a9ea8' }}>
            {card.specialRuleText}
          </div>
        )}

        {/* Actions */}
        {canTakeAction && (
          <div className="mt-1 flex flex-col gap-1">
            {card.actions.map((action, i) => {
              const isAttackOrBombard = action.actionType === 'Attack' || action.actionType === 'Bombard' || action.actionType === 'Command';
              if (!isAttackOrBombard) return null;
              return (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleActionClick(i); }}
                  className="text-xs rounded px-2 py-1 font-semibold text-left transition-all"
                  style={{
                    background: 'rgba(201,168,76,0.15)',
                    border: '1px solid rgba(201,168,76,0.4)',
                    color: '#c9a84c',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.15)';
                  }}
                  title={action.description}
                >
                  {action.actionType}: {action.description}
                </button>
              );
            })}
          </div>
        )}

        {/* Reactions */}
        {isReactionTarget && (
          <div className="mt-1 flex flex-col gap-1">
            {reactionOptions.map((r, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); handleReactionClick(r.actionIndex); }}
                className="text-xs rounded px-2 py-1 font-semibold text-left transition-all"
                style={{
                  background: 'rgba(74,156,94,0.2)',
                  border: '1px solid rgba(74,156,94,0.5)',
                  color: '#4a9c5e',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(74,156,94,0.35)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(74,156,94,0.2)';
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
