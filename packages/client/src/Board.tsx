import type { CSSProperties, PointerEvent } from 'react';
import type { AttackMode, Card, GameView, PlayerId } from '@ws/engine';
import { CardImg, PowerTag } from './CardFace.tsx';
import { cardById } from './meta.ts';

// 場地座標，單位 u＝一張直放卡片的寬度（卡片高 1.4u）。依官方場地圖，以我方半場為準；
// 對手半場點對稱，但卡片文字不倒轉，一律朝向自己。
// 點對稱的中心＝前列中間那格的中線，雙方前列才會一格對一格
const C = 4.76;
export const MAT = { W: C * 2, H: 4.5 };
const R = 1.4; // 卡片長邊
type Box = { x: number; y: number; w: number; h: number };
const Z = {
  stock: { x: C - 4.61, y: 1.55, w: R, h: 2.85 },
  climax: { x: C - 2.91, y: 1.62, w: R, h: 1 },
  level: { x: C - 2.91, y: 2.75, w: R, h: 1.7 },
  front: [-1, 0, 1].map((k) => ({ x: C - 0.5 + k * 1.32, y: 0.1, w: 1, h: R })),
  back: [-1, 1].map((k) => ({ x: C - 0.5 + k * 0.66, y: 1.62, w: 1, h: R })),
  clock: { x: C - 1.16, y: 3.08, w: 2.95, h: R },
  memory: { x: C + 2.27, y: 0.1, w: R, h: 1 },
  deck: { x: C + 2.5, y: 1.3, w: 1, h: R },
  resolution: { x: C + 3.62, y: 1.3, w: 1, h: R }, // 牌組右邊：判定、傷害翻開的卡暫放這裡
  waiting: { x: C + 2.5, y: 2.95, w: 1, h: R },
} satisfies Record<string, Box | Box[]>;

const u = (n: number) => `calc(var(--u) * ${n})`;
const place = (b: Box, mine: boolean): CSSProperties => {
  const x = mine ? b.x : MAT.W - b.x - b.w;
  const y = mine ? MAT.H + b.y : MAT.H - b.y - b.h;
  return { left: u(x), top: u(y), width: u(b.w), height: u(b.h) };
};

// 區域彈窗的兩種樣式：inline＝點卡後說明顯示在同一頁下方；layer＝點卡後再開一層說明（休息室）
export type ZoneMode = 'inline' | 'layer';

export interface BoardProps {
  view: GameView;
  viewer: PlayerId;
  active: PlayerId; // 現在是誰的回合：那半邊會發光
  power: (uid: string) => number;
  soul: (uid: string) => number;
  selected: string | null;
  glow: Set<string>; // 現在可以點選的卡（例如可攻擊的角色）
  dropTargets: Set<string>; // 拖曳中可以放的地方：slot-0～4、climax、clock
  dragOver: string | null;
  draggingFrom: number | null; // 從舞台拖曳時，原本的格子
  onCard: (uid: string, p: PlayerId) => void;
  onZone: (title: string, uids: string[], mode: ZoneMode) => void;
  onStagePointer: (e: PointerEvent, slot: number) => void;
  attackModes: Record<number, AttackMode[]>; // 可以攻擊的格子與攻擊方式
  onAttack: (slot: number, mode: AttackMode) => void;
}

export function Board(props: BoardProps) {
  const activeMine = props.active === props.viewer;
  return (
    <div className="mat" style={{ width: u(MAT.W), height: u(MAT.H * 2) }}>
      <div className={`half-glow ${activeMine ? 'me' : 'opp'}`} style={{ top: activeMine ? u(MAT.H) : 0, height: u(MAT.H) }} />
      <div className="mat-center" style={{ top: u(MAT.H) }} />
      <Half {...props} p={(1 - props.viewer) as PlayerId} mine={false} />
      <Half {...props} p={props.viewer} mine />
    </div>
  );
}

function Half({ view, p, mine, power, soul, selected, glow, dropTargets, dragOver, draggingFrom, onCard, onZone, onStagePointer, attackModes, onAttack }: BoardProps & { p: PlayerId; mine: boolean }) {
  const s = view.players[p];
  const who = mine ? '你的' : '對手的';
  const card = (uid: string): Card | undefined => {
    const id = view.cards[uid]?.cardId;
    return id ? cardById.get(id) : undefined;
  };
  const slots = [...Z.front, ...Z.back];
  const drop = (key: string) => (mine && dropTargets.has(key) ? ` drop-ok${dragOver === key ? ' drop-over' : ''}` : '');
  const top = (arr: string[]) => arr[arr.length - 1];

  return (
    <>
      {/* 舞台 */}
      {slots.map((b, i) => {
        const sc = s.stage[i];
        const c = sc ? card(sc.uid) : undefined;
        const key = `slot-${i}`;
        const cls = ['zone stage', i < 3 ? 'z-front' : 'z-back', sc && selected === sc.uid ? 'sel' : '', sc && glow.has(sc.uid) ? 'glow' : ''].join(' ');
        return (
          <div key={i} data-drop={mine ? key : undefined} data-slot={`${p}-${i}`} className={cls + drop(key)} style={place(b, mine)}>
            {!c && <span className="zlabel">{i < 3 ? '前列' : '後列'}</span>}
            {c && sc && (
              <>
                <CardImg
                  card={c}
                  uid={sc.uid}
                  rested={sc.state === 'rest'}
                  reversed={sc.state === 'reverse'}
                  className={mine && draggingFrom === i ? 'lifted' : ''}
                  onPointerDown={mine ? (e) => onStagePointer(e, i) : undefined}
                  onClick={mine ? undefined : () => onCard(sc.uid, p)}
                />
                <PowerTag card={c} power={power(sc.uid)} soul={soul(sc.uid)} />
                {!!view.markers?.[sc.uid]?.length && <span className="marker-badge" title="這張角色下面的標記">標記 {view.markers[sc.uid]!.length}</span>}
              </>
            )}
            {mine && sc && selected === sc.uid && attackModes[i] && <AttackButtons modes={attackModes[i]!} onAttack={(m) => onAttack(i, m)} />}
          </div>
        );
      })}

      {/* 名場面區：橫放、顯示卡面 */}
      <div data-drop={mine ? 'climax' : undefined} data-zone={`climax-${p}`} className={`zone z-climax${drop('climax')}`} style={place(Z.climax, mine)}>
        {s.climax.length ? <CardImg card={card(top(s.climax)!)} uid={top(s.climax)} landscape onClick={() => onCard(top(s.climax)!, p)} /> : <span className="zlabel">名場面</span>}
      </div>

      {/* 等級區：橫放疊起，顯示卡面 */}
      <Stack box={Z.level} mine={mine} zone={`level-${p}`} label="等級" className="z-level" count={s.level.length} onClick={() => onZone(`${who}等級區`, s.level, 'inline')}>
        {s.level.map((id, i) => (
          <CardImg key={id} uid={id} card={card(id)} landscape style={{ top: u(mine ? 1.7 - 1 - i * 0.24 : i * 0.24), zIndex: 10 - i }} />
        ))}
      </Stack>

      {/* 能量區：橫放牌背直排疊起 */}
      <Stack box={Z.stock} mine={mine} zone={`stock-${p}`} label="能量" className="z-stock" count={s.stock.length}>
        {s.stock.map((id, i) => {
          const step = Math.min(0.2, (Z.stock.h - 1) / Math.max(1, s.stock.length - 1));
          return <CardImg key={id} uid={id} landscape style={{ top: u(mine ? Z.stock.h - 1 - i * step : i * step), zIndex: i }} />;
        })}
      </Stack>

      {/* 傷害區：直放，往右錯開，最多 7 張。時計階段可以把手牌拖進來 */}
      <Stack box={Z.clock} mine={mine} zone={`clock-${p}`} label="傷害" className={`z-clock${drop('clock')}`} drop={mine ? 'clock' : undefined} count={s.clock.length} countSuffix="/7" onClick={() => onZone(`${who}傷害區`, s.clock, 'inline')}>
        {s.clock.map((id, i) => (
          <CardImg key={id} uid={id} card={card(id)} style={{ left: u(mine ? i * 0.325 : Z.clock.w - 1 - i * 0.325), zIndex: i, width: u(1), height: u(R) }} />
        ))}
      </Stack>

      {/* 回憶區 */}
      <Stack box={Z.memory} mine={mine} zone={`memory-${p}`} label="回憶" className="z-memory" count={s.memory.length} onClick={() => onZone(`${who}回憶區`, s.memory, 'inline')}>
        {s.memory.length > 0 && <CardImg card={card(top(s.memory)!)} uid={top(s.memory)} landscape />}
      </Stack>

      {/* 牌組：牌背＋厚度 */}
      <Pile box={Z.deck} mine={mine} zone={`deck-${p}`} label="牌組" count={s.deck.length} />

      {/* 解決領域：牌組右邊，判定與傷害翻開的卡（翻開時才出現） */}
      {s.resolution.length > 0 && (
        <div className="zone z-resolution" data-zone={`resolution-${p}`} style={place(Z.resolution, mine)}>
          {s.resolution.map((id, i) => (
            <CardImg key={id} uid={id} card={card(id)} style={{ top: u(i * 0.2), zIndex: i }} />
          ))}
        </div>
      )}

      {/* 休息室：公開領域，雙方都能翻閱〔3.4.2〕 */}
      <Pile box={Z.waiting} mine={mine} zone={`waiting-${p}`} label="休息室" count={s.waiting.length} topUid={top(s.waiting)} top={s.waiting.length ? card(top(s.waiting)!) : undefined} onClick={() => onZone(`${who}休息室`, s.waiting, 'layer')} />
    </>
  );
}

// 攻擊方式按鈕：直式，貼在攻擊角色的左右兩側（左：正打／直接攻擊，右：側打）
function AttackButtons({ modes, onAttack }: { modes: AttackMode[]; onAttack: (m: AttackMode) => void }) {
  const btn = (m: AttackMode, side: 'l' | 'r') => (
    <button key={m} className={`atk-btn ${side} ${m}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAttack(m); }}>
      <i>{m === 'side' ? '⟋' : '⚔'}</i>
      <span>{{ front: '正打', side: '側打', direct: '直接攻擊' }[m]}</span>
    </button>
  );
  return (
    <>
      {modes.includes('front') && btn('front', 'l')}
      {modes.includes('direct') && btn('direct', 'l')}
      {modes.includes('side') && btn('side', 'r')}
    </>
  );
}

function Stack({ box, mine, zone, label, className, drop, count, countSuffix = '', onClick, children }: {
  box: Box; mine: boolean; zone: string; label: string; className: string; drop?: string; count?: number; countSuffix?: string; onClick?: () => void; children?: React.ReactNode;
}) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div data-drop={drop} data-zone={zone} className={`zone ${className}${onClick ? ' clickable' : ''}`} style={place(box, mine)} onClick={onClick}>
      {empty && <span className="zlabel">{label}</span>}
      {children}
      {count !== undefined && count > 0 && <span className="zcount">{count}{countSuffix}</span>}
    </div>
  );
}

function Pile({ box, mine, zone, label, count, top, topUid, onClick }: {
  box: Box; mine: boolean; zone: string; label: string; count: number; top?: Card; topUid?: string; onClick?: () => void;
}) {
  // 依張數疊出厚度（50 張約 0.14u）
  const depth = Math.min(1, count / 50) * 0.14;
  const layers = Math.ceil((depth / 0.14) * 7);
  const shadow = Array.from({ length: layers }, (_, i) => {
    const d = `calc(var(--u) * ${((i + 1) / 7) * 0.14 * 0.6})`;
    return `${d} ${d} 0 ${i % 2 ? '#c9ccd3' : '#a9adb7'}`;
  }).concat('0 6px 14px rgba(0,0,0,.45)').join(',');
  return (
    <div data-zone={zone} className={`zone z-pile${onClick ? ' clickable' : ''}`} style={place(box, mine)} onClick={onClick}>
      {count === 0 ? (
        <span className="zlabel">{label}</span>
      ) : (
        <CardImg key={topUid} card={top} uid={topUid} style={{ boxShadow: shadow, transform: `translate(calc(var(--u) * ${-depth * 0.6}), calc(var(--u) * ${-depth * 0.6}))` }} />
      )}
      <span className="zcount">{count}</span>
    </div>
  );
}
