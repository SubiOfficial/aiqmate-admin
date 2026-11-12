import { makeStyles, tokens, Button, Text, Input, Field } from "@fluentui/react-components";
import { Delete24Regular, Warning24Regular, Info24Regular, Checkmark24Regular } from "@fluentui/react-icons";
import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Variant = "delete" | "warning" | "info" | "success";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  variant?: Variant;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  confirmCode?: string;
  icon?: ReactNode;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "grid",
    placeItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dialog: {
    width: "400px",
    maxWidth: "calc(100vw - 32px)",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: "14px",
    boxShadow: tokens.shadow28,
    overflow: "hidden",
    animationName: {
      from: { opacity: 0, transform: "scale(0.95) translateY(8px)" },
      to: { opacity: 1, transform: "scale(1) translateY(0)" },
    },
    animationDuration: "0.15s",
    animationTimingFunction: "ease-out",
  },
  body: {
    padding: "24px 24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: tokens.spacingVerticalS,
  },
  iconWrap: {
    width: "56px",
    height: "56px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    marginBottom: tokens.spacingVerticalXS,
  },
  iconDelete: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  iconWarning: {
    backgroundColor: tokens.colorPaletteMarigoldBackground2,
    color: tokens.colorPaletteMarigoldForeground1,
  },
  iconInfo: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  iconSuccess: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  description: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
  },
  codeSection: {
    width: "100%",
    textAlign: "left",
    marginTop: tokens.spacingVerticalS,
  },
  codeHint: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  codeValue: {
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
    padding: "12px 24px 20px",
  },
  btnDelete: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": { backgroundColor: tokens.colorPaletteRedForeground1 },
  },
});

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const VARIANT_ICON: Record<Variant, ReactNode> = {
  delete: <Delete24Regular />,
  warning: <Warning24Regular />,
  info: <Info24Regular />,
  success: <Checkmark24Regular />,
};

const VARIANT_CLASS_KEY: Record<Variant, "iconDelete" | "iconWarning" | "iconInfo" | "iconSuccess"> = {
  delete: "iconDelete",
  warning: "iconWarning",
  info: "iconInfo",
  success: "iconSuccess",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  variant = "warning",
  confirmLabel,
  cancelLabel = "Cancel",
  loading = false,
  confirmCode,
  icon,
}: ConfirmDialogProps) {
  const s = useStyles();
  const [codeInput, setCodeInput] = useState("");

  if (!open) return null;

  const isDelete = variant === "delete";
  const needsCode = isDelete && confirmCode;
  const codeMatches = !needsCode || codeInput === confirmCode;
  const defaultConfirmLabel = confirmLabel ?? (isDelete ? "Delete" : "Confirm");

  const handleConfirm = () => {
    if (!codeMatches || loading) return;
    onConfirm();
    setCodeInput("");
  };

  const handleClose = () => {
    setCodeInput("");
    onClose();
  };

  return (
    <div className={s.overlay} onClick={handleClose}>
      <div className={s.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={s.body}>
          <div className={`${s.iconWrap} ${s[VARIANT_CLASS_KEY[variant]]}`}>
            {icon ?? VARIANT_ICON[variant]}
          </div>
          <Text className={s.title}>{title}</Text>
          {description && <Text className={s.description}>{description}</Text>}
          {needsCode && (
            <div className={s.codeSection}>
              <Text className={s.codeHint}>
                Type the org code <Text className={s.codeValue}>{confirmCode}</Text> to confirm
              </Text>
              <Field style={{ marginTop: "8px" }}>
                <Input
                  value={codeInput}
                  onChange={(_, d) => setCodeInput(d.value)}
                  placeholder={confirmCode}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
                  autoFocus
                />
              </Field>
            </div>
          )}
        </div>
        <div className={s.footer}>
          <Button appearance="secondary" onClick={handleClose} disabled={loading}>{cancelLabel}</Button>
          <Button
            appearance="primary"
            className={isDelete ? s.btnDelete : undefined}
            onClick={handleConfirm}
            disabled={!codeMatches || loading}
          >
            {loading ? "Processing..." : defaultConfirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
