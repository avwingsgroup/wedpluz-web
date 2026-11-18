import type { Id, ISODateString } from './api'
import type { HallLayout } from './ticketing'

export type PlannerAssetType = 'menu' | 'hall_layout' | 'cake_design' | 'event_branding'

export interface PlannerAssetSummary {
  id: Id
  type: PlannerAssetType
  name: string
  thumbnailUrl: string | null
  eventId: Id | null
  updatedAt: ISODateString
}

export interface PlannerMenuSection {
  id: Id
  title: string
  items: Array<{ id: Id; name: string; description: string | null; price: number; imageUrl: string | null }>
}

export interface PlannerMenu {
  id: Id
  name: string
  sections: PlannerMenuSection[]
  currency: string
  updatedAt: ISODateString
}

export interface PlannerGeneration {
  id: Id
  type: 'cake_design' | 'event_branding'
  prompt: string
  status: 'queued' | 'generating' | 'ready' | 'failed'
  resultUrls: string[]
  createdAt: ISODateString
}

export interface PlannerChatMessage {
  id: Id
  role: 'user' | 'assistant'
  content: string
  attachments: Array<{ type: 'image' | 'pdf'; url: string; name: string }>
  generation: PlannerGeneration | null
  createdAt: ISODateString
}

export interface PlannerChat {
  id: Id
  title: string
  messages: PlannerChatMessage[]
  createdAt: ISODateString
  updatedAt: ISODateString
}

export interface HallLayoutPayload extends Omit<HallLayout, 'id' | 'updatedAt' | 'thumbnailUrl'> {
  id?: Id
}
