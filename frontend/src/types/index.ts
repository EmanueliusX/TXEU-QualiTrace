export type UserRole = 'admin' | 'quality_admin' | 'auditor';

export interface User {
  id: number;
  name: string;
  badge_id: string;
  role: UserRole;
  active: number;
  created_at?: string;
}

export interface Operation {
  id: number;
  code: string;
  name: string;
  description?: string;
  active: number;
  created_at?: string;
}

export interface MeasurementField {
  id: number;
  part_number: string;
  operation_id: number;
  name: string;
  description?: string;
  unit: string;
  nominal_value?: number;
  min_value: number;
  max_value: number;
  order_index: number;
  active: number;
  operation_name?: string;
  operation_code?: string;
}

export interface Template {
  part_number: string;
  operation_id: number;
  operation_code: string;
  operation_name: string;
  field_count: number;
  updated_at: string;
}

export interface Inspection {
  id: number;
  job_number: string;
  part_number: string;
  operation_id: number;
  operator_id?: number;
  operator_badge?: string;
  status: 'in_progress' | 'pass' | 'fail';
  validated_by?: number;
  validated_at?: string;
  notes?: string;
  created_at: string;
  operation_name?: string;
  operation_code?: string;
  operator_name?: string;
  validated_by_name?: string;
}

export interface Measurement {
  id: number;
  inspection_id: number;
  field_id: number;
  value?: number;
  status: 'pass' | 'fail' | 'pending';
  measured_at?: string;
  name: string;
  unit: string;
  nominal_value?: number;
  min_value: number;
  max_value: number;
  description?: string;
  order_index: number;
}

export interface InspectionSession {
  inspection: Inspection;
  measurements: Measurement[];
  operation: Operation;
}

export interface ReportStats {
  total: number;
  pass_count: number;
  fail_count: number;
  in_progress_count: number;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator Sistem',
  quality_admin: 'Admin Calitate',
  auditor: 'Auditor Calitate',
};

export const ROLE_BADGE_PREFIX: Record<UserRole, string> = {
  admin: 'ADMIN',
  quality_admin: 'QA',
  auditor: 'AUD',
};

export interface CapabilityConfig {
  id: number;
  part_number: string;
  operation_id: number;
  operation_code?: string;
  operation_name?: string;
  samples_per_lot: number;
  lots_required: number;
  enabled: number;
  updated_at?: string;
}

export interface CapabilityLotStatus {
  job_number: string;
  sample_count: number;
  target: number;
  complete: boolean;
  latest_at: string;
}

export interface CapabilityFieldResult {
  field: {
    id: number;
    name: string;
    unit: string;
    nominal_value?: number;
    min_value: number;
    max_value: number;
  };
  ok: boolean;
  reason?: string;
  n?: number;
  subgroup_count?: number;
  subgroup_size?: number;
  xbar?: number;
  sigma_overall?: number;
  sigma_within?: number;
  lsl?: number;
  usl?: number;
  cp?: number | null;
  cpk?: number | null;
  pp?: number | null;
  ppk?: number | null;
  min?: number;
  max?: number;
}

export interface CapabilityStudy {
  configured: boolean;
  config?: CapabilityConfig;
  fields_count?: number;
  lots?: CapabilityLotStatus[];
  complete_lots?: number;
  lots_required?: number;
  samples_per_lot?: number;
  ready?: boolean;
  results?: CapabilityFieldResult[];
}
