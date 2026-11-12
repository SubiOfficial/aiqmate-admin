// SPEC-036 FR-WEB-031 / US-002 AC-3. Where an unbuilt module's menu entry goes on Dev and Stage.
// With showUnbuilt off (Production) the entry is not in the menu and this route is not found.

import { Card, Text, makeStyles, tokens } from "@fluentui/react-components";
import { Wrench24Regular } from "@fluentui/react-icons";
import { RequireRoles } from "@/components/RequireRoles";
import { TextLink } from "@/components/TextLink";
import { useConfig } from "@/lib/api/config";
import { unbuiltItem } from "@/lib/nav";
import { NotFoundPage } from "./NotFoundPage";

const useStyles = makeStyles({
  card: { padding: tokens.spacingHorizontalXXXL, alignItems: "center", textAlign: "center", gap: tokens.spacingVerticalS },
  summary: { maxWidth: "520px", color: tokens.colorNeutralForeground2, overflowWrap: "anywhere" },
  note: { color: tokens.colorNeutralForeground3 },
});

export function NotBuiltPage({ section }: { section: string }) {
  const s = useStyles();
  const config = useConfig();
  const item = unbuiltItem(section);
  if (!config.showUnbuilt || !item) return <NotFoundPage />;

  return (
    <RequireRoles roles={item.roles}>
      <Card className={s.card}>
        <Wrench24Regular aria-hidden="true" />
        <Text as="h1" size={600} weight="semibold">
          {item.label} is not built yet
        </Text>
        <Text className={s.summary}>{item.summary}</Text>
        <Text size={200} className={s.note}>
          Shown on Dev and Stage only.
        </Text>
        <TextLink to="/dashboard">Back to the dashboard</TextLink>
      </Card>
    </RequireRoles>
  );
}
