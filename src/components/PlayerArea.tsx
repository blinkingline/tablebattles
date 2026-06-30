import { useState } from 'react';
import type { GameState } from '../types';
import type { GameAction } from '../engine/gameReducer';
import { getCard } from '../data/cards';
import FormationCardDisplay from './FormationCardDisplay';
import MoraleTracker from './MoraleTracker';
import DiceRoller from './DiceRoller';

interface Props {
  state: GameState;
  playerIndex: 0 | 1;
  dispatch: (action: GameAction) => void;
  isBottom: boolean;
}

export default function PlayerArea({ state, playerIndex, dispatch, isBottom }: Props) {
  const [selectedDieIndices, setSelectedDieIndices] = useState<number[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const player = state.players[playerIndex];
  const isCurrentPlayer = state.currentPlayerIndex === playerIndex;
  const isRollPhase = state.phase === 'roll-phase';
  const isActionPhase = state.phase === 'action-phase';
  const isReactionPhase = state.phase === 'awaiting-reaction';

  const isActive = isBottom;

  const canAct = isActive && isCurrentPlayer;
  const opponentIndex = (1 - playerIndex) as 0 | 1;
  const pendingAction = state.pendingAction;
  const isPendingDefender = isReactionPhase && pendingAction?.actingPlayerIndex === opponentIndex;

  const hasAnyAction = isActionPhase && canAct && player.formations.some(f => {
    const c = getCard(f.cardId);
    if (f.isRouted || f.isRetired || f.hasPursued || f.inReserve) return false;
    return c.isSpecial ? f.cubesOnCard > 0 : f.diceOnCard.length > 0;
  });

  function handleDieClick(poolIndex: number) {
    if (!isActive || !isRollPhase || !isCurrentPlayer) return;
    setAssignError(null);
    setSelectedDieIndices(prev =>
      prev.includes(poolIndex)
        ? prev.filter(i => i !== poolIndex)
        : [...prev, poolIndex]
    );
  }

  function handleDieSelected(indices: number[]) {
    setSelectedDieIndices(indices);
    if (indices.length === 0) setAssignError(null);
  }

  return (
    <div
      className="flex flex-col gap-3 p-4"
      style={{
        transform: isBottom ? undefined : 'rotate(180deg)',
        minHeight: '280px',
      }}
    >
      {/* Header row: faction name + morale */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="font-bold text-sm"
            style={{ color: isCurrentPlayer ? '#c9a84c' : '#9a8c7e' }}
          >
            {player.factionName}
            {isCurrentPlayer && <span className="ml-2 text-xs">(Active)</span>}
          </span>
        </div>
        <MoraleTracker
          morale={player.morale}
          factionName={player.factionName}
          isBottom={isBottom}
        />
      </div>

      {/* Phase controls (bottom/active player only) */}
      {isActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {isActionPhase && canAct && (
            <button
              onClick={() => dispatch({ type: 'PASS_ACTION' })}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={{
                background: hasAnyAction ? 'rgba(100,100,180,0.15)' : 'rgba(180,80,80,0.15)',
                border: hasAnyAction ? '1px solid rgba(100,100,180,0.4)' : '1px solid rgba(180,80,80,0.4)',
                color: hasAnyAction ? '#8080cc' : '#e88',
              }}
            >
              {hasAnyAction ? 'Pass Action → Roll Phase' : 'No Action → Roll Phase'}
            </button>
          )}

          {isReactionPhase && isPendingDefender && (
            <>
              <div className="text-xs font-bold" style={{ color: '#e8a030' }}>
                {state.players[pendingAction!.actingPlayerIndex].factionName} attacks!
                React or decline:
              </div>
              {state.availableReactions.every(r => {
                const c = getCard(r.formationId);
                return c.actions[r.actionIndex]?.voluntary === true;
              }) && (
                <button
                  onClick={() => dispatch({ type: 'NO_REACTION' })}
                  className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style={{
                    background: 'rgba(100,100,100,0.15)',
                    border: '1px solid rgba(100,100,100,0.4)',
                    color: '#9a8c7e',
                  }}
                >
                  No Reaction
                </button>
              )}
            </>
          )}

          {/* Dice pool — multi-select */}
          {isRollPhase && isCurrentPlayer && player.dicePool.length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1 items-center">
                <span className="text-xs" style={{ color: '#9a8c7e' }}>
                  Pool (click to select):
                </span>
                {player.dicePool.map((val, i) => {
                  const isSelected = selectedDieIndices.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => handleDieClick(i)}
                      className="w-8 h-8 rounded text-sm font-bold flex items-center justify-center transition-all"
                      style={{
                        background: isSelected ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)',
                        border: isSelected ? '2px solid #c9a84c' : '1px solid rgba(255,255,255,0.2)',
                        color: '#e8e0d0',
                      }}
                      title={isSelected ? `Deselect ${val}` : `Select ${val}`}
                    >
                      {val}
                    </button>
                  );
                })}
                {selectedDieIndices.length > 0 && (
                  <span className="text-xs" style={{ color: '#c9a84c' }}>
                    → click a formation to assign ({selectedDieIndices.length} selected)
                  </span>
                )}
              </div>
              {assignError && (
                <div className="text-xs px-2 py-1 rounded" style={{ color: '#e05c5c', background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)' }}>
                  {assignError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Skipped action notice — shown to the reactor during their roll phase */}
      {isActive && isRollPhase && isCurrentPlayer && state.skippedPlayerIndex === playerIndex && (
        <div className="text-xs italic px-2 py-1 rounded" style={{ color: '#9a8c7e', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          No action this turn — you reacted during your opponent's last turn.
        </div>
      )}

      {/* Roll Phase controls */}
      {isActive && (
        <DiceRoller
          state={state}
          playerIndex={playerIndex}
          dispatch={dispatch}
          isActive={isActive}
        />
      )}

      {/* Formations */}
      <div className="flex flex-wrap gap-3 mt-1 justify-center">
        {player.formations.map((formation) => {
          const card = getCard(formation.cardId);
          return (
            <FormationCardDisplay
              key={card.id}
              card={card}
              formation={formation}
              state={state}
              playerIndex={playerIndex}
              dispatch={dispatch}
              isActive={isActive}
              selectedDieIndices={isActive ? selectedDieIndices : []}
              onDieSelected={handleDieSelected}
              onAssignError={setAssignError}
            />
          );
        })}
      </div>
    </div>
  );
}
