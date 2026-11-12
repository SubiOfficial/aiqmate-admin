// A router link styled like a Fluent link, for in-app navigation without a full page load.

import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { Link, type LinkProps } from "@tanstack/react-router";

const useStyles = makeStyles({
  link: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline", color: tokens.colorBrandForegroundLinkHover },
  },
});

export function TextLink({ className, ...props }: LinkProps & { className?: string }) {
  const s = useStyles();
  return <Link {...props} className={mergeClasses(s.link, className)} />;
}
