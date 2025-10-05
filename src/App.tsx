
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

const DEFAULT_PEOPLE = ['Piyush', 'Prisha', 'Samara', 'Samar']
const DEFAULT_CATEGORIES = ['Doctor', 'Dentist', 'School', 'Work', 'Travel', 'Other']

export default function App() {
  const [tab, setTab] = useState<'list'|'settings'|'pwa'|'tests'>('list')
  const [people, setPeople] = useState<string[]>(() => JSON.parse(localStorage.getItem('fam.people') || 'null') ?? DEFAULT_PEOPLE)
  const [categories, setCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem('fam.categories') || 'null') ?? DEFAULT_CATEGORIES)
  const [appts, setAppts] = useState<Appt[]>(() => JSON.parse(localStorage.getItem('fam.appts') || 'null') ?? [])
  const [query, setQuery] = useState('')
  const [filterPerson, setFilterPerson] = useState<string | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all')
  const [showPast, setShowPast] = useState(false)
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const [testOutput, setTestOutput] = useState('')

  useEffect(()=>{ localStorage.setItem('fam.people', JSON.stringify(people)) },[people])
  useEffect(()=>{ localStorage.setItem('fam.categories', JSON.stringify(categories)) },[categories])
  useEffect(()=>{ localStorage.setItem('fam.appts', JSON.stringify(appts)) },[appts])

  const filtered = useMemo(()=>{
    const now = new Date()
    return appts
      .filter(a => showPast || new Date(a.start) >= new Date(now.getTime() - 12*60*60*1000))
      .filter(a => filterPerson === 'all' ? true : a.people.includes(filterPerson))
      .filter(a => filterCategory === 'all' ? true : a.category === filterCategory)
      .filter(a => [a.title, a.location, a.provider, a.notes].join(' ').toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=> new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [appts, query, filterPerson, filterCategory, showPast])

  function addAppt(a: Appt){ setAppts(p=>[...p,a]) }
  function updateAppt(id: string, patch: Partial<Appt>){ setAppts(p=>p.map(a=>a.id===id?{...a,...patch}:a)) }
  function deleteAppt(id: string){ setAppts(p=>p.filter(a=>a.id!==id)); setSelection(s=>{ const n={...s}; delete n[id]; return n }) }
  function toggleAll(select:boolean){ const next: Record<string, boolean> = {}; filtered.forEach(a=>next[a.id]=select); setSelection(next) }

  function exportICS(selectedOnly=false){
    const items = (selectedOnly ? filtered.filter(a => selection[a.id]) : filtered)
    const ics = buildICS(items)
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `family-appointments-${new Date().toISOString().slice(0,10)}.ics`
    a.click(); URL.revokeObjectURL(url)
  }
  async function importICS(file: File){
    const text = await file.text()
    const imported = parseICS(text)
    if(imported.length) setAppts(p=>[...p, ...imported])
  }

  return (
    <div className="container">
      <header>
        <h1>Family Appointment Manager</h1>
        <div className="toolbar">
          <label className="btn" title="Import .ics">
            <input type="file" accept=".ics,text/calendar" hidden onChange={async (e)=>{
              const f = e.currentTarget.files?.[0]; if(!f) return; await importICS(f); e.currentTarget.value=''
            }} />
            Import .ics
          </label>
          <button className="btn" onClick={()=>exportICS(false)}>Export all</button>
          <button className="btn" onClick={()=>exportICS(true)} disabled={!Object.values(selection).some(Boolean)}>Export selected</button>
          <button className="primary" onClick={()=>setTab('list')}>Add appointment</button>
        </div>
      </header>

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

          <AddForm people={people} categories={categories} onAdd={addAppt} onNewCategory={(c)=>setCategories(p=>Array.from(new Set([...p, c])))} />

          <div className="list">
            {filtered.length===0 && <p className="muted">No appointments match your filters. Add one above.</p>}
            {filtered.map(a => (
              <ApptRow key={a.id} a={a} selected={!!selection[a.id]}
                onSelect={(v)=>setSelection(s=>({...s, [a.id]: v}))}
                onUpdate={(patch)=>updateAppt(a.id, patch)}
                onDelete={()=>deleteAppt(a.id)} />
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
    </div>
  )
}

function AddForm({ people, categories, onAdd, onNewCategory }:{ people:string[]; categories:string[]; onAdd:(a:Appt)=>void; onNewCategory:(c:string)=>void }){
  const [draft, setDraft] = useState<Appt>(()=>({ id: crypto.randomUUID(), title:'Doctor visit', people:[people[0] ?? 'Piyush'], category: categories[0] ?? 'Doctor', provider:'', location:'', start:new Date(Date.now()+60*60*1000).toISOString().slice(0,16), end:new Date(Date.now()+90*60*1000).toISOString().slice(0,16), telehealth:false, reminderMins:90, notes:'' }))
  const [newCat, setNewCat] = useState('')
  function save(){
    const payload = { ...draft, id: crypto.randomUUID(), start: normalizeISO(draft.start), end: normalizeISO(draft.end) }
    onAdd(payload)
    // Reset with same defaults
    setDraft({...draft, id: crypto.randomUUID()})
  }
  return (
    <div className="card"><div className="content">
      <h3>Add appointment</h3>
      <div className="row">
        <div>
          <label>Title</label>
          <input value={draft.title} onChange={e=>setDraft({...draft, title:e.target.value})} placeholder="e.g., Pediatric checkup" />
        </div>
        <div>
          <label>Category</label>
          <div style={{display:'flex', gap:8}}>
            <select value={draft.category} onChange={e=>setDraft({...draft, category:e.target.value})}>
              {categories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="New…" value={newCat} onChange={e=>setNewCat(e.target.value)} style={{width:120}} />
            <button className="btn" onClick={()=>{ if(newCat.trim()){ onNewCategory(newCat.trim()); setDraft({...draft, category:newCat.trim()}); setNewCat('') }}}>Add</button>
          </div>
        </div>
        <div>
          <label>People</label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {people.map(p => (
              <label key={p} className="pill">
                <input type="checkbox" checked={draft.people.includes(p)} onChange={e=>{
                  const next = e.target.checked ? Array.from(new Set([...draft.people, p])) : draft.people.filter(x=>x!==p)
                  setDraft({...draft, people: next})
                }} />
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
          <input type="datetime-local" value={toLocalInputValue(draft.start)} onChange={e=>setDraft({...draft, start:e.target.value})} />
        </div>
        <div>
          <label>End</label>
          <input type="datetime-local" value={toLocalInputValue(draft.end)} onChange={e=>setDraft({...draft, end:e.target.value})} />
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <input id="tele" type="checkbox" checked={!!draft.telehealth} onChange={e=>setDraft({...draft, telehealth:e.target.checked})} /><label htmlFor="tele">Telehealth</label>
        </div>
        <div>
          <label>Reminder (minutes before)</label>
          <input type="number" min={0} step={5} value={draft.reminderMins ?? ''} onChange={e=>setDraft({...draft, reminderMins: e.target.value===''? null : Number(e.target.value)})} placeholder="e.g., 90" />
        </div>
        <div style={{gridColumn:'1/3'}}>
          <label>Notes</label>
          <textarea value={draft.notes || ''} onChange={e=>setDraft({...draft, notes:e.target.value})} placeholder="Bring insurance card, vaccine record…" />
        </div>
      </div>
      <div className="actions" style={{marginTop:12}}>
        <button className="primary" onClick={save}>Add</button>
      </div>
    </div></div>
  )
}

function ApptRow({ a, selected, onSelect, onUpdate, onDelete }:{ a:Appt; selected:boolean; onSelect:(v:boolean)=>void; onUpdate:(p:Partial<Appt>)=>void; onDelete:()=>void }){
  const start = new Date(a.start)
  const end = new Date(a.end)
  function copySummary(){
    const text = `${a.title} — ${start.toLocaleString()} to ${end.toLocaleTimeString()}\nPeople: ${a.people.join(', ')}\nPlace: ${a.location || ''}\nProvider: ${a.provider || ''}\nNotes: ${a.notes || ''}`.trim()
    navigator.clipboard.writeText(text)
  }
  return (
    <div className="card"><div className="content">
      <div className="actions" style={{justifyContent:'space-between'}}>
        <label className="pill"><input type="checkbox" checked={selected} onChange={e=>onSelect(e.target.checked)} /> Select</label>
        <div className="actions">
          <button className="btn" onClick={copySummary}>Copy</button>
          <button className="btn" onClick={onDelete}>Delete</button>
        </div>
      </div>
      <div style={{marginTop:8}}>
        <div style={{fontWeight:600}}>{a.title}</div>
        <div className="muted">{start.toLocaleString()} → {end.toLocaleTimeString()}</div>
        <div>People: <span className="muted">{a.people.join(', ')}</span></div>
        <div>Category: <span className="muted">{a.category}</span>{a.telehealth ? <span className="pill" style={{marginLeft:8}}>Telehealth</span> : null}</div>
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
    const uid = a.id || crypto.randomUUID()
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
    out.push({ id: crypto.randomUUID(), title: (SUMMARY || "Appointment"), people, category:'Imported', provider, location:(LOCATION || ""), start: start.toISOString(), end: end.toISOString(), telehealth:false, reminderMins:null, notes })
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
