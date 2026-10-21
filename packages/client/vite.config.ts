import { createReadStream, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// 卡圖：專案根目錄 cards/ 裡的卡面圖，網址是 /card-img/<系列>/<卡號>.webp（例：/card-img/BTR/W107-T01.webp），牌背是 /card-img/back.png。
// 檔名：預組 BTR_W107_T01(4).webp（括號是張數）、補充包 GBF_S134_001SP.webp、GCR_SE48_01GBC.webp（數字後面是稀有度，拿掉）。
// 開發時直接從 cards/ 讀；建置時複製進輸出資料夾，跟著前端網站一起部署。cards/ 不進版本庫。
function cardImages(): Plugin {
  const root = join(import.meta.dirname, '../../cards');
  const index = new Map<string, string>(); // 'BTR/W107-T01.webp' → 檔案路徑
  const scan = () => {
    index.clear();
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else {
          const m = e.name.match(/^([A-Za-z]+)_([A-Za-z0-9]+)_([A-Z]?\d+)[A-Za-z]*(?:\(\d+\))?\.webp$/);
          if (m) index.set(`${m[1]}/${m[2]}-${m[3]}.webp`, p);
        }
      }
    };
    try { walk(root); } catch { /* 沒有 cards 資料夾：畫面改用文字卡面 */ }
    index.set('back.png', join(root, 'card back.png'));
    // scripts/prepare-images.ps1 產生的網頁用圖：系統先攻／後攻卡、各系列的 VS 圖
    index.set('system/first.jpg', join(root, '_web/first.jpg'));
    index.set('system/last.jpg', join(root, '_web/last.jpg'));
    try {
      for (const f of readdirSync(join(root, '_web/vs'))) index.set(`vs/${f}`, join(root, '_web/vs', f));
    } catch { /* 還沒產生 VS 圖 */ }
  };
  return {
    name: 'card-images',
    configureServer(server) {
      scan();
      server.middlewares.use('/card-img/', (req, res, next) => {
        const file = index.get(decodeURIComponent((req.url ?? '').slice(1).split('?')[0] ?? ''));
        if (!file) return next();
        res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'image/webp');
        createReadStream(file).on('error', () => next()).pipe(res);
      });
    },
    generateBundle() {
      scan();
      let n = 0;
      for (const [name, file] of index) {
        try {
          this.emitFile({ type: 'asset', fileName: `card-img/${name}`, source: readFileSync(file) });
          n++;
        } catch { /* 檔案不在就略過 */ }
      }
      this.info(`卡圖 ${n} 張`);
    },
  };
}

export default defineConfig({ plugins: [react(), cardImages()], server: { host: true, port: 5173 } });
