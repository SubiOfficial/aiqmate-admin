import { Card, Text, makeStyles, tokens } from "@fluentui/react-components";
import { TextLink } from "@/components/TextLink";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXXXL, alignItems: "center", textAlign: "center", gap: tokens.spacingVerticalS },
});

export function NotFoundPage() {
  const s = useStyles();
  return (
    <Card className={s.card}>
      <Text as="h1" size={600} weight="semibold">
        This page could not be found
      </Text>
      <Text>The link may be wrong, or the page may have moved.</Text>
      <TextLink to="/dashboard">Go to the dashboard</TextLink>
    </Card>
  );
}
