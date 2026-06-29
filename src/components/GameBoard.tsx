import type { GameState } from '../types';
import type { GameAction } from '../engine/gameReducer';
import { SCENARIOS } from '../data/scenarios';
import PlayerArea from './PlayerArea';

interface Props {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

function phaseLabel(state: GameState): string {
  switch (state.phase) {
    case 'action-phase': return `${state.players[state.currentPlayerIndex].factionName} — Action Phase`;
    case 'roll-phase': return `${state.players[state.currentPlayerIndex].factionName} — Roll Phase`;
    case 'awaiting-reaction': return 'Awaiting Reaction...';
    case 'game-over': return 'Game Over';
    default: return '';
  }
}

export default function GameBoard({ state, dispatch }: Props) {
  const scenario = SCENARIOS.find(s => s.id === state.scenarioId);

  // The "bottom" player is always the one whose turn it is.
  // During awaiting-reaction, bottom is the DEFENDER (opponent of acting player).
  const bottomPlayerIndex: 0 | 1 = state.phase === 'awaiting-reaction'
    ? (1 - state.pendingAction!.actingPlayerIndex) as 0 | 1
    : state.currentPlayerIndex;
  const topPlayerIndex: 0 | 1 = (1 - bottomPlayerIndex) as 0 | 1;

  if (state.phase === 'game-over') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div
          className="rounded-xl p-8 max-w-md w-full text-center"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(201,168,76,0.4)',
          }}
        >
          <div className="text-5xl mb-4">⚔️</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#c9a84c' }}>Battle Concluded</h2>
          {state.winner !== undefined && (
            <p className="text-xl font-semibold mb-2" style={{ color: '#e8e0d0' }}>
              {state.players[state.winner].factionName} wins!
            </p>
          )}
          {state.winReason && (
            <p className="mb-6" style={{ color: '#9a8c7e' }}>{state.winReason}</p>
          )}
          <button
            onClick={() => dispatch({ type: 'RESTART' })}
            className="px-6 py-3 rounded-lg font-semibold transition-all"
            style={{
              background: 'rgba(201,168,76,0.2)',
              border: '1px solid rgba(201,168,76,0.6)',
              color: '#c9a84c',
            }}
          >
            Play Again
          </button>
        </div>

        {/* Final log */}
        <div className="mt-4 max-w-md w-full">
          <div
            className="rounded-lg p-3 max-h-48 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {[...state.log].reverse().map((entry, i) => (
              <div key={i} className="text-xs mb-0.5" style={{ color: i === 0 ? '#c9a84c' : '#9a8c7e' }}>
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ maxHeight: '100vh', overflow: 'hidden' }}>
      {/* Top player (opponent perspective) */}
      <div
        className="flex-1 overflow-auto"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.15)',
        }}
      >
        <PlayerArea
          state={state}
          playerIndex={topPlayerIndex}
          dispatch={dispatch}
          isBottom={false}
        />
      </div>

      {/* Center panel: phase indicator + log */}
      <div
        className="px-4 py-2 flex items-center justify-between gap-4"
        style={{
          background: 'rgba(0,0,0,0.35)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          minHeight: '56px',
        }}
      >
        {/* Scenario + phase */}
        <div>
          <div className="text-xs font-mono" style={{ color: '#6b5d52' }}>
            {scenario?.scenarioNumber} · {scenario?.name}
          </div>
          <div className="text-sm font-semibold" style={{ color: '#c9a84c' }}>
            {phaseLabel(state)}
          </div>
        </div>

        {/* Log (last 3 entries) */}
        <div className="text-right flex-1 min-w-0">
          {state.log.slice(-3).map((entry, i, arr) => (
            <div
              key={i}
              className="text-xs truncate"
              style={{ color: i === arr.length - 1 ? '#e8e0d0' : '#6b5d52' }}
            >
              {entry}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom player (active perspective) */}
      <div
        className="flex-1 overflow-auto"
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        <PlayerArea
          state={state}
          playerIndex={bottomPlayerIndex}
          dispatch={dispatch}
          isBottom={true}
        />
      </div>
    </div>
  );
}
