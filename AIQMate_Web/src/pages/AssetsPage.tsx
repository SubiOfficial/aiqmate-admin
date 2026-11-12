import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useCallback, useState } from "react";
import {
  type AssetNode,
  assetName,
  useAssetDetail,
  useAssetHierarchy,
  useCreateAsset,
  useDeleteAsset,
  useHierarchyConfig,
  useRenameAsset,
  useToggleAssetStatus,
} from "@/lib/api/assetHierarchy";
import { useSession } from "@/lib/auth/session";
import { useMediaQuery } from "@/lib/media";
import { RequireRoles } from "@/components/RequireRoles";
import { AssetDetailPanel } from "@/components/assets/AssetDetailPanel";
import { HierarchyPanel } from "@/components/assets/HierarchyPanel";
import { HierarchyConfigSetup } from "@/components/assets/HierarchyConfigSetup";

const useStyles = makeStyles({
  root: {
    display: "flex",
    height: "calc(100dvh - 56px)",
    overflow: "hidden",
    margin: `${tokens.spacingVerticalXXL} 0`,
    marginLeft: `-${tokens.spacingHorizontalL}`,
    marginRight: `-${tokens.spacingHorizontalL}`,
    marginTop: `-${tokens.spacingVerticalXXL}`,
    marginBottom: `-${tokens.spacingVerticalXXL}`,
  },
  left: {
    width: "380px",
    minWidth: "280px",
    maxWidth: "50%",
    flexShrink: 0,
    height: "100%",
    overflow: "hidden",
    transition: "width 0.2s",
  },
  leftCollapsed: {
    width: "48px",
    minWidth: "48px",
  },
  right: {
    flexGrow: 1,
    height: "100%",
    overflow: "hidden",
    minWidth: 0,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingHorizontalXXL,
  },
  error: {
    padding: tokens.spacingHorizontalL,
  },
  mobileRoot: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100dvh - 56px)",
    overflow: "hidden",
    margin: `-${tokens.spacingVerticalXXL} -${tokens.spacingHorizontalL}`,
  },
  mobileTree: {
    flexGrow: 1,
    overflow: "hidden",
  },
  mobileBack: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
});

function findNodeById(nodes: AssetNode[], id: string): AssetNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNodeById(n.children, id);
    if (found) return found;
  }
  return undefined;
}

function AssetsPageContent() {
  const s = useStyles();
  const session = useSession();
  const userId = session.user.id;
  const wide = useMediaQuery("(min-width: 768px)");

  const configQuery = useHierarchyConfig(userId);
  const treeQuery = useAssetHierarchy(userId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetNode | null>(null);

  const detailQuery = useAssetDetail(userId, selectedId);
  const createAsset = useCreateAsset(userId);
  const renameAsset = useRenameAsset(userId);
  const toggleStatus = useToggleAssetStatus(userId);
  const deleteAsset = useDeleteAsset(userId);

  const levels = configQuery.data ?? [];
  const tree = treeQuery.data ?? [];

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (!wide) setMobileDetailOpen(true);
    },
    [wide],
  );

  const handleAdd = useCallback(
    async (parentId: string | null, levelId: string) => {
      const level = levels.find((l) => l.id === levelId);
      const siblings = parentId
        ? (findNodeById(tree, parentId)?.children ?? [])
        : tree;
      const count = siblings.filter((c) => c.hierarchyLevelId === levelId).length;
      const defaultName = `${level?.displayName ?? "Asset"} ${count + 1}`;

      try {
        const created = await createAsset.mutateAsync({
          parentAssetId: parentId,
          hierarchyLevelId: levelId,
          defaultName,
        });
        setSelectedId(created.id);
        if (!wide) setMobileDetailOpen(true);
      } catch {
        // Error handled by TanStack Query
      }
    },
    [levels, tree, createAsset, wide],
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      renameAsset.mutate({ id, displayName: name });
    },
    [renameAsset],
  );

  const handleDeactivate = useCallback(
    (id: string) => {
      const node = findNodeById(tree, id);
      if (node) toggleStatus.mutate({ id, isActive: !node.isActive });
    },
    [tree, toggleStatus],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const node = findNodeById(tree, id);
      if (node) setDeleteTarget(node);
    },
    [tree],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteAsset.mutateAsync(deleteTarget.id);
      if (selectedId === deleteTarget.id) setSelectedId(null);
    } catch {
      // Error handled by TanStack Query
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteAsset, selectedId]);

  // Loading state
  if (configQuery.isPending || treeQuery.isPending) {
    return (
      <div className={s.center}>
        <Spinner label="Loading asset hierarchy..." />
      </div>
    );
  }

  // Error state
  if (configQuery.isError || treeQuery.isError) {
    return (
      <div className={s.error}>
        <MessageBar intent="error">
          <MessageBarBody>
            Could not load the asset hierarchy. The backend API may not be connected yet.
            {" "}
            <Button
              appearance="transparent"
              size="small"
              onClick={() => {
                void configQuery.refetch();
                void treeQuery.refetch();
              }}
            >
              Try again
            </Button>
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  // No hierarchy configured yet
  if (levels.length === 0) {
    return <HierarchyConfigSetup userId={userId} />;
  }

  // Mobile layout
  if (!wide) {
    return (
      <div className={s.mobileRoot}>
        <div className={s.mobileTree}>
          <HierarchyPanel
            levels={levels}
            tree={tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onAdd={handleAdd}
            onRename={handleRename}
            onDeactivate={handleDeactivate}
            onDelete={handleDelete}
            collapsed={false}
            onToggleCollapse={() => {}}
          />
        </div>

        <Drawer
          open={mobileDetailOpen}
          onOpenChange={(_, d) => setMobileDetailOpen(d.open)}
          position="end"
          size="full"
        >
          <DrawerHeader>
            <DrawerHeaderTitle
              action={
                <Button
                  appearance="subtle"
                  icon={<Dismiss24Regular />}
                  onClick={() => setMobileDetailOpen(false)}
                />
              }
            >
              {selectedId ? assetName(findNodeById(tree, selectedId) ?? { defaultName: "Asset", displayName: null }) : "Details"}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <AssetDetailPanel
              asset={detailQuery.data}
              levels={levels}
              loading={detailQuery.isPending && selectedId !== null}
            />
          </DrawerBody>
        </Drawer>

        <DeleteDialog target={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={s.root}>
      <div className={panelCollapsed ? s.leftCollapsed : s.left}>
        <HierarchyPanel
          levels={levels}
          tree={tree}
          selectedId={selectedId}
          onSelect={handleSelect}
          onAdd={handleAdd}
          onRename={handleRename}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((p) => !p)}
        />
      </div>
      <div className={s.right}>
        <AssetDetailPanel
          asset={detailQuery.data}
          levels={levels}
          loading={detailQuery.isPending && selectedId !== null}
        />
      </div>

      <DeleteDialog target={deleteTarget} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function DeleteDialog({
  target,
  onConfirm,
  onCancel,
}: {
  target: AssetNode | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!target) return null;
  return (
    <Dialog open onOpenChange={(_, d) => { if (!d.open) onCancel(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Delete {assetName(target)}?</DialogTitle>
          <DialogContent>
            This will permanently remove this asset. This action cannot be undone.
          </DialogContent>
          <DialogActions>
            <DialogTrigger>
              <Button appearance="secondary" onClick={onCancel}>Cancel</Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={onConfirm}>Delete</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export function AssetsPage() {
  return (
    <RequireRoles roles={["SUPER_ADMIN"]}>
      <AssetsPageContent />
    </RequireRoles>
  );
}
