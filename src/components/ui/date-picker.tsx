import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_LONG = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => CURRENT_YEAR - i)

// ── Helpers ───────────────────────────────────────────────────────────────────

type ParsedDate = { year: number; month: number; day: number }

function parse(value: string): ParsedDate | null {
  if (!value || value.length < 10) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d || isNaN(new Date(y, m - 1, d).getTime())) return null
  return { year: y, month: m, day: d }
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function toDisplay(value: string): string {
  const p = parse(value)
  if (!p) return ''
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`
}

interface CalDay {
  year: number
  month: number
  day: number
  isCurrentMonth: boolean
}

function buildCalendar(year: number, month: number): CalDay[] {
  // month: 1-indexed
  const firstDOW = new Date(year, month - 1, 1).getDay() // 0 = Sunday
  const lastDayNum = new Date(year, month, 0).getDate()
  const lastDayPrev = new Date(year, month - 1, 0).getDate()

  const days: CalDay[] = []

  // Fill leading days from previous month
  for (let i = firstDOW - 1; i >= 0; i--) {
    const prevM = month === 1 ? 12 : month - 1
    const prevY = month === 1 ? year - 1 : year
    days.push({ year: prevY, month: prevM, day: lastDayPrev - i, isCurrentMonth: false })
  }

  // Current month days
  for (let d = 1; d <= lastDayNum; d++) {
    days.push({ year, month, day: d, isCurrentMonth: true })
  }

  // Fill trailing days from next month to reach 42 cells
  const remaining = 42 - days.length
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  for (let d = 1; d <= remaining; d++) {
    days.push({ year: nextY, month: nextM, day: d, isCurrentMonth: false })
  }

  return days
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface DatePickerProps {
  label?: string
  value?: string        // YYYY-MM-DD
  onChange?: (value: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  required?: boolean
  id?: string
  className?: string
}

export function DatePicker({
  label,
  value = '',
  onChange,
  onBlur,
  error,
  hint,
  required,
  id,
  className,
}: DatePickerProps) {
  const today = new Date()
  const parsed = parse(value)

  const [open, setOpen] = useState(false)
  const [pickingYear, setPickingYear] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth() + 1)

  const containerRef = useRef<HTMLDivElement>(null)
  const yearGridRef = useRef<HTMLDivElement>(null)

  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  // Sync view when value changes from outside
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year)
      setViewMonth(parsed.month)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setPickingYear(false)
        onBlur?.()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, onBlur])

  // Scroll selected year into view when picker opens
  useEffect(() => {
    if (!pickingYear) return
    const t = setTimeout(() => {
      const el = yearGridRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
      el?.scrollIntoView({ block: 'center', behavior: 'auto' })
    }, 50)
    return () => clearTimeout(t)
  }, [pickingYear])

  const calDays = useMemo(() => buildCalendar(viewYear, viewMonth), [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setPickingYear(false)
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setPickingYear(false)
  }

  function selectDay(y: number, m: number, d: number) {
    onChange?.(toISO(y, m, d))
    setOpen(false)
    setPickingYear(false)
    onBlur?.()
  }

  const isSel = (y: number, m: number, d: number) =>
    parsed?.year === y && parsed?.month === m && parsed?.day === d

  const isTod = (y: number, m: number, d: number) =>
    today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === d

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-danger ml-1" aria-hidden="true">*</span>}
        </label>
      )}

      {/* Trigger */}
      <button
        id={inputId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(o => !o); setPickingYear(false) }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring',
          error && 'border-danger focus:ring-danger',
          !value ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <span>{value ? toDisplay(value) : 'DD/MM/AAAA'}</span>
        <CalendarDays size={15} className="shrink-0 text-muted-foreground" />
      </button>

      {/* Calendar popup */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Calendário"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Mês anterior"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft size={15} />
              </button>

              <button
                type="button"
                onClick={() => setPickingYear(y => !y)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                {MONTHS_LONG[viewMonth - 1]} {viewYear}
                <ChevronDown
                  size={12}
                  className={cn('transition-transform duration-200', pickingYear && 'rotate-180')}
                />
              </button>

              <button
                type="button"
                onClick={nextMonth}
                aria-label="Próximo mês"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Body: year grid or calendar */}
            <AnimatePresence mode="wait" initial={false}>
              {pickingYear ? (
                <motion.div
                  key="years"
                  ref={yearGridRef}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="grid grid-cols-4 gap-1 overflow-y-auto p-2"
                  style={{ maxHeight: '200px' }}
                >
                  {YEARS.map((y) => (
                    <button
                      key={y}
                      type="button"
                      data-selected={viewYear === y ? 'true' : 'false'}
                      onClick={() => { setViewYear(y); setPickingYear(false) }}
                      className={cn(
                        'rounded-md py-1.5 text-sm transition-colors',
                        viewYear === y
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'text-foreground hover:bg-muted',
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="p-2"
                >
                  {/* Weekday headers */}
                  <div className="mb-1 grid grid-cols-7">
                    {WEEKDAYS.map((wd) => (
                      <div
                        key={wd}
                        className="py-1 text-center text-xs font-medium text-muted-foreground"
                      >
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Day buttons */}
                  <div className="grid grid-cols-7">
                    {calDays.map(({ year: y, month: m, day: d, isCurrentMonth }, i) => {
                      const sel = isSel(y, m, d)
                      const tod = isTod(y, m, d)
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectDay(y, m, d)}
                          className={cn(
                            'flex h-8 w-full items-center justify-center rounded-md text-sm transition-colors',
                            sel
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : tod && !sel
                              ? 'border border-primary/40 text-primary font-medium hover:bg-primary/10'
                              : isCurrentMonth
                              ? 'text-foreground hover:bg-muted'
                              : 'text-muted-foreground/30 hover:bg-muted/50',
                          )}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0, height: 0, marginTop: -4 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
            exit={{ opacity: 0, height: 0, marginTop: -4 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden text-xs text-danger"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden text-xs text-muted-foreground"
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
