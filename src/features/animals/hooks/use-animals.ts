import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailableAnimals, getFeaturedAnimals } from '../services/animals.service'
import type { Animal, AnimalFilters } from '../types/animal.types'

export function useAnimals(filters: AnimalFilters = {}) {
  const { data: all = [], isLoading, error, refetch } = useQuery({
    queryKey: ['animals', 'list'],
    queryFn: getAvailableAnimals,
  })

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])

  return { animals: filtered, total: filtered.length, isLoading, error, refetch }
}

export function useFeaturedAnimals(count: number = 6) {
  return useQuery({
    queryKey: ['animals', 'featured', count],
    queryFn: () => getFeaturedAnimals(count),
    staleTime: 1000 * 60 * 10,
  })
}

function applyFilters(animals: Animal[], filters: AnimalFilters): Animal[] {
  return animals.filter((a) => {
    if (filters.species && a.species !== filters.species) return false
    if (filters.sex && a.sex !== filters.sex) return false
    if (filters.size && a.size !== filters.size) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (!a.name.toLowerCase().includes(q)) return false
    }
    return true
  })
}
