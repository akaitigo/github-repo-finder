import { describe, it, expect } from "vitest";
import { mapValidationError } from "./map-validation-error";
import type { ValidationError } from "@/domain/search/validation-error";

describe("mapValidationError (ValidationError → ApplicationError('invalid-query'))", () => {
  it("empty → invalid-query{reason:'empty'}", () => {
    const input: ValidationError = { kind: "empty" };
    expect(mapValidationError(input)).toEqual({
      kind: "invalid-query",
      reason: "empty",
    });
  });

  it("too-long → invalid-query{reason:'too-long'}", () => {
    const input: ValidationError = { kind: "too-long" };
    expect(mapValidationError(input)).toEqual({
      kind: "invalid-query",
      reason: "too-long",
    });
  });
});
