import { useCallback, useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "Select..." }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = useCallback(
    (val: string) => {
      onChange(value.includes(val) ? value.filter((v) => v !== val) : [...value, val]);
    },
    [value, onChange],
  );

  const clearAll = useCallback(() => onChange([]), [onChange]);

  const selectedLabels = options.filter((o) => value.includes(o.value));

  return (
    <div className="mselect" ref={ref}>
      <button className="mselect__trigger" type="button" onClick={() => setOpen(!open)}>
        <span className="mselect__text">
          {selectedLabels.length > 0
            ? selectedLabels.map((o) => o.label).join(", ")
            : placeholder}
        </span>
        {value.length > 0 && <span className="mselect__count">{value.length}</span>}
        <svg className="mselect__chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mselect__dropdown">
          <div className="mselect__options">
            {options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <label key={opt.value} className={`mselect__option${checked ? " is-checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.value)}
                    className="mselect__checkbox"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="mselect__footer">
              <button className="mselect__clear" type="button" onClick={clearAll}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
