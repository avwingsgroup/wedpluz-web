import { request } from '@/services/http'
import type { Community, CommunityCreatePayload, CommunityMember, CommunityPermissions, LiveRequest, LiveSession, MediaItem, StatusPost, UserSummary } from '@/types'

export interface CommunityMediaItem extends MediaItem {
  name: string | null
  sizeBytes: number
  sender: UserSummary
  createdAt: string
}

export const communityApi = {
  list: (params: { archived?: boolean; search?: string } = {}) => request.get<Community[]>('/communities', params),
  create: (payload: CommunityCreatePayload) => request.post<Community, CommunityCreatePayload>('/communities', payload),
  get: (id: string) => request.get<Community>(`/communities/${id}`),
  update: (id: string, payload: { name?: string; description?: string | null; avatarUploadId?: string; permissions?: Partial<CommunityPermissions> }) => request.put<Community>(`/communities/${id}`, payload),
  setFlags: (id: string, payload: { isMuted?: boolean; isPinned?: boolean; isArchived?: boolean }) => request.patch<Community>(`/communities/${id}`, payload),
  join: (id: string) => request.post<Community>(`/communities/${id}/join`),
  joinByCode: (code: string) => request.post<Community>(`/communities/join/${code}`),
  leave: (id: string) => request.post<void>(`/communities/${id}/leave`),
  regenerateInvite: (id: string) => request.post<{ inviteLink: string }>(`/communities/${id}/invite-link`),
  members: (id: string, params: { search?: string; page?: number } = {}) => request.getPaginated<CommunityMember>(`/communities/${id}/members`, params),
  invite: (id: string, payload: { userIds?: string[]; emails?: string[] }) => request.post<{ invited: number }>(`/communities/${id}/members`, payload),
  setRole: (id: string, userId: string, role: 'co_admin' | 'member') => request.patch<CommunityMember>(`/communities/${id}/members/${userId}`, { role }),
  removeMember: (id: string, userId: string) => request.del(`/communities/${id}/members/${userId}`),
  statuses: (id: string) => request.get<StatusPost[]>(`/communities/${id}/statuses`),
  postStatus: (id: string, payload: { mediaUploadId: string; caption?: string; mediaType?: 'image' | 'video' }) => request.post<StatusPost>(`/communities/${id}/statuses`, payload),
  likeStatus: (id: string) => request.post<{ liked: boolean; likesCount: number }>(`/statuses/${id}/like`),
  viewStatus: (id: string) => request.post<void>(`/statuses/${id}/view`),
  deleteStatus: (id: string) => request.del(`/statuses/${id}`),
  media: (id: string, params: { type?: 'media' | 'docs'; page?: number } = {}) => request.getPaginated<CommunityMediaItem>(`/communities/${id}/media`, params),
  live: (id: string) => request.get<LiveSession | null>(`/communities/${id}/live`),
  startLive: (id: string, payload: { title?: string; audioEnabled?: boolean; videoEnabled?: boolean }) => request.post<LiveSession>(`/communities/${id}/live`, payload),
  updateLive: (liveId: string, payload: Partial<Pick<LiveSession, 'audioEnabled' | 'videoEnabled'>>) => request.patch<LiveSession>(`/live/${liveId}`, payload),
  endLive: (liveId: string) => request.post<LiveSession | null>(`/live/${liveId}/end`),
  joinLive: (liveId: string) => request.post<{ joinToken: string; session: LiveSession }>(`/live/${liveId}/join`),
  liveRequests: (liveId: string) => request.get<LiveRequest[]>(`/live/${liveId}/requests`),
  requestToJoinLive: (liveId: string) => request.post<LiveRequest>(`/live/${liveId}/requests`),
  decideLiveRequest: (liveId: string, requestId: string, status: 'accepted' | 'declined') => request.patch<LiveRequest>(`/live/${liveId}/requests/${requestId}`, { status }),
}
