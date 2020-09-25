export interface Episode {
  guid: string
  title: string
  pubDate: string
  description: string
  audioUrl: string
  audioSize: number
  audioType: string
  contentEncoded?: string
  subtitle?: string
  link?: string
  duration?: number
  categories?: string[]
  episode?: number
  season?: number
}

export interface Podcast {
  title: string
  description: string
  imageUrl: string
  category: string
  subcategory: string
  author: string
  ownerName: string
  ownerEmail: string
  episodes: Episode[]
  lastBuildDate?: string
  link?: string
  itunesLink?: string
  spotifyLink?: string
  googleLink?: string
  atomLink?: string
  language?: string
  type?: 'episodic' | 'serial'
  complete?: 'Yes' | any
}
