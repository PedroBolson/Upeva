import { contactSocialLinks } from '../config/contact-links'

export function ContactSocialRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {contactSocialLinks.map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/80 text-primary transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
        >
          <Icon size={21} strokeWidth={1.75} />
        </a>
      ))}
    </div>
  )
}
