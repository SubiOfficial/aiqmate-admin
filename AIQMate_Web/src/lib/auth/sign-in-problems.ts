// SPEC-036 FR-WEB-008. The message for each sign-in problem code api-service sends to
// /sign-in-problem?code=. No em dash (CLAUDE.md 5h).

const MESSAGES: Record<string, string> = {
  NOT_INVITED: "Your Microsoft account has no AiQMate invitation. Ask your administrator to invite you.",
  INVITE_EXPIRED: "Your invitation has expired. Ask your administrator to send a new one.",
  INVALID_TOKEN: "Microsoft sign-in could not be verified. Try again.",
  SIGN_IN_EXPIRED: "The sign-in took too long or was interrupted. Try again.",
  MICROSOFT_ERROR: "Microsoft could not complete the sign-in. Try again.",
};

export const SIGN_IN_FALLBACK = "Sign-in failed. Try again.";

export function signInProblemMessage(code: string | null | undefined): string {
  return (code && MESSAGES[code]) || SIGN_IN_FALLBACK;
}
