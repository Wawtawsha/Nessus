export interface Visit {
  event_name: string | null
  event_data: any
  session_id: string | null
  page_path: string | null
  created_at: string
  user_agent: string | null
}
