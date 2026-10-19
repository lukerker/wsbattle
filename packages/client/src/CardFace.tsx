import { useState, type CSSProperties, type PointerEvent } from 'react';
import type { Card } from '@ws/engine';

const COLOR_ZH: Record<string, string> = { yellow: '黃', red: '紅', blue: '藍', green: '綠', purple: '紫', colorless: '無' };
const TYPE_ZH: Record<string, string> = { character: '角色', event: '事件', climax: '名場面' };
const KIND_ZH = { continuous: '永', auto: '自', activated: '起', event: '事件' } as const;

export const BACK_URL = '/card-img/back';

interface ImgProps {
  card?: Card; // 沒給就是牌背
  landscape?: boolean; // 橫放（名場面、等級區、能量區、回憶區）
  rested?: boolean;
  reversed?: boolean; // 倒置（180 度）
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onPointerDown?: (e: PointerEvent) => void;
}

// 卡片本體：有卡圖用卡圖，沒有就用文字卡面。尺寸由外層決定（填滿）。
export function CardImg({ card, landscape, rested, reversed, className = '', style, onClick, onPointerDown }: ImgProps) {
  const [broken, setBroken] = useState(false);
  const face = !card ? (
    <img src={BACK_URL} alt="牌背" draggable={false} />
  ) : !broken ? (
    <img src={`/card-img/${encodeURIComponent(card.id)}`} alt={card.name.zh} draggable={false} onError={() => setBroken(true)} />
  ) : (
    <TextFace card={card} />
  );
  return (
    <div
      className={`cimg${landscape ? ' land' : ''}${rested ? ' rested' : ''}${reversed ? ' reversed' : ''}${card ? ` c-${card.color}` : ' back'} ${className}`}
      style={style}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <div className="cimg-in">{face}</div>
    </div>
  );
}

function TextFace({ card }: { card: Card }) {
  return (
    <div className="textface">
      <div className="tf-head">
        {card.level !== undefined && <span>Lv{card.level}</span>}
        {card.cost !== undefined && <span>費{card.cost}</span>}
        {card.type !== 'character' && <span>{TYPE_ZH[card.type]}</span>}
      </div>
      <div className="tf-name">{card.name.zh}</div>
    </div>
  );
}

// 攻擊力與魂傷的標籤，單行顯示；有傳入就顯示現場計算的值，和卡上印的不同時標色
export function PowerTag({ card, power, soul }: { card: Card; power?: number; soul?: number }) {
  if (card.type !== 'character') return null;
  const p = power ?? card.power ?? 0;
  const so = soul ?? card.soul ?? 0;
  return (
    <div className="ptag">
      <b className={p > (card.power ?? 0) ? 'up' : p < (card.power ?? 0) ? 'down' : ''}>{p}</b>
      <span>魂{so}</span>
    </div>
  );
}

// 手牌、彈窗用：卡片＋下方標籤
export function CardFace({ card, selected, dim, glow, onClick, onPointerDown }: {
  card: Card; selected?: boolean; dim?: boolean; glow?: boolean; onClick?: () => void; onPointerDown?: (e: PointerEvent) => void;
}) {
  return (
    <div className={`cardface${selected ? ' selected' : ''}${dim ? ' dim' : ''}${glow ? ' glow' : ''}`} onClick={onClick} onPointerDown={onPointerDown}>
      <CardImg card={card} />
      <PowerTag card={card} />
    </div>
  );
}

export function cardMeta(card: Card): string {
  const parts = [COLOR_ZH[card.color], TYPE_ZH[card.type]];
  if (card.level !== undefined) parts.push(`Lv${card.level}`);
  if (card.cost !== undefined) parts.push(`費用${card.cost}`);
  if (card.power !== undefined) parts.push(`攻擊${card.power}`);
  if (card.soul !== undefined) parts.push(`魂傷${card.soul}`);
  return parts.join('｜');
}

// 卡片說明：三欄（基本資料／效果／白話說明），用在區域彈窗與休息室詳細頁
export function CardInfo({ card }: { card: Card }) {
  return (
    <div className="info-cols">
      <div className="info-basic">
        <h4>{card.name.zh}</h4>
        <p className="ja">{card.name.ja}</p>
        <p className="meta">{cardMeta(card)}</p>
        {card.traits.length > 0 && <div className="traits">{card.traits.map((t) => <span key={t.ja}>{t.zh}</span>)}</div>}
      </div>
      <div className="info-effects">
        <h5>效果</h5>
        <Abilities card={card} />
      </div>
      <div className="info-note">
        <h5>白話說明</h5>
        <p>{card.note ?? '—'}</p>
      </div>
    </div>
  );
}

export function Abilities({ card }: { card: Card }) {
  return (
    <div className="abilities">
      {card.abilities.map((a, i) => (
        <p key={i}><span className={`kind k-${a.kind}`}>{KIND_ZH[a.kind]}</span>{a.text.zh.replace(/^【[永自起]】/, '')}</p>
      ))}
      {card.abilities.length === 0 && <p className="muted">沒有效果的純數值角色。</p>}
    </div>
  );
}
