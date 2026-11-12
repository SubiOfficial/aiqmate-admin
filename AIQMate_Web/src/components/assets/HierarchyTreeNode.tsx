import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Text,
  Tooltip,
  Input,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  Add16Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  MoreHorizontal16Regular,
  Delete16Regular,
  Edit16Regular,
  EyeOff16Regular,
  TextExpand16Regular,
  TextCollapse16Regular,
  AddCircle16Regular,
} from "@fluentui/react-icons";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { type AssetNode, assetName, type HierarchyLevel, nextChildLevel } from "@/lib/api/assetHierarchy";
import { HierarchyIcon } from "./HierarchyIcon";

const useStyles = makeStyles({
  row: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXXS,
    minHeight: "32px",
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    cursor: "pointer",
    userSelect: "none",
    "&:hover": { backgroundColor: tokens.colorNeutralBackground1Hover },
    "&:hover .actions": { opacity: 1 },
  },
  selected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    "&:hover": { backgroundColor: tokens.colorNeutralBackground1Selected },
  },
  chevron: { width: "20px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  icon: { flexShrink: 0, display: "flex", alignItems: "center", color: tokens.colorNeutralForeground3 },
  label: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  counts: {
    display: "flex",
    gap: "2px",
    flexShrink: 0,
    alignItems: "center",
  },
  countBadge: {
    fontSize: "10px",
    minWidth: "18px",
    height: "18px",
    borderRadius: tokens.borderRadiusCircular,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 4px",
    fontVariantNumeric: "tabular-nums",
  },
  countProc: { backgroundColor: tokens.colorBrandBackground2, color: tokens.colorBrandForeground2 },
  countAr: { backgroundColor: tokens.colorPaletteMarigoldBackground2, color: tokens.colorPaletteMarigoldForeground2 },
  countInsight: { backgroundColor: tokens.colorPaletteLightGreenBackground2, color: tokens.colorPaletteLightGreenForeground2 },
  actions: { opacity: 0, display: "flex", alignItems: "center", flexShrink: 0, transition: "opacity 0.15s" },
  children: { paddingLeft: "20px" },
  line: {
    borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
    marginLeft: "10px",
  },
  renameInput: { width: "100%", minWidth: 0 },
});

interface Props {
  node: AssetNode;
  levels: HierarchyLevel[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onExpandAll: (id: string) => void;
  onCollapseAll: (id: string) => void;
  onAdd: (parentId: string, levelId: string) => Promise<void> | void;
  onRename: (id: string, name: string) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
  depth: number;
}

export function HierarchyTreeNode({
  node,
  levels,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onExpandAll,
  onCollapseAll,
  onAdd,
  onRename,
  onDeactivate,
  onDelete,
  depth,
}: Props) {
  const s = useStyles();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children.length > 0;
  const expanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const name = assetName(node);
  const childLevel = nextChildLevel(levels, node.hierarchyLevelId);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  const startRename = useCallback(() => {
    setRenameValue(name);
    setRenaming(true);
  }, [name]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(node.id, trimmed);
    }
    setRenaming(false);
  }, [renameValue, name, node.id, onRename]);

  const cancelRename = useCallback(() => setRenaming(false), []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter") commitRename();
      else if (e.key === "Escape") cancelRename();
    },
    [commitRename, cancelRename],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      startRename();
    },
    [startRename],
  );

  const handleClick = useCallback(() => {
    onSelect(node.id);
  }, [node.id, onSelect]);

  const handleChevron = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id);
    },
    [node.id, onToggle],
  );

  const pCount = node.procedureCount ?? 0;
  const aCount = node.arPinCount ?? 0;
  const iCount = node.insightCount ?? 0;

  return (
    <div>
      <div
        className={mergeClasses(s.row, isSelected && s.selected)}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={isSelected}
      >
        <span className={s.chevron} onClick={hasChildren ? handleChevron : undefined}>
          {hasChildren ? (expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />) : null}
        </span>

        <span className={s.icon}>
          <HierarchyIcon levelKey={levels.find((l) => l.id === node.hierarchyLevelId)?.levelKey ?? "equipment"} />
        </span>

        {renaming ? (
          <Input
            ref={inputRef}
            className={s.renameInput}
            size="small"
            value={renameValue}
            onChange={(_, d) => setRenameValue(d.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Text className={s.label} title={name}>
            {name}
          </Text>
        )}

        {!renaming && (pCount > 0 || aCount > 0 || iCount > 0) && (
          <span className={s.counts}>
            {pCount > 0 && <span className={mergeClasses(s.countBadge, s.countProc)}>{pCount}</span>}
            {aCount > 0 && <span className={mergeClasses(s.countBadge, s.countAr)}>{aCount}</span>}
            {iCount > 0 && <span className={mergeClasses(s.countBadge, s.countInsight)}>{iCount}</span>}
          </span>
        )}

        {!renaming && (
          <span className={mergeClasses(s.actions, "actions")}>
            {childLevel && (
              <Tooltip content={`Add ${childLevel.displayName}`} relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Add16Regular />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onAdd(node.id, childLevel.id);
                  }}
                />
              </Tooltip>
            )}
            <Menu>
              <MenuTrigger>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<MoreHorizontal16Regular />}
                  onClick={(e) => e.stopPropagation()}
                />
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {childLevel && (
                    <MenuItem
                      icon={<AddCircle16Regular />}
                      onClick={() => void onAdd(node.id, childLevel.id)}
                    >
                      Add {childLevel.displayName}
                    </MenuItem>
                  )}
                  <MenuItem icon={<Edit16Regular />} onClick={startRename}>
                    Rename
                  </MenuItem>
                  {hasChildren && (
                    <>
                      <MenuItem icon={<TextExpand16Regular />} onClick={() => onExpandAll(node.id)}>
                        Expand all children
                      </MenuItem>
                      <MenuItem icon={<TextCollapse16Regular />} onClick={() => onCollapseAll(node.id)}>
                        Collapse all children
                      </MenuItem>
                    </>
                  )}
                  <MenuItem icon={<EyeOff16Regular />} onClick={() => onDeactivate(node.id)}>
                    Deactivate
                  </MenuItem>
                  {!hasChildren && (
                    <MenuItem icon={<Delete16Regular />} onClick={() => onDelete(node.id)}>
                      Delete
                    </MenuItem>
                  )}
                </MenuList>
              </MenuPopover>
            </Menu>
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className={mergeClasses(s.children, depth > 0 && s.line)} role="group">
          {node.children.map((child) => (
            <HierarchyTreeNode
              key={child.id}
              node={child}
              levels={levels}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onExpandAll={onExpandAll}
              onCollapseAll={onCollapseAll}
              onAdd={onAdd}
              onRename={onRename}
              onDeactivate={onDeactivate}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
