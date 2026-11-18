import { request } from '@/services/http'
import type { ReviewPayload, Vendor, VendorCategory, VendorFilters, VendorProfilePayload, VendorPromo, VendorReview, VendorSummary, VendorWork, VendorWorkPayload } from '@/types'

export interface ReviewsResponse {
  items: VendorReview[]
  summary: { average: number; total: number; distribution: Array<{ stars: number; count: number }> }
}

export const vendorsApi = {
  categories: () => request.get<VendorCategory[]>('/vendor-categories', undefined, { skipAuth: true }),
  businessCategories: () => request.get<Array<{ id: string; name: string }>>('/business-categories', undefined, { skipAuth: true }),
  list: (filters: VendorFilters, signal?: AbortSignal) => request.getPaginated<VendorSummary>('/vendors', filters as Record<string, unknown>, { signal }),
  featured: () => request.get<VendorSummary[]>('/vendors/featured', undefined),
  bySlug: (slug: string) => request.get<Vendor>(`/vendors/${slug}`),
  works: (id: string, page = 1) => request.getPaginated<VendorWork>(`/vendors/${id}/works`, { page }),
  work: (id: string) => request.get<VendorWork & { vendor: VendorSummary }>(`/works/${id}`),
  likeWork: (id: string) => request.post<{ liked: boolean; likesCount: number }>(`/works/${id}/like`),
  reviews: (id: string) => request.get<ReviewsResponse>(`/vendors/${id}/reviews`, undefined),
  addReview: (id: string, payload: ReviewPayload) => request.post<VendorReview, ReviewPayload>(`/vendors/${id}/reviews`, payload),
  updateReview: (id: string, reviewId: string, payload: ReviewPayload) => request.put<VendorReview, ReviewPayload>(`/vendors/${id}/reviews/${reviewId}`, payload),
  deleteReview: (id: string, reviewId: string) => request.del(`/vendors/${id}/reviews/${reviewId}`),
  save: (id: string) => request.post<{ saved: boolean }>(`/vendors/${id}/save`),
  unsave: (id: string) => request.del(`/vendors/${id}/save`),
  saved: (params: { search?: string; page?: number } = {}) => request.getPaginated<VendorSummary>('/me/saved-vendors', params),
  contact: (id: string) => request.post<{ conversationId: string }>(`/vendors/${id}/contact`),
  myProfile: () => request.get<Vendor | null>('/me/vendor-profile'),
  createProfile: (payload: VendorProfilePayload) => request.post<Vendor, VendorProfilePayload>('/me/vendor-profile', payload),
  updateProfile: (payload: Partial<VendorProfilePayload> & { availability?: Vendor['availability'] }) => request.put<Vendor>('/me/vendor-profile', payload),
  deleteProfile: () => request.del('/me/vendor-profile'),
  addWork: (payload: VendorWorkPayload) => request.post<VendorWork, VendorWorkPayload>('/me/vendor-profile/works', payload),
  updateWork: (id: string, payload: Partial<VendorWorkPayload>) => request.put<VendorWork>(`/me/vendor-profile/works/${id}`, payload),
  deleteWork: (id: string) => request.del(`/me/vendor-profile/works/${id}`),
  addPromo: (payload: { title: string; description: string; discountPercent?: number; validUntil?: string }) => request.post<VendorPromo>('/me/vendor-profile/promos', payload),
  deletePromo: (id: string) => request.del(`/me/vendor-profile/promos/${id}`),
}
