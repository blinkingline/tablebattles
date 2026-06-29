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
  isBottom: boolean; // shown at bottom of screen (active perspective)
}

export default function PlayerArea({ state, playerIndex, dispatch, isBottom }: Props) {
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  const player = state.players[playerIndex];
  const isCurrentPlayer = state.currentPlayerIndex === playerIndex;
  const isRollPhase = state.phase === 'roll-phase';
  const isActionPhase = state.phase === 'action-phase';
  const isReactionPhase = state.phase === 'awaiting-reaction';

  const isActive = isBottom; // bottom player is always the one we're showing controls for

  const canAct = isActive && isCurrentPlayer;
  const opponentIndex = (1 - playerIndex) as 0 | 1;
  const pendingAction = state.pendingAction;
  const isPendingDefender = isReactionPhase && pendingAction?.actingPlayerIndex === opponentIndex;

  function handleDieClick(poolIndex: number) {
    if (!isActive || !isRollPhase || !isCurrentPlayer) return;
    if (selectedDieIndex === poolIndex) {
      setSelectedDieIndex(null);
    } else {
      setSelectedDieIndex(poolIndex);
    }
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
            style={{
              color: isCurrentPlayer ? '#c9a84c' : '#9a8c7e',
            }}
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
          {/* Action phase controls */}
          {isActionPhase && canAct && (
            <button
              onClick={() => dispatch({ type: 'PASS_ACTION' })}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={{
                background: 'rgba(100,100,180,0.15)',
                border: '1px solid rgba(100,100,180,0.4)',
                color: '#8080cc',
              }}
            >
              Pass Action → Roll Phase
            </button>
          )}

          {/* Reaction phase: no reaction button */}
          {isReactionPhase && isPendingDefender && (
            <>
              <div className="text-xs font-bold" style={{ color: '#e8a030' }}>
                {state.players[pendingAction!.actingPlayerIndex].factionName} attacks!
                React or decline:
              </div>
              {state.availableReactions.every(r => {
                const c = getCard(r.formationId);
                return c.actions[r.actionIndex]?.voluntary !== false;
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

          {/* Roll phase: die selection from pool */}
          {isRollPhase && isCurrentPlayer && player.dicePool.length > 0 && (
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-xs" style={{ color: '#9a8c7e' }}>
                Pool (click to select):
              </span>
              {player.dicePool.map((val, i) => (
                <button
                  key={i}
                  onClick={() => handleDieClick(i)}
                  className="w-8 h-8 rounded text-sm font-bold flex items-center justify-center transition-all"
                  style={{
                    background: selectedDieIndex === i
                      ? 'rgba(201,168,76,0.4)'
                      : 'rgba(255,255,255,0.1)',
                    border: selectedDieIndex === i
                      ? '2px solid #c9a84c'
                      : '1px solid rgba(255,255,255,0.2)',
                    color: '#e8e0d0',
                  }}
                  title={`Select die ${val}`}
                >
                  {val}
                </button>
              ))}
              {selectedDieIndex !== null && (
                <span className="text-xs" style={{ color: '#c9a84c' }}>
                  → click a formation to assign
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Roll Phase controls (roll button + end phase) */}
      {isActive && (
        <DiceRoller
          state={state}
          playerIndex={playerIndex}
          dispatch={dispatch}
          isActive={isActive}
        />
      )}

      {/* Formations */}
      <div className="flex flex-wrap gap-3 mt-1">
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
              selectedDieIndex={isActive ? selectedDieIndex : null}
              onDieSelected={setSelectedDieIndex}
            />
          );
        })}
      </div>
    </div>
  );
}
