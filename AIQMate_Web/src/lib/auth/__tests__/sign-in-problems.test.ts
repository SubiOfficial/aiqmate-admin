import { describe, expect, it } from "vitest";
import { SIGN_IN_FALLBACK, signInProblemMessage } from "../sign-in-problems";

// SPEC-036 FR-WEB-008: the exact messages.
describe("signInProblemMessage", () => {
  it.each([
    ["NOT_INVITED", "Your Microsoft account has no AiQMate invitation. Ask your administrator to invite you."],
    ["INVITE_EXPIRED", "Your invitation has expired. Ask your administrator to send a new one."],
    ["INVALID_TOKEN", "Microsoft sign-in could not be verified. Try again."],
    ["SIGN_IN_EXPIRED", "The sign-in took too long or was interrupted. Try again."],
    ["MICROSOFT_ERROR", "Microsoft could not complete the sign-in. Try again."],
  ])("%s", (code, message) => {
    expect(signInProblemMessage(code)).toBe(message);
  });

  it.each([undefined, null, "", "SOMETHING_ELSE"])("falls back for %s", (code) => {
    expect(signInProblemMessage(code)).toBe(SIGN_IN_FALLBACK);
    expect(SIGN_IN_FALLBACK).toBe("Sign-in failed. Try again.");
  });
});
