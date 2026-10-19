import { readdirSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// 開發用：把專案根目錄 cards/ 裡的卡面圖以 /card-img/<卡號> 提供給頁面。
// 卡圖有版權，只在本機開發伺服器提供，不會被打包進 build。
function cardImages(): Plugin {
  const root = join(import.meta.dirname, '../../cards');
  const index = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const m = e.name.match(/^([A-Za-z]+)_([A-Za-z0-9]+)_(T\d+)(?:\(\d+\))?\.webp$/);
        if (m) index.set(`${m[1]}/${m[2]}-${m[3]}`, p);
      }
    }
  };
  return {
    name: 'dev-card-images',
    apply: 'serve',
    configureServer(server) {
      try { walk(root); } catch { /* 沒有 cards 資料夾就算了，介面會用文字卡面 */ }
      server.middlewares.use('/card-img/', (req, res, next) => {
        const id = decodeURIComponent((req.url ?? '').slice(1));
        if (id === 'back') {
          res.setHeader('Content-Type', 'image/png');
          createReadStream(join(root, 'card back.png')).on('error', () => next()).pipe(res);
          return;
        }
        const file = index.get(id);
        if (!file) return next();
        res.setHeader('Content-Type', 'image/webp');
        createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({ plugins: [react(), cardImages()], server: { host: true, port: 5173 } });
