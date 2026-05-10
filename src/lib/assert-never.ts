/**
 * Compile-time exhaustiveness check helper.
 * switch 文の default で呼ぶことで、union の全 case を網羅していないと型エラーになる。
 *
 * 使用例:
 *   type Kind = 'a' | 'b' | 'c';
 *   function f(k: Kind) {
 *     switch (k) {
 *       case 'a': return 1;
 *       case 'b': return 2;
 *       case 'c': return 3;
 *       default: assertNever(k); // 'c' を消すと TypeScript エラー
 *     }
 *   }
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value (assertNever): ${JSON.stringify(x)}`);
}
