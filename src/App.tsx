
import React, { useEffect, useMemo, useState } from 'react'

type Appt = {
  id: string
  title: string
  people: string[]
  category: string
  provider?: string
  location?: string
  telehealth?: boolean
  start: string
  end: string
  reminderMins?: number | null
  notes?: string
}

type SharePayload = {
  version: 1
  people: string[]
  categories: string[]
  appts: Appt[]
}

const DEFAULT_PEOPLE = ['Piyush', 'Prisha', 'Samara', 'Samar']
const DEFAULT_CATEGORIES = ['Doctor', 'Dentist', 'School', 'Work', 'Travel', 'Other']
const COLOR_PALETTE = ['#2563eb', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#facc15', '#0ea5e9']
const categoryColorCache = new Map<string, string>()
const SAMPLE_APPTS = createSampleAppointments()

export default function App() {
  const [tab, setTab] = useState<'list'|'settings'|'pwa'|'tests'>('list')
  const [people, setPeople] = useState<string[]>(() => JSON.parse(localStorage.getItem('fam.people') || 'null') ?? DEFAULT_PEOPLE)
  const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem('fam.categories') || 'null') ?? DEFAULT_CATEGORIES)
  const [appts, setAppts] = useState<Appt[]>(() => JSON.parse(localStorage.getItem('fam.appts') || 'null') ?? SAMPLE_APPTS)
  const [query, setQuery] = useState('')
  const [filterPerson, setFilterPerson] = useState<string | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all')
  const [showPast, setShowPast] = useState(false)
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const [testOutput, setTestOutput] = useState('')
  const [toast, setToast] = useState('')
  const [pendingShare, setPendingShare] = useState<SharePayload | null>(null)

  useEffect(()=>{ localStorage.setItem('fam.people', JSON.stringify(people)) },[people])
  useEffect(()=>{ localStorage.setItem('fam.categories', JSON.stringify(categories)) },[categories])
  useEffect(()=>{ localStorage.setItem('fam.appts', JSON.stringify(appts)) },[appts])
  useEffect(()=>{
    if(!toast) return
    const id = window.setTimeout(()=>setToast(''), 4000)
    return () => window.clearTimeout(id)
  }, [toast])
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('share')
    if(encoded){
      const payload = decodeSharePayload(encoded)
      if(payload){
        setPendingShare(payload)
      } else {
        setToast('We could not read that shared link.')
      }
      params.delete('share')
      const rest = params.toString()
      const next = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`
      window.history.replaceState({}, '', next)
    }
  }, [])

  const filtered = useMemo(()=>{
    const now = new Date()
    return appts
      .filter(a => showPast || new Date(a.start) >= new Date(now.getTime() - 12*60*60*1000))
      .filter(a => filterPerson === 'all' ? true : a.people.includes(filterPerson))
      .filter(a => filterCategory === 'all' ? true : a.category === filterCategory)
      .filter(a => [a.title, a.location, a.provider, a.notes].join(' ').toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [appts, query, filterPerson, filterCategory, showPast])

  const notify = (message: string) => { setToast(message) }

  function addAppt(a: Appt){ setAppts(p=>[...p,a]) }
  function updateAppt(id: string, patch: Partial<Appt>){ setAppts(p=>p.map(a=>a.id===id?{...a,...patch}:a)) }
  function deleteAppt(id: string){
    setAppts(p=>p.filter(a=>a.id!==id))
    setSelection(s=>{ const n={...s}; delete n[id]; return n })
  }
  function toggleAll(select:boolean){ const next: Record<string, boolean> = {}; filtered.forEach(a=>next[a.id]=select); setSelection(next) }
  function handleNewCategory(cat:string){
    const clean = cat.trim()
    if(!clean) return
    setCategories(p=>Array.from(new Set([...p, clean])))
    notify(`Added category “${clean}”`)
  }
  function buildShareData(): SharePayload {
    return {
      version: 1,
      people: [...people],
      categories: [...categories],
      appts: appts.map(a => ({ ...a }))
    }
  }
  async function shareLink(){
    const payload = buildShareData()
    const encoded = encodeSharePayload(payload)
    const url = new URL(window.location.href)
    url.searchParams.set('share', encoded)
    const shareURL = url.toString()
    try {
      if('share' in navigator && typeof navigator.share === 'function'){
        await navigator.share({ url: shareURL, title: 'Family Appointment Manager', text: 'Here is our family schedule 💖' })
        notify('Share sheet opened. 🎁')
        return
      }
    } catch {
      // fall through to clipboard copy
    }
    try {
      if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
        await navigator.clipboard.writeText(shareURL)
        notify('Shareable link copied to clipboard! ✨')
      } else {
        window.prompt('Copy this link to share your family schedule:', shareURL)
        notify('Copy the link shown to share it. ✨')
      }
    } catch {
      window.prompt('Copy this link to share your family schedule:', shareURL)
      notify('Copy the link shown to share it. ✨')
    }
  }
  function downloadShareJson(){
    const payload = buildShareData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    trigger(`family-appointments-${new Date().toISOString().slice(0,10)}.json`, blob)
    notify('Shared JSON downloaded! 💾')
  }
  function exportICS(selectedOnly=false){
    const items = (selectedOnly ? filtered.filter(a => selection[a.id]) : filtered)
    const ics = buildICS(items)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `family-appointments-${new Date().toISOString().slice(0,10)}.ics`
    a.click(); URL.revokeObjectURL(url)
    notify(selectedOnly ? 'Selected events exported!' : 'Calendar exported! 📆')
  }
  async function importICS(file: File){
    const text = await file.text()
    const imported = parseICS(text)
    if(imported.length){
      setAppts(p=>[...p, ...imported])
      notify(`Imported ${imported.length} appointment${imported.length>1?'s':''} from calendar`)
    } else {
      notify('No appointments found in that calendar file.')
    }
  }
  function applyShare(payload: SharePayload){
    if(appts.length && !window.confirm('Importing a shared schedule will replace your current appointments. Continue?')) return
    setPeople(payload.people.length ? Array.from(new Set(payload.people)) : DEFAULT_PEOPLE)
    setCategories(payload.categories.length ? Array.from(new Set(payload.categories)) : DEFAULT_CATEGORIES)
    setAppts(payload.appts)
    setPendingShare(null)
    notify('Shared schedule imported! 🤝')
  }

  return (
    <div className="container">
      <header>
        <div>
          <h1>Family Appointment Manager</h1>
          <p className="muted" style={{marginTop:4}}>Keep Piyush, Prisha, Samara, and Samar in sync with colourful, shareable reminders.</p>
        </div>
        <div className="toolbar">
          <label className="btn" title="Import .ics">
            <input type="file" accept=".ics,text/calendar" hidden onChange={async (e)=>{
              const f = e.currentTarget.files?.[0]; if(!f) return; await importICS(f); e.currentTarget.value=''
            }} />
            Import .ics
          </label>
          <button className="btn" onClick={()=>exportICS(false)}>Export all</button>
          <button className="btn" onClick={()=>exportICS(true)} disabled={!Object.values(selection).some(Boolean)}>Export selected</button>
          <button className="btn" onClick={shareLink}>Share link</button>
          <button className="btn" onClick={downloadShareJson}>Share JSON</button>
          <button className="primary" onClick={()=>setTab('list')}>Add appointment</button>
        </div>
      </header>

      {pendingShare && (
        <div className="banner">
          <div>
            <strong>Shared schedule ready!</strong>
            <div className="muted">{pendingShare.appts.length} appointment{pendingShare.appts.length===1?'':'s'} for {formatPeopleList(pendingShare.people)}.</div>
          </div>
          <div className="actions">
            <button className="primary" onClick={()=>applyShare(pendingShare)}>Import shared plan</button>
            <button className="btn" onClick={()=>setPendingShare(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${tab==='list'?'active':''}`} onClick={()=>setTab('list')}>List</button>
        <button className={`tab-btn ${tab==='settings'?'active':''}`} onClick={()=>setTab('settings')}>Settings</button>
        <button className={`tab-btn ${tab==='pwa'?'active':''}`} onClick={()=>setTab('pwa')}>PWA</button>
        <button className={`tab-btn ${tab==='tests'?'active':''}`} onClick={()=>setTab('tests')}>Diagnostics</button>
      </div>

      {tab==='list' && (
        <>
          <div className="card">
            <div className="content grid md:grid-6">
              <div className="grid" style={{gridColumn: 'span 2'}}>
                <label>Search</label>
                <input placeholder="doctor, dentist, vaccine, school…" value={query} onChange={e=>setQuery(e.target.value)} />
              </div>
              <div>
                <label>Person</label>
                <select value={filterPerson} onChange={e=>setFilterPerson(e.target.value)}>
                  <option value="all">All</option>
                  {people.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label>Category</label>
                <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <input id="past" type="checkbox" checked={showPast} onChange={e=>setShowPast(e.target.checked)} /><label htmlFor="past">Show past</label>
              </div>
              <div className="actions">
                <button className="btn" onClick={()=>toggleAll(true)}>Select all</button>
                <button className="btn" onClick={()=>toggleAll(false)}>Clear</button>
              </div>
            </div>
          </div>

          <AddForm people={people} categories={categories} onAdd={addAppt} onNewCategory={handleNewCategory} onNotify={notify} />

          <div className="list">
            {filtered.length===0 && <p className="muted">No appointments match your filters. Add one above.</p>}
            {filtered.map(a => (
              <ApptRow key={a.id} a={a} selected={!!selection[a.id]}
                onSelect={(v)=>setSelection(s=>({...s, [a.id]: v}))}
                onUpdate={(patch)=>updateAppt(a.id, patch)}
                onDelete={()=>{ deleteAppt(a.id); notify('Appointment removed. ❌') }}
                onNotify={notify} />
            ))}
          </div>
        </>
      )}

      {tab==='settings' && (
        <div className="grid">
          <div className="card"><div className="content">
            <h3>People</h3>
            <PeopleEditor people={people} onChange={setPeople} />
          </div></div>
          <div className="card"><div className="content">
            <h3>Categories</h3>
            <CategoryEditor categories={categories} onChange={setCategories} />
          </div></div>
        </div>
      )}

      {tab==='pwa' && (
        <div className="card"><div className="content">
          <h3>Installable App (PWA) Packager</h3>
          <p className="muted">Download the files and upload them to your site root on Netlify.</p>
          <div className="actions">
            <button className="btn" onClick={downloadManifest}>Download manifest.webmanifest</button>
            <button className="btn" onClick={downloadSW}>Download sw.js</button>
            <button className="btn" onClick={()=>downloadIcon(192)}>Download icon-192.png</button>
            <button className="btn" onClick={()=>downloadIcon(512)}>Download icon-512.png</button>
          </div>
          <ol>
            <li>Deploy to Netlify (this folder).</li>
            <li>Ensure <code>manifest.webmanifest</code>, <code>sw.js</code>, and icons are in <code>/</code>.</li>
            <li>Open the site in Android Chrome → menu → <b>Add to Home screen</b>.</li>
          </ol>
          <pre className="muted">{exampleRegisterSnippet}</pre>
        </div></div>
      )}

      {tab==='tests' && (
        <div className="card"><div className="content">
          <h3>Diagnostics & Tests</h3>
          <div className="actions">
            <button className="btn" onClick={()=>runTests(setTestOutput)}>Run tests</button>
            <button className="btn" onClick={()=>setTestOutput('')}>Clear</button>
          </div>
          <pre className="muted" style={{whiteSpace:'pre-wrap'}}>{testOutput || 'No tests run yet.'}</pre>
        </div></div>
      )}
      {toast && <div className="toast"><span>{toast}</span></div>}
    </div>
  )
}

function AddForm({ people, categories, onAdd, onNewCategory, onNotify }:{ people:string[]; categories:string[]; onAdd:(a:Appt)=>void; onNewCategory:(c:string)=>void; onNotify:(msg:string)=>void }){
  const [draft, setDraft] = useState<Appt>(()=>createDraft(people, categories))
  const [newCat, setNewCat] = useState('')

  useEffect(()=>{
    setDraft(prev => {
      const allowed = prev.people.filter(p => people.includes(p))
      if(!allowed.length && people[0]) allowed.push(people[0])
      const category = categories.includes(prev.category) ? prev.category : (categories[0] ?? prev.category)
      if(allowed.join('|') === prev.people.join('|') && category === prev.category) return prev
      return { ...prev, people: allowed, category }
    })
  }, [people, categories])

  function addCategory(){
    const clean = newCat.trim()
    if(!clean) return
    onNewCategory(clean)
    setDraft(d => ({ ...d, category: clean }))
    setNewCat('')
  }

  function togglePerson(person:string, checked:boolean){
    setDraft(prev => {
      const next = checked ? Array.from(new Set([...prev.people, person])) : prev.people.filter(p => p!==person)
      return { ...prev, people: next }
    })
  }

  function save(){
    if(!draft.title.trim() || !draft.start || !draft.end || draft.people.length===0){
      onNotify('Please add a title, time, and at least one family member.')
      return
    }
    const payload = { ...draft, id: makeId(), start: normalizeISO(draft.start), end: normalizeISO(draft.end) }
    onAdd(payload)
    onNotify('Appointment added! 🎉')
    setDraft(prev => {
      const base = createDraft(people, categories)
      const retainedPeople = prev.people.filter(p => people.includes(p))
      const category = categories.includes(prev.category) ? prev.category : base.category
      return { ...base, category, people: retainedPeople.length ? retainedPeople : base.people }
    })
  }

  const isDisabled = !draft.title.trim() || draft.people.length === 0

  return (
    <div className="card"><div className="content">
      <div>
        <h3>Create a new appointment</h3>
        <p className="muted">Colorful reminders for checkups, school events, travel plans, and everything in between.</p>
      </div>
      <div className="row">
        <div>
          <label>Title</label>
          <input value={draft.title} onChange={e=>setDraft({...draft, title:e.target.value})} placeholder="e.g., Pediatric checkup" />
        </div>
        <div>
          <label>Category</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
            <select value={draft.category} onChange={e=>setDraft({...draft, category:e.target.value})}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Add new…" value={newCat} onChange={e=>setNewCat(e.target.value)} style={{width:140}} />
            <button type="button" className="btn" onClick={addCategory}>Add</button>
          </div>
        </div>
        <div>
          <label>People</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {people.map(p => (
              <label key={p} className="pill">
                <input type="checkbox" checked={draft.people.includes(p)} onChange={e=>togglePerson(p, e.target.checked)} />
                {p}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>Provider / Doctor</label>
          <input value={draft.provider || ''} onChange={e=>setDraft({...draft, provider:e.target.value})} placeholder="e.g., Dr. Kullnat" />
        </div>
        <div style={{gridColumn:'1/3'}}>
          <label>Location</label>
          <input value={draft.location || ''} onChange={e=>setDraft({...draft, location:e.target.value})} placeholder="e.g., Allegro Pediatrics, Redmond" />
        </div>
        <div>
          <label>Start</label>
          <input type="datetime-local" value={toLocalInputValue(draft.start)} onChange={e=>setDraft({...draft, start: e.target.value ? normalizeISO(e.target.value) : draft.start})} />
        </div>
        <div>
          <label>End</label>
          <input type="datetime-local" value={toLocalInputValue(draft.end)} onChange={e=>setDraft({...draft, end: e.target.value ? normalizeISO(e.target.value) : draft.end})} />
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <input id="tele" type="checkbox" checked={!!draft.telehealth} onChange={e=>setDraft({...draft, telehealth:e.target.checked})} /><label htmlFor="tele">Telehealth</label>
        </div>
        <div>
          <label>Reminder (minutes before)</label>
          <input type="number" min={0} step={5} value={draft.reminderMins ?? ''} onChange={e=>setDraft({...draft, reminderMins:e.target.value===''? null : Number(e.target.value)})} placeholder="e.g., 90" />
        </div>
        <div style={{gridColumn:'1/3'}}>
          <label>Notes</label>
          <textarea value={draft.notes || ''} onChange={e=>setDraft({...draft, notes:e.target.value})} placeholder="Bring insurance card, vaccine record…" />
        </div>
      </div>
      <div className="actions" style={{marginTop:12}}>
        <button className="primary" onClick={save} disabled={isDisabled}>Add appointment</button>
      </div>
    </div></div>
  )
}


function PeopleEditor({ people, onChange }:{ people:string[]; onChange:(list:string[])=>void }){
  const [draft, setDraft] = useState('')
  function add(){
    const clean = draft.trim()
    if(!clean) return
    if(people.includes(clean)){
      setDraft('')
      return
    }
    onChange([...people, clean])
    setDraft('')
  }
  function remove(name:string){
    onChange(people.filter(p => p!==name))
  }
  return (
    <div className="grid" style={{gap:12}}>
      <div className="actions" style={{flexWrap:'nowrap'}}>
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Add family member" style={{flex:1}} />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      <div className="actions" style={{flexWrap:'wrap', gap:8}}>
        {people.map(person => (
          <span key={person} className="pill" style={{display:'inline-flex', alignItems:'center', gap:8}}>
            {person}
            <button type="button" className="btn" onClick={()=>remove(person)} style={{padding:'4px 8px'}}>×</button>
          </span>
        ))}
        {people.length===0 && <span className="muted">Add your crew so you can tag them in appointments.</span>}
      </div>
    </div>
  )
}

function CategoryEditor({ categories, onChange }:{ categories:string[]; onChange:(list:string[])=>void }){
  const [draft, setDraft] = useState('')
  function add(){
    const clean = draft.trim()
    if(!clean) return
    if(categories.includes(clean)){
      setDraft('')
      return
    }
    onChange([...categories, clean])
    setDraft('')
  }
  function remove(name:string){
    onChange(categories.filter(c => c!==name))
  }
  return (
    <div className="grid" style={{gap:12}}>
      <div className="actions" style={{flexWrap:'nowrap'}}>
        <input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Add category" style={{flex:1}} />
        <button type="button" className="btn" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      <div className="actions" style={{flexWrap:'wrap', gap:8}}>
        {categories.map(cat => (
          <span key={cat} className="pill" style={{display:'inline-flex', alignItems:'center', gap:8}}>
            {cat}
            <button type="button" className="btn" onClick={()=>remove(cat)} style={{padding:'4px 8px'}}>×</button>
          </span>
        ))}
        {categories.length===0 && <span className="muted">Use categories to colour-code medical, school, and fun events.</span>}
      </div>
    </div>
  )
}

function ApptRow({ a, selected, onSelect, onUpdate, onDelete, onNotify }:{ a:Appt; selected:boolean; onSelect:(v:boolean)=>void; onUpdate:(p:Partial<Appt>)=>void; onDelete:()=>void; onNotify:(msg:string)=>void }){
  const start = new Date(a.start)
  const end = new Date(a.end)
  const categoryColor = colorForCategory(a.category)
  async function copySummary(){
    const text = `${a.title} — ${start.toLocaleString()} to ${end.toLocaleTimeString()}\nPeople: ${a.people.join(', ') || '—'}\nPlace:${a.location || ''}\nProvider: ${a.provider || ''}\nNotes: ${a.notes || ''}`.trim()
    try {
      if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
        await navigator.clipboard.writeText(text)
        onNotify('Copied appointment to clipboard! 📋')
      } else {
        window.prompt('Copy these appointment details:', text)
        onNotify('Copy the highlighted text to share the details.')
      }
    } catch {
      window.prompt('Copy these appointment details:', text)
      onNotify('Copy the highlighted text to share the details.')
    }
  }
  const friendlyStart = start.toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
  const friendlyEnd = end.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })
  return (
    <div className="card"><div className="content">
      <div className="actions" style={{justifyContent:'space-between', alignItems:'center'}}>
        <div className="actions" style={{gap:12, alignItems:'center'}}>
          <label className="pill"><input type="checkbox" checked={selected} onChange={e=>onSelect(e.target.checked)} /> Select</label>
          <span className="tag" style={{background:categoryColor}}>{a.category}</span>
          {a.telehealth ? <span className="pill" style={{background:'rgba(16, 185, 129, 0.18)', borderColor:'transparent'}}>Telehealth</span> : null}
        </div>
        <div className="actions">
          <button className="btn" onClick={copySummary}>Copy</button>
          <button className="btn" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div className="appointment-meta">
        <div style={{fontWeight:700, fontSize:18}}>{a.title}</div>
        <div className="muted">{friendlyStart} → {friendlyEnd}</div>
        <div>People: <span className="muted">{a.people.length ? a.people.join(', ') : '—'}</span></div>
        <div>Provider: <span className="muted">{a.provider || '—'}</span></div>
        <div>Location: <span className="muted">{a.location || '—'}</span></div>
        <div>Reminder: <span className="muted">{a.reminderMins ? `${a.reminderMins} min before` : '—'}</span></div>
        {a.notes && <div className="muted line-clamp-2">{a.notes}</div>}
      </div>
    </div></div>
  )
}


// Helpers (shared with tests)
function pad(n:number){ return n.toString().padStart(2,'0') }
function toUTC(date: Date){
  const y = date.getUTCFullYear(); const m = pad(date.getUTCMonth()+1); const d = pad(date.getUTCDate())
  const hh = pad(date.getUTCHours()); const mm = pad(date.getUTCMinutes()); const ss = pad(date.getUTCSeconds())
  return `${y}${m}${d}T${hh}${mm}${ss}Z`
}
function normalizeISO(v:string){
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return new Date(v).toISOString()
  return new Date(v).toISOString()
}
function escapeICS(s:string){ return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;") }
function buildICS(items: Appt[]): string {
  const now = toUTC(new Date())
  const lines = ["BEGIN:VCALENDAR","PRODID:-//Family Appointment Manager//EN","VERSION:2.0","CALSCALE:GREGORIAN"]
  for (const a of items) {
    const uid = a.id || makeId()
    const dtStart = toUTC(new Date(a.start)); const dtEnd = toUTC(new Date(a.end))
    const title = escapeICS(a.title || "Appointment")
    const descParts: string[] = []
    if (a.provider) descParts.push(`Provider: ${a.provider}`)
    if (a.people?.length) descParts.push(`People: ${a.people.join(', ')}`)
    if (a.notes) descParts.push(a.notes)
    const desc = escapeICS(descParts.join("\\n"))
    const loc = escapeICS(a.location || "")
    lines.push("BEGIN:VEVENT",`UID:${uid}`,`DTSTAMP:${now}`,`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${title}`, loc?`LOCATION:${loc}`:"", desc?`DESCRIPTION:${desc}`:"", "END:VEVENT")
  }
  lines.push("END:VCALENDAR")
  return lines.filter(Boolean).join("\\r\\n")
}
function unescapeICS(s:string){ return s.replace(/\\n/g, "\\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\\\") }
function parseICS(text:string): Appt[] {
  const events = text.split(/BEGIN:VEVENT/).slice(1).map(c => "BEGIN:VEVENT"+c)
  const out: Appt[] = []
  for (const ev of events) {
    const g = (re:RegExp) => (ev.match(re)?.[1] || "").trim()
    const DTSTART = g(/DTSTART(?:;[^:\\n]+)?:([\\dTZ]+)/)
    const DTEND = g(/DTEND(?:;[^:\\n]+)?:([\\dTZ]+)/)
    const SUMMARY = g(/SUMMARY:(.*)/)
    const LOCATION = g(/LOCATION:(.*)/)
    const DESCRIPTION = g(/DESCRIPTION:(.*)/)
    const start = parseICSDate(DTSTART); const end = parseICSDate(DTEND || DTSTART)
    const notes = unescapeICS(DESCRIPTION)
    const provider = (notes.match(/Provider:\\s*([^\\\\n]+)/)?.[1] || "").trim()
    const peopleLine = (notes.match(/People:\\s*([^\\\\n]+)/)?.[1] || "").trim()
    const people = peopleLine ? peopleLine.split(/,\\s*/).filter(Boolean) : []
    out.push({ id: makeId(), title: (SUMMARY || "Appointment"), people, category:'Imported', provider, location:(LOCATION || ""), start: start.toISOString(), end: end.toISOString(), telehealth:false, reminderMins:null, notes })
  }
  return out
}
function parseICSDate(s:string){
  if(!s) return new Date()
  if(/Z$/.test(s)){ const yyyy=+s.slice(0,4), mm=+s.slice(4,6)-1, dd=+s.slice(6,8), HH=+s.slice(9,11)||0, MM=+s.slice(11,13)||0, SS=+s.slice(13,15)||0; return new Date(Date.UTC(yyyy,mm,dd,HH,MM,SS)) }
  if(/^\\d{8}$/.test(s)){ const yyyy=+s.slice(0,4), mm=+s.slice(4,6)-1, dd=+s.slice(6,8); return new Date(yyyy,mm,dd) }
  return new Date(s)
}
function toLocalInputValue(v:string){ const d=new Date(v); const y=d.getFullYear(); const m=(d.getMonth()+1).toString().padStart(2,'0'); const day=d.getDate().toString().padStart(2,'0'); const hh=d.getHours().toString().padStart(2,'0'); const mm=d.getMinutes().toString().padStart(2,'0'); return `${y}-${m}-${day}T${hh}:${mm}` }

// Downloads for PWA files from in-app (client-side generated)
function downloadManifest(){ const manifest = {"name":"Family Appointment Manager","short_name":"FAM","start_url":"/","display":"standalone","background_color":"#0f172a","theme_color":"#0f172a","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png"}]}; trigger('manifest.webmanifest', new Blob([JSON.stringify(manifest,null,2)],{type:'application/manifest+json'})) }
function downloadSW(){ const sw = `const CACHE='fam-cache-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/manifest.webmanifest','/icon-192.png','/icon-512.png'])));self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;})));});`; trigger('sw.js', new Blob([sw],{type:'text/javascript'})) }
function downloadIcon(size:number){ const canvas=document.createElement('canvas'); canvas.width=canvas.height=size; const ctx=canvas.getContext('2d')!; ctx.fillStyle='#0f172a'; ctx.fillRect(0,0,size,size); ctx.fillStyle='#fff'; ctx.font=`${Math.floor(size*0.28)}px sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('FAM', size/2, size/2); canvas.toBlob(b=>{ if(b) trigger(`icon-${size}.png`, b) }, 'image/png') }
function trigger(name:string, blob:Blob){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url) }

// Example snippet for docs tab
const exampleRegisterSnippet = `// Add to your app bootstrap
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(r => console.log('SW registered', r))
      .catch(e => console.error('SW failed', e));
  });
}`

// Minimal tests
function runTests(setOutput:(s:string)=>void){
  const logs:string[] = []; let passed=0, failed=0
  function assert(name:string, cond:boolean){ if(cond){ passed++; logs.push('✓ '+name) } else { failed++; logs.push('✗ '+name) } }
  const d = new Date(Date.UTC(2025,0,2,3,4,5))
  assert('toUTC formats', toUTC(d) === '20250102T030405Z')
  const appt: Appt = { id:'t1', title:'Wellness Check', people:['Samara'], category:'Doctor', provider:'Dr. Example', location:'Allegro Pediatrics, Redmond', start:new Date('2025-12-12T16:30:00-08:00').toISOString(), end:new Date('2025-12-12T16:50:00-08:00').toISOString(), telehealth:false, reminderMins:60, notes:'Bring records' }
  const ics = buildICS([appt])
  assert('ICS has SUMMARY', /SUMMARY:Wellness Check/.test(ics))
  const parsed = parseICS(ics)
  assert('Round-trip 1 event', parsed.length===1)
  assert('Parsed title ok', parsed[0].title==='Wellness Check')
  setOutput([...logs, '', `Passed: ${passed}, Failed: ${failed}`].join('\\n'))
}

function makeId(){
  const globalCrypto = typeof crypto !== 'undefined' ? crypto : (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined)
  if(globalCrypto?.randomUUID){
    return globalCrypto.randomUUID()
  }
  if(globalCrypto?.getRandomValues){
    const bytes = new Uint8Array(16)
    globalCrypto.getRandomValues(bytes)
    return Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('')
  }
  return Math.random().toString(36).slice(2, 10)
}

function colorForCategory(category:string){
  const key = category.toLowerCase()
  if(categoryColorCache.has(key)) return categoryColorCache.get(key)!
  const hash = Math.abs(hashString(key))
  const color = COLOR_PALETTE[hash % COLOR_PALETTE.length]
  categoryColorCache.set(key, color)
  return color
}

function hashString(value:string){
  let hash = 0
  for(let i=0; i<value.length; i++){
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0
  }
  return hash
}

function base64Encode(str:string){
  if(typeof btoa === 'function'){
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    bytes.forEach(b => { binary += String.fromCharCode(b) })
    return btoa(binary)
  }
  const NodeBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined
  if(NodeBuffer){
    return NodeBuffer.from(str, 'utf-8').toString('base64')
  }
  return str
}

function base64Decode(base64:string){
  if(typeof atob === 'function'){
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  }
  const NodeBuffer = typeof globalThis !== 'undefined' ? (globalThis as any).Buffer : undefined
  if(NodeBuffer){
    return NodeBuffer.from(base64, 'base64').toString('utf-8')
  }
  return base64
}

function encodeSharePayload(payload: SharePayload){
  return base64Encode(JSON.stringify(payload))
}

function decodeSharePayload(encoded:string): SharePayload | null {
  try {
    const json = base64Decode(encoded)
    const raw = JSON.parse(json)
    return sanitizeSharePayload(raw)
  } catch {
    return null
  }
}

function sanitizeSharePayload(raw:any): SharePayload | null {
  if(!raw || typeof raw !== 'object') return null
  if(raw.version !== 1) return null
  const people = Array.isArray(raw.people) ? raw.people.filter(isNonEmptyString) : []
  const categories = Array.isArray(raw.categories) ? raw.categories.filter(isNonEmptyString) : []
  const apptsInput = Array.isArray(raw.appts) ? raw.appts : []
  const appts: Appt[] = []
  for (const item of apptsInput) {
    if(!item || typeof item !== 'object') continue
    const startValue = typeof item.start === 'string' && item.start ? item.start : ''
    const endValue = typeof item.end === 'string' && item.end ? item.end : startValue
    if(!startValue) continue
    appts.push({
      id: isNonEmptyString(item.id) ? item.id : makeId(),
      title: isNonEmptyString(item.title) ? item.title : 'Appointment',
      people: Array.isArray(item.people) ? item.people.filter(isNonEmptyString) : [],
      category: isNonEmptyString(item.category) ? item.category : 'Other',
      provider: typeof item.provider === 'string' ? item.provider : '',
      location: typeof item.location === 'string' ? item.location : '',
      telehealth: !!item.telehealth,
      start: normalizeISO(startValue),
      end: normalizeISO(endValue),
      reminderMins: typeof item.reminderMins === 'number' ? item.reminderMins : null,
      notes: typeof item.notes === 'string' ? item.notes : '',
    })
  }
  return { version: 1, people, categories, appts }
}

function isNonEmptyString(val:any): val is string {
  return typeof val === 'string' && val.trim().length > 0
}

function createSampleAppointments(): Appt[] {
  function eventIn(days:number, hour:number, minute:number, durationMinutes:number, partial: Partial<Appt>): Appt {
    const start = new Date()
    start.setHours(hour, minute, 0, 0)
    start.setDate(start.getDate() + days)
    const end = new Date(start.getTime() + durationMinutes * 60000)
    return {
      id: makeId(),
      title: partial.title || 'Appointment',
      people: partial.people ? [...partial.people] : [],
      category: partial.category || 'Other',
      provider: partial.provider || '',
      location: partial.location || '',
      telehealth: partial.telehealth ?? false,
      start: start.toISOString(),
      end: end.toISOString(),
      reminderMins: partial.reminderMins ?? 90,
      notes: partial.notes || ''
    }
  }
  return [
    eventIn(2, 9, 30, 45, { title:'Samara — Dental cleaning', people:['Samara'], category:'Dentist', provider:'Dr. Chen', location:'Bright Smiles Clinic', notes:'Arrive 15 min early for paperwork.' }),
    eventIn(5, 15, 0, 60, { title:'Family vaccine boosters', people:DEFAULT_PEOPLE, category:'Doctor', provider:'Nurse Patel', location:'Evergreen Clinic', reminderMins:120, notes:'Bring vaccine cards & insurance IDs.' }),
    eventIn(9, 8, 0, 30, { title:'Samar — Parent teacher conference', people:['Piyush','Samar'], category:'School', location:'Northshore Elementary, Room 204', notes:'Meet Ms. Diaz; review progress sheet.' })
  ]
}

function createDraft(people:string[], categories:string[]): Appt {
  const start = new Date()
  start.setMinutes(0,0,0)
  start.setHours(start.getHours()+1)
  const end = new Date(start.getTime() + 60*60000)
  return {
    id: makeId(),
    title: 'Doctor visit',
    people: [people[0] ?? DEFAULT_PEOPLE[0]],
    category: categories[0] ?? DEFAULT_CATEGORIES[0],
    provider: '',
    location: '',
    start: start.toISOString(),
    end: end.toISOString(),
    telehealth: false,
    reminderMins: 90,
    notes: ''
  }
}

function formatPeopleList(list:string[]): string {
  if(list.length === 0) return 'the whole family'
  if(list.length === 1) return list[0]
  if(list.length === 2) return `${list[0]} & ${list[1]}`
  if(list.length === 3) return `${list[0]}, ${list[1]} & ${list[2]}`
  return `${list[0]}, ${list[1]} & ${list.length - 2} more`
}
