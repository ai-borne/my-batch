import { useEffect, useState } from 'react'

type InstallEvent = Event & { prompt: () => Promise<void> }

export function InstallButton() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])
  if (!installEvent) return null
  return <button className="text-button" onClick={() => void installEvent.prompt().then(() => setInstallEvent(null))}>Install app</button>
}
