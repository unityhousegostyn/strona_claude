export type Role = 'super_admin' | 'admin' | 'user'

export interface Community {
  id: string
  name: string
  address: string
  created_at: string
}

export interface Profile {
  id: string
  role: Role
  status: 'pending' | 'active'
  full_name: string | null
  community_id: string | null
  created_at: string
  community?: Community
}

export interface Announcement {
  id: string
  title: string
  content: string
  start_date: string
  end_date: string
  attachment_url: string | null
  community_id: string
  created_by: string
  created_at: string
  community?: Community
}

export interface Ticket {
  id: string
  title: string
  description: string
  status: 'open' | 'closed'
  community_id: string
  created_by: string
  created_at: string
  community?: Community
  author?: Profile
}

export interface Document {
  id: string
  name: string
  url: string
  community_id: string
  created_at: string
}

export interface UserWithProfile {
  id: string
  email: string
  profile: Profile
}
