export const PLACEHOLDER_IMAGES = {
  hero: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80',
  music: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
  tech: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
  food: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=80',
  workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1200&q=80',
  arts: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
  community: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
  defaultCover: 'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&w=1200&q=80',
}

export function getEventPlaceholder(categorySlugOrName?: string, index = 0): string {
  const normalized = (categorySlugOrName || '').toLowerCase()
  if (normalized.includes('music') || normalized.includes('concert')) return PLACEHOLDER_IMAGES.music
  if (normalized.includes('tech') || normalized.includes('conference') || normalized.includes('code')) return PLACEHOLDER_IMAGES.tech
  if (normalized.includes('food') || normalized.includes('drink') || normalized.includes('dining')) return PLACEHOLDER_IMAGES.food
  if (normalized.includes('workshop') || normalized.includes('class') || normalized.includes('learn')) return PLACEHOLDER_IMAGES.workshop
  if (normalized.includes('art') || normalized.includes('culture') || normalized.includes('theatre')) return PLACEHOLDER_IMAGES.arts
  if (normalized.includes('sport') || normalized.includes('fitness')) return PLACEHOLDER_IMAGES.sports
  if (normalized.includes('community') || normalized.includes('meetup')) return PLACEHOLDER_IMAGES.community

  const list = [
    PLACEHOLDER_IMAGES.hero,
    PLACEHOLDER_IMAGES.tech,
    PLACEHOLDER_IMAGES.music,
    PLACEHOLDER_IMAGES.food,
    PLACEHOLDER_IMAGES.workshop,
    PLACEHOLDER_IMAGES.arts,
  ]
  return list[index % list.length]
}
