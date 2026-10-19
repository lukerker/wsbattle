import type { CSSProperties, PointerEvent } from 'react';
import type { Card, GameView, PlayerId } from '@ws/engine';
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
  power: (uid: string) => number;
  soul: (uid: string) => number;
  selected: string | null;
  glow: Set<string>; // 現在可以點選的卡（例如可攻擊的角色、要選的倒置角色）
  dropTargets: Set<string>; // 拖曳中可以放的地方：slot-0～4、climax、clock
  dragOver: string | null;
  draggingFrom: number | null; // 從舞台拖曳時，原本的格子
  onCard: (uid: string, p: PlayerId) => void;
  onZone: (title: string, uids: string[], mode: ZoneMode) => void;
  onStagePointer: (e: PointerEvent, slot: number) => void;
}

export function Board(props: BoardProps) {
  return (
    <div className="mat" style={{ width: u(MAT.W), height: u(MAT.H * 2) }}>
      <div className="mat-center" style={{ top: u(MAT.H) }} />
      <Half {...props} p={(1 - props.viewer) as PlayerId} mine={false} />
      <Half {...props} p={props.viewer} mine />
    </div>
  );
}

function Half({ view, p, mine, power, soul, selected, glow, dropTargets, dragOver, draggingFrom, onCard, onZone, onStagePointer }: BoardProps & { p: PlayerId; mine: boolean }) {
  const s = view.players[p];
  const who = mine ? '你的' : '對手的';
  const card = (uid: string): Card | undefined => {
    const id = view.cards[uid]?.cardId;
    return id ? cardById.get(id) : undefined;
  };
  const slots = [...Z.front, ...Z.back];
  const drop = (key: string) => (mine && dropTargets.has(key) ? ` drop-ok${dragOver === key ? ' drop-over' : ''}` : '');
  const topOf = (arr: string[]) => (arr.length ? card(arr[arr.length - 1]!) : undefined);

  return (
    <>
      {/* 舞台 */}
      {slots.map((b, i) => {
        const sc = s.stage[i];
        const c = sc ? card(sc.uid) : undefined;
        const key = `slot-${i}`;
        const cls = [
          'zone stage', i < 3 ? 'z-front' : 'z-back',
          sc && selected === sc.uid ? 'sel' : '', sc && glow.has(sc.uid) ? 'glow' : '',
        ].join(' ');
        return (
          <div key={i} data-drop={mine ? key : undefined} className={cls + drop(key)} style={place(b, mine)}>
            {!c && <span className="zlabel">{i < 3 ? '前列' : '後列'}</span>}
            {c && sc && (
              <>
                <CardImg
                  card={c}
                  rested={sc.state === 'rest'}
                  reversed={sc.state === 'reverse'}
                  className={mine && draggingFrom === i ? 'lifted' : ''}
                  onPointerDown={mine ? (e) => onStagePointer(e, i) : undefined}
                  onClick={mine ? undefined : () => onCard(sc.uid, p)}
                />
                <PowerTag card={c} power={power(sc.uid)} soul={soul(sc.uid)} />
              </>
            )}
          </div>
        );
      })}

      {/* 名場面區：橫放、顯示卡面 */}
      <div data-drop={mine ? 'climax' : undefined} className={`zone z-climax${drop('climax')}`} style={place(Z.climax, mine)}>
        {s.climax.length ? (
          <CardImg card={topOf(s.climax)} landscape onClick={() => onCard(s.climax.at(-1)!, p)} />
        ) : (
          <span className="zlabel">名場面</span>
        )}
      </div>

      {/* 等級區：橫放疊起，顯示卡面 */}
      <Stack box={Z.level} mine={mine} label="等級" className="z-level" count={s.level.length} onClick={() => onZone(`${who}等級區`, s.level, 'inline')}>
        {s.level.map((id, i) => (
          <CardImg key={id} card={card(id)} landscape style={{ top: u(mine ? 1.7 - 1 - i * 0.24 : i * 0.24), zIndex: 10 - i }} />
        ))}
      </Stack>

      {/* 能量區：橫放牌背直排疊起 */}
      <Stack box={Z.stock} mine={mine} label="能量" className="z-stock" count={s.stock.length}>
        {s.stock.map((id, i) => {
          const step = Math.min(0.2, (Z.stock.h - 1) / Math.max(1, s.stock.length - 1));
          return <CardImg key={id} landscape style={{ top: u(mine ? Z.stock.h - 1 - i * step : i * step), zIndex: i }} />;
        })}
      </Stack>

      {/* 傷害區：直放，往右錯開，最多 7 張。時計階段可以把手牌拖進來 */}
      <Stack box={Z.clock} mine={mine} label="傷害" className={`z-clock${drop('clock')}`} drop={mine ? 'clock' : undefined} count={s.clock.length} countSuffix="/7" onClick={() => onZone(`${who}傷害區`, s.clock, 'inline')}>
        {s.clock.map((id, i) => (
          <CardImg key={id} card={card(id)} style={{ left: u(mine ? i * 0.325 : Z.clock.w - 1 - i * 0.325), zIndex: i, width: u(1), height: u(R) }} />
        ))}
      </Stack>

      {/* 回憶區 */}
      <Stack box={Z.memory} mine={mine} label="回憶" className="z-memory" count={s.memory.length} onClick={() => onZone(`${who}回憶區`, s.memory, 'inline')}>
        {s.memory.length > 0 && <CardImg card={topOf(s.memory)} landscape />}
      </Stack>

      {/* 牌組：牌背＋厚度 */}
      <Pile box={Z.deck} mine={mine} label="牌組" count={s.deck.length} />

      {/* 休息室：公開領域，雙方都能翻閱〔3.4.2〕 */}
      <Pile box={Z.waiting} mine={mine} label="休息室" count={s.waiting.length} top={topOf(s.waiting)} onClick={() => onZone(`${who}休息室`, s.waiting, 'layer')} />
    </>
  );
}

function Stack({ box, mine, label, className, drop, count, countSuffix = '', onClick, children }: {
  box: Box; mine: boolean; label: string; className: string; drop?: string; count?: number; countSuffix?: string; onClick?: () => void; children?: React.ReactNode;
}) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div data-drop={drop} className={`zone ${className}${onClick ? ' clickable' : ''}`} style={place(box, mine)} onClick={onClick}>
      {empty && <span className="zlabel">{label}</span>}
      {children}
      {count !== undefined && count > 0 && <span className="zcount">{count}{countSuffix}</span>}
    </div>
  );
}

function Pile({ box, mine, label, count, top, onClick }: {
  box: Box; mine: boolean; label: string; count: number; top?: Card; onClick?: () => void;
}) {
  // 依張數疊出厚度（50 張約 0.14u）
  const depth = Math.min(1, count / 50) * 0.14;
  const layers = Math.ceil((depth / 0.14) * 7);
  const shadow = Array.from({ length: layers }, (_, i) => {
    const d = `calc(var(--u) * ${((i + 1) / 7) * 0.14 * 0.6})`;
    return `${d} ${d} 0 ${i % 2 ? '#c9ccd3' : '#a9adb7'}`;
  }).concat('0 6px 14px rgba(0,0,0,.45)').join(',');
  return (
    <div className={`zone z-pile${onClick ? ' clickable' : ''}`} style={place(box, mine)} onClick={onClick}>
      {count === 0 ? (
        <span className="zlabel">{label}</span>
      ) : (
        <CardImg card={top} style={{ boxShadow: shadow, transform: `translate(calc(var(--u) * ${-depth * 0.6}), calc(var(--u) * ${-depth * 0.6}))` }} />
      )}
      <span className="zcount">{count}</span>
    </div>
  );
}
