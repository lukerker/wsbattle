import { useEffect, useRef, useState } from 'react';
import { play, setSound, useSound } from './sound.ts';

// 音效設定：喇叭按鈕，點開調音量、開關音效（大廳與對戰畫面共用，設定存在這台裝置）
export function SoundControl({ compact = false }: { compact?: boolean }) {
  const { volume, muted } = useSound();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const off = muted || volume === 0;
  return (
    <div className="sound-ctl" ref={ref}>
      <button className="btn ghost" onClick={() => setOpen(!open)} aria-label="音效設定" title="音效設定">
        {off ? '🔇' : volume < 0.4 ? '🔈' : '🔊'}{compact ? '' : ' 音效'}
      </button>
      {open && (
        <div className="sound-pop">
          <label className="sound-row">
            <input type="checkbox" checked={!muted} onChange={(e) => setSound({ muted: !e.target.checked })} />
            <span>開啟音效</span>
          </label>
          <label className="sound-row">
            <span>音量</span>
            <input
              type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} disabled={muted}
              onChange={(e) => setSound({ volume: Number(e.target.value) / 100 })}
              onPointerUp={() => play('turn')}
              onKeyUp={() => play('turn')}
            />
            <b>{Math.round(volume * 100)}</b>
          </label>
          <button className="btn" disabled={off} onClick={() => play('alert')}>試聽</button>
        </div>
      )}
    </div>
  );
}
