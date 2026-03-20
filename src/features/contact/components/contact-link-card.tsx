import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ContactHubLink } from '../config/contact-links'

interface ContactLinkCardProps {
  item: ContactHubLink
}

export function ContactLinkCard({ item }: ContactLinkCardProps) {
  const content = (
    <div className="group flex items-center gap-4 rounded-[1.75rem] border border-border bg-accent/65 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
        <item.icon size={22} strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground sm:text-lg">
          {item.label}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.description}
        </p>
      </div>

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-primary transition-transform duration-150 group-hover:translate-x-0.5">
        {item.external ? <ArrowUpRight size={18} /> : <ArrowRight size={18} />}
      </div>
    </div>
  )

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }

  return <Link to={item.href}>{content}</Link>
}
