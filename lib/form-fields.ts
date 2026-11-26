import { supabase } from "@/lib/supabase";

export interface FormFieldConfig {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "textarea" | "number" | "date" | "select" | "radio" | "checkbox" | "toggle";
  applicable_roles: string[];
  applicable_visit_types: string[];
  is_required: boolean;
  options: unknown;
  validation: unknown;
  sort_order: number;
  is_active: boolean;
}

export async function getFormFieldsConfig(hospitalId: string): Promise<FormFieldConfig[]> {
  const { data, error } = await supabase
    .from("form_fields_config")
    .select("*")
    .eq("hospital_id", hospitalId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function filterVisibleFields(
  fields: FormFieldConfig[],
  respondentRole: "self" | "guardian",
  visitPurpose: "consultation" | "diagnostic" | "emergency"
): FormFieldConfig[] {
  return fields.filter((field) => {
    const roleMatch =
      field.applicable_roles.length === 0 ||
      field.applicable_roles.includes(respondentRole);
    const visitMatch =
      field.applicable_visit_types.length === 0 ||
      field.applicable_visit_types.includes(visitPurpose);
    return roleMatch && visitMatch;
  });
}