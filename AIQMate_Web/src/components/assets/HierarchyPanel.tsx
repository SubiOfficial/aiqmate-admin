import {
  Button,
  Input,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Add24Regular,
  PanelLeftContract24Regular,
  PanelLeftExpand24Regular,
  Search20Regular,
  Filter20Regular,
} from "@fluentui/react-icons";
import { useCallback, useMemo, useState } from "react";
import {
  type AssetNode,
  type HierarchyLevel,
  assetName,
  flattenTree,
  nextChildLevel,
} from "@/lib/api/assetHierarchy";
import { HierarchyTreeNode } from "./HierarchyTreeNode";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    gap: tokens.spacingHorizontalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  title: { flexGrow: 1, minWidth: 0 },
  searchBar: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    flexShrink: 0,
  },
  filters: {
    padding: `0 ${tokens.spacingHorizontalM} ${tokens.spacingVerticalXS}`,
    flexShrink: 0,
  },
  filterBtn: { fontSize: tokens.fontSizeBase200, color: tokens.colorNeutralForeground3 },
  tree: {
    flexGrow: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
  },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXXL,
    color: tokens.colorNeutralForeground3,
    textAlign: "center",
    flexGrow: 1,
  },
  collapsed: {
    width: "48px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: tokens.spacingVerticalM,
  },
});

interface Props {
  levels: HierarchyLevel[];
  tree: AssetNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (parentId: string | null, levelId: string) => Promise<void> | void;
  onRename: (id: string, name: string) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function collectDescendantIds(node: AssetNode): string[] {
  const ids: string[] = [];
  function walk(n: AssetNode) {
    ids.push(n.id);
    n.children.forEach(walk);
  }
  walk(node);
  return ids;
}

function findNode(nodes: AssetNode[], id: string): AssetNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return undefined;
}

export function HierarchyPanel({
  levels,
  tree,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDeactivate,
  onDelete,
  collapsed,
  onToggleCollapse,
}: Props) {
  const s = useStyles();
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    if (tree.length > 0) {
      function expandFirst(nodes: AssetNode[]) {
        for (const n of nodes) {
          if (n.children.length > 0) {
            ids.add(n.id);
            expandFirst(n.children);
          }
        }
      }
      expandFirst(tree);
    }
    return ids;
  });

  const rootLevel = useMemo(() => nextChildLevel(levels, null), [levels]);

  const handleAdd = useCallback(
    async (parentId: string | null, levelId: string) => {
      await onAdd(parentId, levelId);
      if (parentId) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          next.add(parentId);
          return next;
        });
      }
    },
    [onAdd],
  );

  const toggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(
    (id: string) => {
      const node = findNode(tree, id);
      if (!node) return;
      const ids = collectDescendantIds(node);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((i) => next.add(i));
        return next;
      });
    },
    [tree],
  );

  const collapseAll = useCallback(
    (id: string) => {
      const node = findNode(tree, id);
      if (!node) return;
      const ids = collectDescendantIds(node);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((i) => next.delete(i));
        return next;
      });
    },
    [tree],
  );

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    function matches(n: AssetNode): boolean {
      return (
        assetName(n).toLowerCase().includes(q) ||
        n.assetCode.toLowerCase().includes(q) ||
        n.children.some(matches)
      );
    }
    function filter(nodes: AssetNode[]): AssetNode[] {
      return nodes
        .filter(matches)
        .map((n) => ({ ...n, children: filter(n.children) }));
    }
    return filter(tree);
  }, [tree, search]);

  // When search is active, expand all matching ancestors
  useMemo(() => {
    if (!search.trim()) return;
    const flat = flattenTree(filteredTree);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      flat.forEach((n) => {
        if (n.children.length > 0) next.add(n.id);
      });
      return next;
    });
  }, [filteredTree, search]);

  if (collapsed) {
    return (
      <div className={s.collapsed}>
        <Tooltip content="Expand hierarchy" relationship="label">
          <Button appearance="subtle" icon={<PanelLeftExpand24Regular />} onClick={onToggleCollapse} />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={s.root}>
      <div className={s.header}>
        <Text weight="semibold" size={400} className={s.title}>
          Operational Hierarchy
        </Text>
        {rootLevel && (
          <Tooltip content={`Add ${rootLevel.displayName}`} relationship="label">
            <Button
              appearance="subtle"
              icon={<Add24Regular />}
              onClick={() => void handleAdd(null, rootLevel.id)}
            />
          </Tooltip>
        )}
        <Tooltip content="Collapse sidebar" relationship="label">
          <Button appearance="subtle" icon={<PanelLeftContract24Regular />} onClick={onToggleCollapse} />
        </Tooltip>
      </div>

      <div className={s.searchBar}>
        <Input
          placeholder="Search hierarchy..."
          contentBefore={<Search20Regular />}
          size="small"
          value={search}
          onChange={(_, d) => setSearch(d.value)}
          style={{ width: "100%" }}
        />
      </div>

      <div className={s.filters}>
        <Button appearance="subtle" size="small" icon={<Filter20Regular />} className={s.filterBtn}>
          Filters
        </Button>
      </div>

      {filteredTree.length === 0 ? (
        <div className={s.empty}>
          {tree.length === 0 ? (
            <>
              <Text size={300}>No assets yet.</Text>
              {rootLevel && (
                <Button appearance="primary" icon={<Add24Regular />} onClick={() => void handleAdd(null, rootLevel.id)}>
                  Add {rootLevel.displayName}
                </Button>
              )}
            </>
          ) : (
            <Text size={300}>No results for &quot;{search}&quot;</Text>
          )}
        </div>
      ) : (
        <div className={s.tree} role="tree">
          {filteredTree.map((node) => (
            <HierarchyTreeNode
              key={node.id}
              node={node}
              levels={levels}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={toggle}
              onExpandAll={expandAll}
              onCollapseAll={collapseAll}
              onAdd={handleAdd}
              onRename={onRename}
              onDeactivate={onDeactivate}
              onDelete={onDelete}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
