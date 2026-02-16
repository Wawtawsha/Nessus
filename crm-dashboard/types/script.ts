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
