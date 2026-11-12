import {
  Building16Regular,
  BuildingFactory16Regular,
  City16Regular,
  Globe16Regular,
  GridDots16Regular,
  Organization16Regular,
  Settings16Regular,
  Toolbox16Regular,
  Wrench16Regular,
  type FluentIcon,
} from "@fluentui/react-icons";

const LEVEL_ICONS: Record<string, FluentIcon> = {
  organization: Building16Regular,
  division: City16Regular,
  region: Globe16Regular,
  location: Globe16Regular,
  plant: BuildingFactory16Regular,
  department: GridDots16Regular,
  area: Organization16Regular,
  line: GridDots16Regular,
  equipment: Settings16Regular,
  component: Wrench16Regular,
  tool: Toolbox16Regular,
};

export function HierarchyIcon({ levelKey }: { levelKey: string }) {
  const Icon = LEVEL_ICONS[levelKey] ?? Settings16Regular;
  return <Icon />;
}
