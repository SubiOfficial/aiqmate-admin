import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import { ChevronDown16Regular } from "@fluentui/react-icons";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterDropdown({ label, options, value, onChange }: Props) {
  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? `${label}: ${selected.label}` : label;

  return (
    <Menu>
      <MenuTrigger>
        <Button
          appearance="outline"
          size="small"
          icon={<ChevronDown16Regular />}
          iconPosition="after"
          style={{
            fontSize: "var(--font-size-sm, 0.8125rem)",
            borderColor: "var(--card-border, #e2e8f0)",
            color: "var(--text-secondary, #475569)",
          }}
        >
          {displayLabel}
        </Button>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={opt.value === value ? { fontWeight: 600, color: "var(--color-primary, #3b82f6)" } : undefined}
            >
              {opt.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
