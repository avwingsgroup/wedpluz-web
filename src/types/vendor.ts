import type { Id, ISODateString } from './api'
import type { UserSummary } from './user'

export type VendorStatus = 'draft' | 'pending_verification' | 'active' | 'suspended' | 'rejected'

export interface VendorCategory {
  id: Id
  name: string
  slug: string
}

export interface MediaItem {
  id: Id
  type: 'image' | 'video' | 'pdf'
  url: string
  thumbnailUrl: string | null
  width?: number
  height?: number
  durationSeconds?: number
}

export interface VendorWork {
  id: Id
  vendorId: Id
  title: string
  description: string
  media: MediaItem[]
  likesCount: number
  isLiked: boolean
  createdAt: ISODateString
}

export interface VendorPromo {
  id: Id
  title: string
  description: string
  discountPercent: number | null
  validUntil: ISODateString | null
  coverUrl: string | null
}

export interface VendorReview {
  id: Id
  author: UserSummary
  rating: number
  comment: string
  createdAt: ISODateString
  updatedAt: ISODateString | null
  isMine: boolean
}

export interface VendorSummary {
  id: Id
  userId: Id
  businessName: string
  slug: string
  category: VendorCategory
  location: string
  avatarUrl: string | null
  rating: number
  ratingsCount: number
  likesCount: number
  isVerified: boolean
  isSaved: boolean
  featuredWorks: MediaItem[]
  availability: 'available' | 'busy' | 'unavailable'
}

export interface Vendor extends VendorSummary {
  coverUrl: string | null
  description: string
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  socials: { instagram?: string; facebook?: string; x?: string; tiktok?: string }
  status: VendorStatus
  worksCount: number
  reviews: VendorReview[]
  promos: VendorPromo[]
  joinedAt: ISODateString
  isMine: boolean
}

export interface VendorFilters {
  search?: string
  location?: string
  categorySlug?: string
  minRating?: number
  availability?: 'any' | 'available' | 'busy'
  sort?: 'relevance' | 'rating' | 'newest'
  page?: number
  perPage?: number
}

export interface VendorProfilePayload {
  businessName: string
  location: string
  categoryId: Id
  description: string
  avatarUploadId?: string | null
  coverUploadId?: string | null
  contactEmail?: string
  contactPhone?: string
  website?: string
}

export interface VendorWorkPayload {
  title: string
  description: string
  mediaUploadIds: string[]
}

export interface ReviewPayload {
  rating: number
  comment: string
}
