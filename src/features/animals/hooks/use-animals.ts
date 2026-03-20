import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAvailableAnimals } from '../services/animals.service'
import type { Animal, AnimalFilters } from '../types/animal.types'

export function useAnimals(filters: AnimalFilters = {}) {
  const { data: all = [], isLoading, error, refetch } = useQuery({
    queryKey: ['animals', 'list'],
    queryFn: getAvailableAnimals,
  })

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])

  return { animals: filtered, total: filtered.length, isLoading, error, refetch }
}

export function useFeaturedAnimals(
  count: number = 6,
  strategy: 'latest' | 'random' = 'latest',
) {
  const query = useQuery({
    queryKey: ['animals', 'list'],
    queryFn: getAvailableAnimals,
    staleTime: 1000 * 60 * 10,
  })

  const data = useMemo(
    () => selectFeaturedAnimals(query.data ?? [], count, strategy),
    [query.data, count, strategy],
  )

  return { ...query, data }
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

function selectFeaturedAnimals(
  animals: Animal[],
  count: number,
  strategy: 'latest' | 'random',
) {
  const pool = [...animals]

  if (strategy === 'random') {
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
  }

  return pool.slice(0, count)
}
