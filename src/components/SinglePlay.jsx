import { useEffect, useMemo } from 'react';
import { Game } from '../engine/game.js';
import GameView from './GameView.jsx';

export default function SinglePlay({ cfg, onExit, onAgain, onRecorded }) {
  const game = useMemo(() => new Game(cfg), [cfg]);
  useEffect(() => { game.start(); return () => game.destroy(); }, [game]);
  return (
    <GameView store={game} meId="me" submit={async (t) => game.submit('me', t)} record
      onExit={onExit} onAgain={onAgain} onRecorded={onRecorded} />
  );
}
