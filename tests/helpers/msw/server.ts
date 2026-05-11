import { setupServer } from "msw/node";

/**
 * MSW node server for integration tests.
 *
 * 設計判断:
 * - onUnhandledRequest: 'error' で「想定外のリクエスト」を検出
 *   → テストが意図しない外部 API を叩いた場合に即座に気付ける
 * - handlers は各テストで `server.use(...)` で動的に追加 / 上書き可能
 *
 * 使い方:
 *   import { server } from '@/../tests/helpers/msw/server';
 *   import { successHandlers } from '@/../tests/helpers/msw/handlers';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 *   it('success', () => {
 *     server.use(...successHandlers);
 *     // ...
 *   });
 */
export const server = setupServer();
