import {
  Badge,
  Button,
  Card,
  Skeleton,
  SkeletonItem,
  Tab,
  TabList,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { SelectTabData, SelectTabEvent } from "@fluentui/react-components";
import {
  Clipboard16Regular,
  DesignIdeas16Regular,
  Info16Regular,
  Settings16Regular,
  Document16Regular,
  Lightbulb16Regular,
} from "@fluentui/react-icons";
import { useState } from "react";
import { type AssetDetail, type HierarchyLevel, assetName } from "@/lib/api/assetHierarchy";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  breadcrumb: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalXXS },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  title: { overflowWrap: "anywhere" },
  badge: { flexShrink: 0 },
  stats: {
    display: "flex",
    gap: tokens.spacingHorizontalL,
    marginLeft: "auto",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  stat: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "nowrap",
  },
  tabs: {
    padding: `0 ${tokens.spacingHorizontalL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    padding: tokens.spacingHorizontalL,
  },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "1fr",
    "@media (min-width: 768px)": { gridTemplateColumns: "1fr 1fr" },
  },
  card: {
    padding: tokens.spacingHorizontalL,
    gap: tokens.spacingVerticalS,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
  },
  fieldLabel: { color: tokens.colorNeutralForeground2, fontSize: tokens.fontSizeBase200 },
  fieldValue: { textAlign: "right", fontWeight: tokens.fontWeightSemibold, fontSize: tokens.fontSizeBase200 },
  emptyValue: { color: tokens.colorNeutralForeground3 },
  placeholder: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.spacingHorizontalXXL,
    color: tokens.colorNeutralForeground3,
  },
  loading: { padding: tokens.spacingHorizontalL, display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
});

type TabKey = "details" | "routines" | "procedures" | "artifacts" | "insights";

interface Props {
  asset: AssetDetail | undefined;
  levels: HierarchyLevel[];
  loading: boolean;
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const s = useStyles();
  const display = value != null && value !== "" ? String(value) : null;
  return (
    <>
      <Text className={s.fieldLabel}>{label}</Text>
      <Text className={display ? s.fieldValue : `${s.fieldValue} ${s.emptyValue}`}>
        {display ?? "-"}
      </Text>
    </>
  );
}

function DetailsTab({ asset }: { asset: AssetDetail }) {
  const s = useStyles();

  return (
    <div className={s.grid}>
      <Card className={s.card}>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>
            <Info16Regular />
            <Text weight="semibold">Overview</Text>
          </div>
        </div>
        <div className={s.fieldGrid}>
          <Field label="Name" value={assetName(asset)} />
          <Field label="Alias" value={asset.displayName} />
          <Field label="ID" value={asset.assetCode} />
          <Field label="Status" value={asset.status} />
          <Field label="Criticality" value={asset.criticality} />
          <Field label="Location" value={asset.location} />
        </div>
      </Card>

      <Card className={s.card}>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>
            <Settings16Regular />
            <Text weight="semibold">Classification</Text>
          </div>
          <Button appearance="outline" size="small">Set Classification</Button>
        </div>
        <div className={s.fieldGrid}>
          <Field label="Asset Class" value={asset.assetClass} />
          <Field label="Asset Model" value={asset.assetModel} />
        </div>
      </Card>

      <Card className={s.card}>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>
            <Clipboard16Regular />
            <Text weight="semibold">Model Template</Text>
          </div>
          <Button appearance="outline" size="small">Apply Template</Button>
        </div>
        <div className={s.fieldGrid}>
          <Field label="Template Status" value={asset.modelTemplateId ? "Applied" : "Not Available"} />
          <Field label="Number of Procedures" value={asset.procedureCount} />
        </div>
      </Card>

      <Card className={s.card}>
        <div className={s.cardHeader}>
          <div className={s.cardTitle}>
            <DesignIdeas16Regular />
            <Text weight="semibold">AR Status</Text>
          </div>
          <Button appearance="outline" size="small">Configure AR</Button>
        </div>
        <div className={s.fieldGrid}>
          <Field label="AR Status" value={asset.arPinCount > 0 ? "Configured" : "Not Configured"} />
          <Field label="Number of Anchors" value={asset.arPinCount} />
        </div>
      </Card>
    </div>
  );
}

function TabPlaceholder({ tab }: { tab: string }) {
  const s = useStyles();
  return (
    <div className={s.placeholder}>
      <Text>{tab} will be available when the backend module is connected.</Text>
    </div>
  );
}

export function AssetDetailPanel({ asset, levels, loading }: Props) {
  const s = useStyles();
  const [activeTab, setActiveTab] = useState<TabKey>("details");

  const handleTabSelect = (_: SelectTabEvent, data: SelectTabData) => {
    setActiveTab(data.value as TabKey);
  };

  if (loading) {
    return (
      <div className={s.root}>
        <div className={s.loading}>
          <Skeleton><SkeletonItem style={{ height: "28px", width: "60%" }} /></Skeleton>
          <Skeleton><SkeletonItem style={{ height: "20px", width: "40%" }} /></Skeleton>
          <Skeleton><SkeletonItem style={{ height: "200px" }} /></Skeleton>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className={s.root}>
        <div className={s.placeholder}>
          <Text size={300}>Select a node from the hierarchy to see its details.</Text>
        </div>
      </div>
    );
  }

  const name = assetName(asset);
  const levelLabel = levels.find((l) => l.id === asset.hierarchyLevelId)?.levelKey?.toUpperCase() ?? "ASSET";

  return (
    <div className={s.root}>
      <div className={s.header}>
        <Text className={s.breadcrumb}>{name}</Text>
        <div className={s.titleRow}>
          <Text size={600} weight="semibold" className={s.title}>
            {name}
          </Text>
          <Badge appearance="outline" className={s.badge}>{levelLabel}</Badge>
          <div className={s.stats}>
            <span className={s.stat}><Document16Regular /> {asset.procedureCount} Procedures</span>
            <span className={s.stat}><DesignIdeas16Regular /> {asset.arPinCount} AR Pins</span>
            <span className={s.stat}><Lightbulb16Regular /> {asset.insightCount} Insights</span>
          </div>
        </div>
      </div>

      <div className={s.tabs}>
        <TabList selectedValue={activeTab} onTabSelect={handleTabSelect} size="small">
          <Tab value="details">Details</Tab>
          <Tab value="routines">Routines</Tab>
          <Tab value="procedures">Procedures</Tab>
          <Tab value="artifacts">Artifacts</Tab>
          <Tab value="insights">Insights</Tab>
        </TabList>
      </div>

      <div className={s.content}>
        {activeTab === "details" ? (
          <DetailsTab asset={asset} />
        ) : (
          <TabPlaceholder tab={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} />
        )}
      </div>
    </div>
  );
}
