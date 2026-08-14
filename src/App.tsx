import { useState } from 'react'
import {
  Bell,
  CalendarDays,
  Camera,
  ChevronRight,
  Compass,
  Home,
  Menu,
  Moon,
  Shield,
  Sun,
  Users,
} from 'lucide-react'

type Tab = 'Home' | 'Houses' | 'Reunion' | 'Memories' | 'Account'

const tabs: { label: Tab; icon: typeof Home }[] = [
  { label: 'Home', icon: Home },
  { label: 'Houses', icon: Users },
  { label: 'Reunion', icon: CalendarDays },
  { label: 'Memories', icon: Camera },
  { label: 'Account', icon: Menu },
]

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home')
  const [dark, setDark] = useState(false)

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <header className="topbar">
        <div className="brand-mark" aria-label="Ajinkyans home">
          <span className="brand-dot" />
          <span>ajinkyans</span>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Notifications"><Bell size={19} /></button>
          <button className="icon-button" aria-label="Toggle theme" onClick={() => setDark((value) => !value)}>
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="avatar" aria-label="Account">SP</div>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'Home' && <HomeView onReunion={() => setActiveTab('Reunion')} />}
        {activeTab !== 'Home' && <PlaceholderView tab={activeTab} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {tabs.map(({ label, icon: Icon }) => (
          <button
            className={activeTab === label ? 'nav-item active' : 'nav-item'}
            key={label}
            onClick={() => setActiveTab(label)}
          >
            <Icon size={20} strokeWidth={activeTab === label ? 2.4 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function HomeView({ onReunion }: { onReunion: () => void }) {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-overlay" />
        <div className="hero-content">
          <p className="eyebrow">Sainik School Satara · 2002 Batch</p>
          <h1>25 years.<br /><em>One brotherhood.</em></h1>
          <p className="hero-caption">Our memories, preserved.</p>
        </div>
      </section>

      <section className="countdown-card">
        <div>
          <p className="eyebrow">Silver Jubilee Reunion</p>
          <h2>06–08 January 2027</h2>
          <p className="muted">Sainik School Satara · India</p>
        </div>
        <button className="round-arrow" onClick={onReunion} aria-label="Open reunion"><ChevronRight size={20} /></button>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Our journey</p>
          <h2>Then, now, always.</h2>
        </div>
        <Compass size={19} className="muted-icon" />
      </section>

      <div className="timeline" aria-label="Our journey timeline">
        {[
          ['2002', 'Passed out'],
          ['2012', 'Ten years'],
          ['2022', 'Two decades'],
          ['2027', 'Silver Jubilee'],
        ].map(([year, label], index) => (
          <div className={index === 3 ? 'timeline-item current' : 'timeline-item'} key={year}>
            <span className="timeline-year">{year}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <section className="section-heading latest-heading">
        <div>
          <p className="eyebrow">From the archive</p>
          <h2>Latest memories</h2>
        </div>
        <button className="text-button">View all <ChevronRight size={16} /></button>
      </section>

      <div className="memory-placeholder">
        <Camera size={24} />
        <div>
          <strong>Your shared archive starts here.</strong>
          <p className="muted">Photos and stories from the batch will appear here.</p>
        </div>
      </div>

      <div className="privacy-note"><Shield size={15} /> Private to approved Ajinkyans members</div>
    </div>
  )
}

function PlaceholderView({ tab }: { tab: Tab }) {
  return (
    <div className="empty-page">
      <div className="empty-icon"><Compass size={27} /></div>
      <p className="eyebrow">Ajinkyans 2002</p>
      <h1>{tab}</h1>
      <p className="muted">This foundation screen is ready for the next implementation milestone.</p>
    </div>
  )
}

export default App
