import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'danger' }

export function Button({ className = '', tone = 'primary', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button--${tone} ${className}`.trim()} {...props} />
}

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`ui-icon-button ${className}`.trim()} aria-label={label} {...props}>{children}</button>
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`.trim()} {...props} />
}

export function Avatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return <span className="ui-avatar" aria-label={name}>{imageUrl ? <img src={imageUrl} alt="" /> : initials}</span>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="ui-section-heading"><h2>{title}</h2>{action}</div>
}

export function Skeleton({ label }: { label: string }) {
  return <span className="ui-skeleton" aria-label={label} role="status" />
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return <section className="ui-state" aria-live="polite"><h2>{title}</h2>{children}</section>
}

export function ErrorState({ title, children, retry }: { title: string; children?: ReactNode; retry?: ReactNode }) {
  return <section className="ui-state ui-state--error" role="alert"><h2>{title}</h2>{children}{retry}</section>
}

export function Toast({ children }: { children: ReactNode }) {
  return <p className="ui-toast" role="status" aria-live="polite">{children}</p>
}
