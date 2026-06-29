import type { GameState } from '../types';
import type { GameAction } from '../engine/gameReducer';

interface Props {
  state: GameState;
  playerIndex: 0 | 1;
  dispatch: (action: GameAction) => void;
  isActive: boolean;
}

export default function DiceRoller({ state, playerIndex, dispatch, isActive }: Props) {
  const player = state.players[playerIndex];
  const isRollPhase = state.phase === 'roll-phase';
  const isCurrentPlayer = state.currentPlayerIndex === playerIndex;
  const canInteract = isActive && isRollPhase && isCurrentPlayer;

  if (!isRollPhase || !canInteract) return null;

  const totalDice = 6;
  const diceOnFormations = player.formations.reduce((sum, f) => sum + f.diceOnCard.length, 0);
  const poolSize = totalDice - diceOnFormations;
  const hasRolled = player.dicePool.length > 0 || diceOnFormations > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {!hasRolled && (
        <button
          onClick={() => dispatch({ type: 'ROLL_DICE' })}
          className="px-4 py-2 rounded font-semibold text-sm transition-all"
          style={{
            background: 'rgba(201,168,76,0.2)',
            border: '1px solid rgba(201,168,76,0.6)',
            color: '#c9a84c',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.35)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.2)'; }}
        >
          Roll {poolSize} {poolSize === 1 ? 'Die' : 'Dice'}
          {diceOnFormations > 0 && <span className="ml-1 text-xs opacity-70">({diceOnFormations} on cards)</span>}
        </button>
      )}

      {hasRolled && (
        <button
          onClick={() => dispatch({ type: 'END_ROLL_PHASE' })}
          className="px-4 py-2 rounded font-semibold text-sm transition-all"
          style={{
            background: 'rgba(180,80,80,0.15)',
            border: '1px solid rgba(180,80,80,0.4)',
            color: '#e88',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(180,80,80,0.3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(180,80,80,0.15)'; }}
        >
          End Roll Phase
          {player.dicePool.length > 0 && (
            <span className="ml-1 text-xs opacity-70">(discards {player.dicePool.length} unassigned)</span>
          )}
        </button>
      )}
    </div>
  );
}
