import LineWaves from './LineWaves.jsx';
import TargetCursor from './TargetCursor.jsx';

const TARGETS = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), label, .cursor-target';

// 로비·방 목록이 함께 쓰는 무대: LineWaves 배경과 화면 내용
export default function LobbyStage({ children }) {
  return (
    <div className="lobby-stage">
      <LineWaves className="lobby-waves" />
      <TargetCursor targetSelector={TARGETS} />
      <div className="lobby-content">{children}</div>
    </div>
  );
}
