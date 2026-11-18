import { request } from '@/services/http'
import type { HallLayout, HallLayoutPayload, PlannerAssetSummary, PlannerChat, PlannerChatMessage, PlannerGeneration, PlannerMenu } from '@/types'

export type PlannerIntent = 'cake_design' | 'event_branding' | 'menu' | 'hall_layout' | 'chat'

export const plannerApi = {
  assets: (params: { type?: string; sort?: 'recent' | 'name' } = {}) => request.get<PlannerAssetSummary[]>('/planner/assets', params),
  deleteAsset: (id: string) => request.del(`/planner/assets/${id}`),
  chats: () => request.get<Array<Pick<PlannerChat, 'id' | 'title' | 'updatedAt'>>>('/planner/chats'),
  createChat: (title?: string) => request.post<PlannerChat>('/planner/chats', { title }),
  chat: (id: string) => request.get<PlannerChat>(`/planner/chats/${id}`),
  deleteChat: (id: string) => request.del(`/planner/chats/${id}`),
  send: (id: string, payload: { content: string; attachmentUploadIds?: string[]; intent?: PlannerIntent }) => request.post<{ messages: PlannerChatMessage[] }>(`/planner/chats/${id}/messages`, payload),
  menus: () => request.get<PlannerMenu[]>('/planner/menus'),
  menu: (id: string) => request.get<PlannerMenu>(`/planner/menus/${id}`),
  createMenu: (payload: Partial<PlannerMenu>) => request.post<PlannerMenu>('/planner/menus', payload),
  updateMenu: (id: string, payload: Partial<PlannerMenu>) => request.put<PlannerMenu>(`/planner/menus/${id}`, payload),
  hallLayouts: () => request.get<HallLayout[]>('/planner/hall-layouts'),
  hallLayout: (id: string) => request.get<HallLayout>(`/planner/hall-layouts/${id}`),
  createHallLayout: (payload: Partial<HallLayoutPayload>) => request.post<HallLayout>('/planner/hall-layouts', payload),
  updateHallLayout: (id: string, payload: Partial<HallLayoutPayload>) => request.put<HallLayout>(`/planner/hall-layouts/${id}`, payload),
  generate: (payload: { type: 'cake_design' | 'event_branding'; prompt: string }) => request.post<PlannerGeneration>('/planner/generations', payload),
}
