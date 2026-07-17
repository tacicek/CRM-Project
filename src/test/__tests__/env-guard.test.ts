import { describe, expect, it } from "vitest";
import {
  assertSafeTestEnvironment,
  isSafeTestEnvironment,
  UnsafeTestEnvironmentError,
  type TestEnvInput,
} from "@/test/env-guard";

/** A minimal, unambiguously-local, opted-in input the happy-path tests start from. */
const localOk: TestEnvInput = {
  supabaseUrl: "http://127.0.0.1:54321",
  databaseHost: "127.0.0.1",
  databasePort: "54322",
  testEnvFlag: "1",
};

describe("assertSafeTestEnvironment — fail-closed production guard", () => {
  it("accepts an explicit, local, opted-in target", () => {
    expect(() => assertSafeTestEnvironment(localOk)).not.toThrow();
    expect(() => assertSafeTestEnvironment({ ...localOk, supabaseUrl: "http://localhost:54321" })).not.toThrow();
  });

  it("refuses when the opt-in flag is missing — NODE_ENV alone is never enough", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, testEnvFlag: undefined })).toThrow(
      UnsafeTestEnvironmentError
    );
    expect(() => assertSafeTestEnvironment({ ...localOk, testEnvFlag: "true" })).toThrow(
      UnsafeTestEnvironmentError
    );
  });

  it("refuses the production self-hosted host", () => {
    expect(() =>
      assertSafeTestEnvironment({
        ...localOk,
        supabaseUrl: "https://supabasekong-aw0c0w440o8k0cccokow0csw.213.199.45.205.sslip.io",
      })
    ).toThrow(/not a local test host/);
  });

  it("refuses any non-allowlisted host, even if it merely contains 'localhost'", () => {
    expect(() =>
      assertSafeTestEnvironment({ ...localOk, supabaseUrl: "https://localhost.evil.example.com" })
    ).toThrow(/not a local test host/);
  });

  it("refuses an empty or undefined Supabase URL (unknown target = unsafe)", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, supabaseUrl: undefined })).toThrow(/empty/);
    expect(() => assertSafeTestEnvironment({ ...localOk, supabaseUrl: "   " })).toThrow(/empty/);
  });

  it("refuses a malformed URL rather than guessing", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, supabaseUrl: "not a url" })).toThrow(
      /not a valid URL/
    );
  });

  it("refuses a local host on a non-Supabase API port", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, supabaseUrl: "http://127.0.0.1:5432" })).toThrow(
      /not a local Supabase port/
    );
  });

  it("refuses a non-local direct database host", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, databaseHost: "10.0.2.4" })).toThrow(
      /Database host .* is not local/
    );
  });

  it("refuses a non-local database port", () => {
    expect(() => assertSafeTestEnvironment({ ...localOk, databasePort: 6543 })).toThrow(
      /not a local Supabase DB port/
    );
  });

  it("isSafeTestEnvironment mirrors assert as a boolean", () => {
    expect(isSafeTestEnvironment(localOk)).toBe(true);
    expect(isSafeTestEnvironment({ ...localOk, testEnvFlag: undefined })).toBe(false);
    expect(
      isSafeTestEnvironment({ ...localOk, supabaseUrl: "https://prod.example.com" })
    ).toBe(false);
  });
});
