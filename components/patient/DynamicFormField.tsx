"use client";

import type { FormFieldConfig } from "@/lib/form-fields";

interface DynamicFormFieldProps {
  field: FormFieldConfig;
  value: string;
  onChange: (value: string) => void;
}

export function DynamicFormField({ field, value, onChange }: DynamicFormFieldProps) {
  const label = (
    <label className="text-sm font-semibold text-gray-700">
      {field.label}
      {field.is_required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </label>
  );

  let control: React.ReactNode = null;

  switch (field.field_type) {
    case "textarea":
      control = (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
        />
      );
      break;
    case "number":
      control = (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
        />
      );
      break;
    case "date":
      control = (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
        />
      );
      break;
    case "select":
      control = (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
        >
          <option value="">Select…</option>
          {Array.isArray(field.options)
            ? (field.options as Array<{ value: string; label: string }>).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : null}
        </select>
      );
      break;
    case "radio":
    case "checkbox":
      control = (
        <div className="flex flex-wrap gap-2">
          {Array.isArray(field.options)
            ? (field.options as Array<{ value: string; label: string }>).map((opt) => (
                <label
                  key={opt.value}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
                >
                  <input
                    type="radio"
                    name={field.field_key}
                    checked={value === opt.value}
                    onChange={() => onChange(opt.value)}
                    className="accent-medical-blue"
                  />
                  {opt.label}
                </label>
              ))
            : null}
        </div>
      );
      break;
    case "toggle":
      control = (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "false")}
            className="h-4 w-4 rounded accent-medical-blue"
          />
          Yes
        </label>
      );
      break;
    default:
      control = (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-medical-blue focus:outline-none focus:ring-2 focus:ring-medical-blue/20"
        />
      );
  }

  return (
    <div className="space-y-2">
      {label}
      {control}
      {field.validation as string ? (
        <p className="text-xs text-gray-400">{field.validation as string}</p>
      ) : null}
    </div>
  );
}
