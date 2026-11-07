import LineWaves from './LineWaves.jsx';
import SwarmCursor from './SwarmCursor.jsx';
import TargetCursor from './TargetCursor.jsx';

const TARGETS = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), label, .cursor-target';

// 로비·방 목록이 함께 쓰는 무대: 검정 바탕 → LineWaves 물결선 → SwarmCursor 입자 → 화면 내용(내부 스크롤)
export default function LobbyStage({ children }) {
  return (
    <div className="lobby-stage">
      <LineWaves className="lobby-waves" />
      <SwarmCursor count={800} size={2.6} spread={90} swirl={0.6} clickEffect="burst" className="lobby-swarm">
        <TargetCursor targetSelector={TARGETS} />
        {children}
      </SwarmCursor>
    </div>
  );
}
