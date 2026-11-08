import LineWaves from './LineWaves.jsx';
import TargetCursor from './TargetCursor.jsx';

const TARGETS = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), label, .cursor-target';

// 로비·방 목록이 함께 쓰는 무대: 저부하 청록색→검정 LineWaves 배경
export default function LobbyStage({ children }) {
  return (
    <div className="lobby-stage">
      <LineWaves
        className="lobby-waves"
        color1="#0b3b3b"
        color2="#052020"
        color3="#000000"
        colorCycleSpeed={0}
        speed={0.12}
        lineCount={38}
        lineWidth={0.9}
        glow={0.22}
        brightness={0.58}
        highlight={0.35}
        warpIntensity={0.45}
        enableMouseInteraction={false}
        clickRipple={false}
        intro={false}
        maxDevicePixelRatio={1.25}
      />
      <TargetCursor targetSelector={TARGETS} />
      <div className="lobby-content">{children}</div>
    </div>
  );
}
