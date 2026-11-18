import { useQuery } from '@tanstack/vue-query'
import { accountApi } from '@/services/api/account.api'
import { eventsApi } from '@/services/api/events.api'
import { vendorsApi } from '@/services/api/vendors.api'
import { walletApi } from '@/services/api/wallet.api'

/**
 * Shared, rarely-changing reference data cached with TanStack Query, so navigating between pages
 * does not refetch it. Page-specific data uses `useAsync` / `usePaginatedTable` instead.
 * The backend may cache these responses publicly (see api-contracts.md §1.10).
 */
const TEN_MINUTES = 10 * 60_000

export const referenceKeys = {
  eventCategories: ['reference', 'event-categories'] as const,
  vendorCategories: ['reference', 'vendor-categories'] as const,
  interests: ['reference', 'interests'] as const,
  plans: ['reference', 'plans'] as const,
  publicConfig: ['reference', 'public-config'] as const,
}

export function useEventCategories() {
  return useQuery({ queryKey: referenceKeys.eventCategories, queryFn: () => eventsApi.categories(), staleTime: TEN_MINUTES })
}

export function useVendorCategories() {
  return useQuery({ queryKey: referenceKeys.vendorCategories, queryFn: () => vendorsApi.categories(), staleTime: TEN_MINUTES })
}

export function useInterests() {
  return useQuery({ queryKey: referenceKeys.interests, queryFn: () => accountApi.interests(), staleTime: TEN_MINUTES })
}

export function usePlans() {
  return useQuery({ queryKey: referenceKeys.plans, queryFn: () => walletApi.plans(), staleTime: TEN_MINUTES })
}

export function usePublicConfig() {
  return useQuery({ queryKey: referenceKeys.publicConfig, queryFn: () => accountApi.config(), staleTime: TEN_MINUTES })
}
