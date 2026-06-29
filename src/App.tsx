import { useReducer } from 'react';
import { gameReducer, defaultState } from './engine/gameReducer';
import ScenarioSelect from './components/ScenarioSelect';
import GameBoard from './components/GameBoard';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, defaultState);

  if (state.phase === 'scenario-select') {
    return <ScenarioSelect onSelect={(id) => dispatch({ type: 'SELECT_SCENARIO', scenarioId: id })} />;
  }

  return (
    <GameBoard
      state={state}
      dispatch={dispatch}
    />
  );
}
