export * from './api'
export * from './auth'
export * from './user'
export * from './event'
export * from './ticketing'
export * from './vendor'
export * from './community'
export * from './messaging'
export * from './notification'
export * from './wallet'
export * from './organizer'
export * from './planner'
export * from './admin'

export interface Upload {
  id: string
  url: string
  thumbnailUrl: string | null
  mimeType: string
  sizeBytes: number
  width: number | null
  height: number | null
  provider: 'cloudinary' | 's3' | 'local'
}

export interface UploadSignature {
  provider: 'cloudinary' | 's3'
  uploadUrl: string
  fields: Record<string, string>
  publicUrlTemplate: string
  expiresAt: string
}
