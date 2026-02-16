export interface Script {
  id: string
  client_id: string
  title: string
  body: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface OutcomeStats {
  script_id: string
  success_count: number
  fail_count: number
  total_count: number
  win_rate: number
}

export type ScriptWithStats = Script & { stats: OutcomeStats }

export interface ScriptOutcome {
  id: string
  script_id: string
  lead_id: string
  outcome: 'success' | 'fail'
  notes: string | null
  created_at: string
  created_by: string | null
}

// Analytics types (match RPC return signatures)

export interface ScriptPerformance {
  script_id: string
  script_title: string
  is_active: boolean
  success_count: number
  fail_count: number
  total_count: number
  win_rate: number
}

export interface NichePerformance {
  niche_id: string
  niche_name: string
  success_count: number
  fail_count: number
  total_count: number
  win_rate: number
}

export interface ScriptNicheCell {
  script_id: string
  script_title: string
  niche_id: string
  niche_name: string
  success_count: number
  fail_count: number
  total_count: number
  win_rate: number
}

export type DateRange = '7d' | '30d' | '90d' | 'all'
