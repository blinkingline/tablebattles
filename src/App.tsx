import { useReducer } from 'react';
import { gameReducer, defaultState } from './engine/gameReducer';
import ScenarioSelect from './components/ScenarioSelect';
import GameBoard from './components/GameBoard';
import PlayerAid from './components/PlayerAid';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, defaultState);

  return (
    <>
      {state.phase === 'scenario-select'
        ? <ScenarioSelect onSelect={(id) => dispatch({ type: 'SELECT_SCENARIO', scenarioId: id })} />
        : <GameBoard state={state} dispatch={dispatch} />
      }
      <PlayerAid />
    </>
  );
}
