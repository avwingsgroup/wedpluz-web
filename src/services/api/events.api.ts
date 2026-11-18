import { request } from '@/services/http'
import type { Event, EventCategory, EventFilters, EventSummary, PaginatedResponse, SearchSuggestion } from '@/types'

export const eventsApi = {
  categories: () => request.get<EventCategory[]>('/categories', undefined, { skipAuth: true }),
  list: (filters: EventFilters, signal?: AbortSignal) => request.getPaginated<EventSummary>('/events', filters as Record<string, unknown>, { signal }),
  featured: () => request.get<EventSummary[]>('/events/featured', undefined),
  upcoming: (params: { location?: string } = {}) => request.get<EventSummary[]>('/events/upcoming', params),
  popular: () => request.get<EventSummary[]>('/events/popular', undefined),
  promoted: () => request.get<EventSummary[]>('/events/promoted', undefined),
  bySlug: (slug: string, signal?: AbortSignal) => request.get<Event>(`/events/${slug}`, undefined, { signal }),
  related: (id: string) => request.get<EventSummary[]>(`/events/${id}/related`, undefined),
  organizerEvents: (id: string, page = 1): Promise<PaginatedResponse<EventSummary>> => request.getPaginated<EventSummary>(`/events/${id}/organizer-events`, { page }),
  save: (id: string) => request.post<{ saved: boolean }>(`/events/${id}/save`),
  unsave: (id: string) => request.del(`/events/${id}/save`),
  saved: (params: { search?: string; page?: number } = {}) => request.getPaginated<EventSummary>('/me/saved-events', params),
  requestToAttend: (id: string, payload: { firstName: string; lastName: string }) => request.post<{ status: string }>(`/events/${id}/requests`, payload),
  suggestions: (q: string, location?: string, signal?: AbortSignal) => request.get<SearchSuggestion[]>('/search/suggestions', { q, location }, { signal, skipAuth: true }),
  locationSuggest: (q: string, signal?: AbortSignal) => request.get<Array<{ label: string; value: string }>>('/locations/suggest', { q }, { signal, skipAuth: true }),
}
