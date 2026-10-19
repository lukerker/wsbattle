import type { CSSProperties, PointerEvent } from 'react';
import type { Card } from '@ws/engine';
import { CardImg, PowerTag } from './CardFace.tsx';
import { cardById, type SideState } from './mock.ts';

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
  me: SideState;
  opp: SideState;
  selected: number | null;
  dragging: 'character' | 'climax' | null; // 拖曳中的卡可以放到哪類格子
  dragOver: string | null;
  draggingFrom: number | null; // 從舞台拖曳時，原本的格子
  onPeek: (c: Card) => void;
  onZone: (title: string, ids: string[], mode: ZoneMode) => void;
  onStagePointer: (e: PointerEvent, i: number) => void;
}

export function Board(props: BoardProps) {
  return (
    <div className="mat" style={{ width: u(MAT.W), height: u(MAT.H * 2) }}>
      <div className="mat-center" style={{ top: u(MAT.H) }} />
      <Half {...props} s={props.opp} mine={false} />
      <Half {...props} s={props.me} mine />
    </div>
  );
}

function Half({ s, mine, selected, dragging, dragOver, draggingFrom, onPeek, onZone, onStagePointer }: BoardProps & { s: SideState; mine: boolean }) {
  const who = mine ? '你的' : '對手的';
  const card = (id: string) => cardById.get(id)!;
  const slots = [...Z.front, ...Z.back];
  const dropCls = (key: string, ok: boolean) => (mine && ok ? ` drop-ok${dragOver === key ? ' drop-over' : ''}` : '');

  return (
    <>
      {/* 舞台 */}
      {slots.map((b, i) => {
        const p = s.stage[i];
        const c = p ? card(p.id) : null;
        const key = `slot-${i}`;
        return (
          <div
            key={i}
            data-drop={mine ? key : undefined}
            className={`zone stage ${i < 3 ? 'z-front' : 'z-back'}${mine && selected === i ? ' sel' : ''}${dropCls(key, dragging === 'character')}`}
            style={place(b, mine)}
          >
            {!c && <span className="zlabel">{i < 3 ? '前列' : '後列'}</span>}
            {c && (
              <>
                <CardImg
                  card={c}
                  rested={p!.rested}
                  className={mine && draggingFrom === i ? 'lifted' : ''}
                  onPointerDown={mine ? (e) => onStagePointer(e, i) : undefined}
                  onClick={mine ? undefined : () => onPeek(c)}
                />
                <PowerTag card={c} />
              </>
            )}
          </div>
        );
      })}

      {/* 名場面區：橫放、顯示卡面 */}
      <div data-drop={mine ? 'climax' : undefined} className={`zone z-climax${dropCls('climax', dragging === 'climax')}`} style={place(Z.climax, mine)}>
        {s.climax.length ? (
          <CardImg card={card(s.climax[s.climax.length - 1]!)} landscape onClick={() => onPeek(card(s.climax[s.climax.length - 1]!))} />
        ) : (
          <span className="zlabel">名場面</span>
        )}
      </div>

      {/* 等級區：橫放疊起，顯示卡面 */}
      <Stack box={Z.level} mine={mine} label="等級" className="z-level" onClick={() => onZone(`${who}等級區`, s.level, 'inline')}>
        {s.level.map((id, i) => (
          <CardImg key={i} card={card(id)} landscape style={{ top: u(mine ? 1.7 - 1 - i * 0.24 : i * 0.24), zIndex: 10 - i }} />
        ))}
      </Stack>

      {/* 能量區：橫放牌背直排疊起 */}
      <Stack box={Z.stock} mine={mine} label="能量" className="z-stock" count={s.stock}>
        {Array.from({ length: s.stock }).map((_, i) => {
          const step = Math.min(0.2, (Z.stock.h - 1) / Math.max(1, s.stock - 1));
          return <CardImg key={i} landscape style={{ top: u(mine ? Z.stock.h - 1 - i * step : i * step), zIndex: i }} />;
        })}
      </Stack>

      {/* 傷害區：直放，往右錯開，最多 7 張 */}
      <Stack box={Z.clock} mine={mine} label="傷害" className="z-clock" count={s.clock.length} countSuffix="/7" onClick={() => onZone(`${who}傷害區`, s.clock, 'inline')}>
        {s.clock.map((id, i) => (
          <CardImg key={i} card={card(id)} style={{ left: u(mine ? i * 0.325 : Z.clock.w - 1 - i * 0.325), zIndex: i, width: u(1), height: u(R) }} />
        ))}
      </Stack>

      {/* 回憶區 */}
      <Stack box={Z.memory} mine={mine} label="回憶" className="z-memory" onClick={() => onZone(`${who}回憶區`, s.memory, 'inline')}>
        {s.memory.length > 0 && <CardImg card={card(s.memory[s.memory.length - 1]!)} landscape />}
      </Stack>

      {/* 牌組：牌背＋厚度 */}
      <Pile box={Z.deck} mine={mine} label="牌組" count={s.deck} />

      {/* 休息室：最上面那張朝上＋厚度。自己的可以翻閱；對手的只看得到最上面那張 */}
      {(() => {
        const top = s.waiting.length ? card(s.waiting[s.waiting.length - 1]!) : undefined;
        return (
          <Pile
            box={Z.waiting}
            mine={mine}
            label="休息室"
            count={s.waiting.length}
            top={top}
            onClick={mine ? () => onZone(`${who}休息室`, s.waiting, 'layer') : top ? () => onPeek(top) : undefined}
          />
        );
      })()}
    </>
  );
}

function Stack({ box, mine, label, className, count, countSuffix = '', onClick, children }: {
  box: Box; mine: boolean; label: string; className: string; count?: number; countSuffix?: string; onClick?: () => void; children?: React.ReactNode;
}) {
  const empty = Array.isArray(children) ? children.length === 0 : !children;
  return (
    <div className={`zone ${className}${onClick ? ' clickable' : ''}`} style={place(box, mine)} onClick={onClick}>
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
