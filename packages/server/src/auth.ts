// 驗證 Firebase 登入的 ID token：用 Google 公開的金鑰檢查簽章，只需要專案 ID，不需要任何機密金鑰。
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { User } from '@ws/engine';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export function firebaseVerifier(projectId: string) {
  return async (token: string): Promise<User> => {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) throw new Error('token 沒有使用者 ID');
    const email = typeof payload.email === 'string' ? payload.email : '';
    const name = typeof payload.name === 'string' && payload.name ? payload.name : email.split('@')[0] || '玩家';
    return { id: payload.sub, name };
  };
}
