// 結合テスト共通 setup
// - @testing-library/jest-dom: DOM matchers
// - vitest-axe: a11y matchers (toHaveNoViolations)
//
// Vitest v4 では vitest-axe v0.1 の `Vi.Assertion` 拡張が効かないため、
// 自前で `vitest` module の Assertion を拡張する。

import "@testing-library/jest-dom/vitest";
import { expect } from "vitest";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}
