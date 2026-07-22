'use client';

import { Bot, CalendarSearch, Check, ChevronDown, Copy, MessageSquarePlus, RotateCcw, Send, Sparkles, Square, X } from 'lucide-react';
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type Message = { id: string; role: 'user' | 'assistant'; content: string; createdAt?: number };

const starters = [
  "Show today's lessons.",
  'Who is unavailable tomorrow?',
  'Find open replacement tasks.',
  'Check timetable clashes this week.',
  'Give me an operations summary.',
];

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }

function inlineFormat(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function RichMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];

  const flush = () => {
    if (bullets.length) { blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}</ul>); bullets = []; }
    if (numbers.length) { blocks.push(<ol key={`ol-${blocks.length}`}>{numbers.map((item, i) => <li key={i}>{inlineFormat(item)}</li>)}</ol>); numbers = []; }
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) { flush(); return; }
    if (/^[-•]\s+/.test(line)) { bullets.push(line.replace(/^[-•]\s+/, '')); return; }
    if (/^\d+[.)]\s+/.test(line)) { numbers.push(line.replace(/^\d+[.)]\s+/, '')); return; }
    flush();
    if (/^#{1,3}\s+/.test(line)) blocks.push(<h4 key={index}>{inlineFormat(line.replace(/^#{1,3}\s+/, ''))}</h4>);
    else if (/^(Summary|Recommendation|Immediate recommendation|Current lesson records|Other possible replacements|Filters checked|Result|Warning)\b/i.test(line)) blocks.push(<h4 key={index}>{inlineFormat(line)}</h4>);
    else if (/^```/.test(line)) return;
    else blocks.push(<p key={index}>{inlineFormat(line)}</p>);
  });
  flush();
  return <>{blocks}</>;
}

function suggestionsFor(messages: Message[]) {
  const last = [...messages].reverse().find((message) => message.role === 'assistant' && message.content)?.content.toLowerCase() ?? '';
  if (last.includes('replacement') || last.includes('cover')) return ['Show the best replacement only.', 'Check their availability.', 'Show the affected lessons.'];
  if (last.includes('clash') || last.includes('conflict') || last.includes('overlap')) return ['Show only serious clashes.', 'Who can cover them?', 'Open this week instead.'];
  if (last.includes('teacher')) return ["Show today's lessons.", 'Who is free tomorrow?', 'Compare teacher workloads.'];
  if (last.includes('school')) return ['Show lessons at the first school.', 'Which teachers work there?', 'Show this week only.'];
  if (last.includes('lesson')) return ['Group them by teacher.', 'Check for clashes.', 'Show the next 7 days.'];
  return ['Summarise this.', 'What needs attention?', 'What should I do next?'];
}

export default function CalendarAiAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'assistant', createdAt: Date.now(), content: 'Hi! I’m Calendar AI. I can search lessons, teachers, availability, leave, unable-to-attend requests, replacement tasks and timetable clashes.' }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const followUps = useMemo(() => suggestionsFor(messages), [messages]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => { const saved = window.sessionStorage.getItem('calendar-ai-messages'); if (!saved) return; try { const parsed = JSON.parse(saved) as Message[]; if (Array.isArray(parsed) && parsed.length) setMessages(parsed.slice(-40)); } catch {} }, []);
  useEffect(() => { window.sessionStorage.setItem('calendar-ai-messages', JSON.stringify(messages.slice(-40))); }, [messages]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 180); }, [open]);
  useEffect(() => { if (!inputRef.current) return; inputRef.current.style.height = 'auto'; inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`; }, [input]);

  if (!pathname.startsWith('/admin')) return null;

  const resetChat = () => { abortRef.current?.abort(); setLoading(false); setMessages([{ id: 'welcome', role: 'assistant', createdAt: Date.now(), content: 'New conversation started. Ask me about the live MOE calendar.' }]); setInput(''); };
  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setLoading(false); };
  const copyMessage = async (message: Message) => { await navigator.clipboard.writeText(message.content); setCopiedId(message.id); window.setTimeout(() => setCopiedId(null), 1400); };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const userMessage: Message = { id: newId(), role: 'user', content, createdAt: Date.now() };
    const assistantId = newId();
    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }]); setInput(''); setLoading(true);
    const controller = new AbortController(); abortRef.current = controller;

    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ messages: nextMessages.map(({ role, content: messageContent }) => ({ role, content: messageContent })) }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'The AI request failed.'); }
      if (!response.body) throw new Error('No response stream was returned.');
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let accumulated = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; accumulated += decoder.decode(value, { stream: true }); setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: accumulated } : message)); }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { const errorMessage = error instanceof Error ? error.message : 'Something went wrong.'; setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: `I couldn’t connect: ${errorMessage}` } : message)); }
      else setMessages((current) => current.map((message) => message.id === assistantId && !message.content ? { ...message, content: 'Response stopped.' } : message));
    } finally { abortRef.current = null; setLoading(false); }
  };

  const retryLast = () => { if (!loading) void send('Please retry your previous answer, using the live calendar tools again.'); };
  const submit = (event: FormEvent) => { event.preventDefault(); void send(); };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } };

  return <div className={open ? 'calendarAi open' : 'calendarAi'}>
    {open && <button className="calendarAiBackdrop" aria-label="Close Calendar AI" onClick={() => setOpen(false)} />}
    <aside className="calendarAiPanel" aria-hidden={!open} aria-label="Calendar AI assistant">
      <header className="calendarAiHeader"><div className="calendarAiIdentity"><div className="calendarAiLogo"><Sparkles size={19}/></div><div><strong>Calendar AI</strong><span><i/> Live calendar connected</span></div></div><div className="calendarAiHeaderActions"><button onClick={resetChat} title="New chat"><MessageSquarePlus size={18}/></button><button onClick={() => setOpen(false)} title="Close"><X size={19}/></button></div></header>
      <div className="calendarAiNotice"><CalendarSearch size={16}/><span>Read-only AI analysis. It can detect schedules, availability, replacements and clashes without changing records.</span></div>
      <div className="calendarAiMessages" ref={scrollRef}>
        {messages.map((message, index) => <div key={message.id} className={`calendarAiMessage ${message.role}`}>
          {message.role === 'assistant' && <div className="calendarAiAvatar"><Bot size={16}/></div>}
          <div className="calendarAiMessageBody"><div className="calendarAiBubble">{message.content ? <RichMessage content={message.content}/> : loading && index === messages.length - 1 ? <span className="calendarAiTyping"><i/><i/><i/></span> : null}</div>
            {message.role === 'assistant' && message.content && <div className="messageTools"><button onClick={() => void copyMessage(message)}>{copiedId === message.id ? <Check size={13}/> : <Copy size={13}/>} {copiedId === message.id ? 'Copied' : 'Copy'}</button>{index === messages.length - 1 && index > 1 && <button onClick={retryLast}><RotateCcw size={13}/> Retry</button>}</div>}
          </div>
        </div>)}
        {messages.length === 1 && <div className="calendarAiStarters"><span>QUICK ACTIONS</span>{starters.map((starter) => <button key={starter} onClick={() => void send(starter)}>{starter}</button>)}</div>}
        {messages.length > 1 && !loading && <div className="calendarAiFollowups"><span>SUGGESTED FOLLOW-UPS</span><div>{followUps.map((item) => <button key={item} onClick={() => void send(item)}>{item}</button>)}</div></div>}
      </div>
      <form className="calendarAiComposer" onSubmit={submit}><textarea ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={keyDown} placeholder="Message Calendar AI…" rows={1} maxLength={4000} disabled={loading}/>{loading ? <button type="button" onClick={stop} aria-label="Stop response"><Square size={15}/></button> : <button type="submit" disabled={!input.trim()} aria-label="Send message"><Send size={17}/></button>}<small>Calendar data is checked live · Enter to send</small></form>
    </aside>
    <button className="calendarAiTrigger" onClick={() => setOpen((value) => !value)} aria-expanded={open}><div><Sparkles size={18}/></div><span>{open ? 'Close AI' : 'Ask Calendar'}</span>{open && <ChevronDown size={17}/>}</button>
    <style jsx global>{`
      .calendarAi{position:fixed;right:20px;bottom:78px;z-index:4300;display:grid;justify-items:end;pointer-events:none}.calendarAiTrigger,.calendarAiPanel{pointer-events:auto}.calendarAiTrigger{height:48px;display:flex;align-items:center;gap:9px;padding:0 15px 0 8px;border:1px solid rgba(255,255,255,.17);border-radius:15px;background:linear-gradient(135deg,#111a31,#15112c);color:#fff;font-weight:850;box-shadow:0 18px 50px rgba(0,0,0,.36);transition:.18s ease}.calendarAiTrigger:hover{transform:translateY(-2px);border-color:rgba(167,139,250,.5)}.calendarAiTrigger>div{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:linear-gradient(135deg,#7857ff,#2ed4c7)}
      .calendarAiPanel{position:fixed;top:14px;right:14px;bottom:14px;width:min(480px,calc(100vw - 28px));display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;border:1px solid rgba(148,163,184,.17);border-radius:22px;background:linear-gradient(160deg,rgba(15,22,42,.99),rgba(7,11,22,.99));box-shadow:0 30px 100px rgba(0,0,0,.58);backdrop-filter:blur(28px);overflow:hidden;transform:translateX(calc(100% + 35px));opacity:0;visibility:hidden;transition:.24s ease}.calendarAi.open .calendarAiPanel{transform:none;opacity:1;visibility:visible}.calendarAiBackdrop{position:fixed;inset:0;border:0;background:rgba(2,6,16,.38);backdrop-filter:blur(2px);pointer-events:auto}
      .calendarAiHeader{display:flex;align-items:center;justify-content:space-between;padding:17px;border-bottom:1px solid rgba(148,163,184,.1)}.calendarAiIdentity{display:flex;align-items:center;gap:11px}.calendarAiLogo{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(135deg,#7857ff,#2ed4c7)}.calendarAiIdentity>div:last-child{display:grid;gap:3px}.calendarAiIdentity strong{font-size:15px}.calendarAiIdentity span{display:flex;align-items:center;gap:6px;color:#8e9ab1;font-size:10px}.calendarAiIdentity i{width:7px;height:7px;border-radius:50%;background:#34d399}.calendarAiHeaderActions{display:flex;gap:6px}.calendarAiHeaderActions button{width:35px;height:35px;display:grid;place-items:center;border:0;border-radius:10px;background:rgba(148,163,184,.08);color:#9ca8bc}.calendarAiNotice{display:flex;gap:8px;align-items:center;margin:12px 14px 0;padding:10px 11px;border:1px solid rgba(45,212,199,.16);border-radius:11px;background:rgba(45,212,199,.06);color:#9fb8bb;font-size:11px;line-height:1.4}
      .calendarAiMessages{min-height:0;overflow-y:auto;padding:17px 14px 22px;scrollbar-width:thin;scrollbar-color:#28334c transparent}.calendarAiMessage{display:flex;gap:8px;margin-bottom:16px}.calendarAiMessage.user{justify-content:flex-end}.calendarAiAvatar{flex:0 0 30px;width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:linear-gradient(145deg,#242047,#17233a);color:#b8adff}.calendarAiMessageBody{max-width:88%}.calendarAiBubble{padding:12px 14px;border:1px solid rgba(148,163,184,.11);border-radius:6px 15px 15px 15px;background:#111a2d;color:#dce4f2;font-size:13px;line-height:1.58;overflow-wrap:anywhere}.calendarAiBubble p{margin:0 0 9px}.calendarAiBubble p:last-child{margin-bottom:0}.calendarAiBubble h4{margin:11px 0 6px;color:#fff;font-size:13px}.calendarAiBubble ul,.calendarAiBubble ol{margin:5px 0 10px;padding-left:20px}.calendarAiBubble li{margin:4px 0}.calendarAiBubble code{padding:2px 5px;border-radius:5px;background:#08101f;color:#c7bcff}.calendarAiMessage.user .calendarAiBubble{border-color:rgba(124,92,255,.24);border-radius:15px 6px 15px 15px;background:linear-gradient(135deg,rgba(108,86,232,.92),rgba(76,61,178,.92));color:#fff}.messageTools{display:flex;gap:5px;margin-top:5px}.messageTools button{display:flex;gap:4px;align-items:center;padding:4px 7px;border:0;border-radius:7px;background:transparent;color:#64728a;font-size:9px}.messageTools button:hover{background:rgba(148,163,184,.08);color:#bdc7d8}
      .calendarAiTyping{height:18px;display:flex;align-items:center;gap:4px}.calendarAiTyping i{width:5px;height:5px;border-radius:50%;background:#9aa6bb;animation:calendarAiPulse 1s infinite ease-in-out}.calendarAiTyping i:nth-child(2){animation-delay:.14s}.calendarAiTyping i:nth-child(3){animation-delay:.28s}@keyframes calendarAiPulse{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
      .calendarAiStarters,.calendarAiFollowups{display:grid;gap:7px;margin:5px 0 0 38px}.calendarAiStarters>span,.calendarAiFollowups>span{color:#66748e;font-size:9px;font-weight:900;letter-spacing:.14em}.calendarAiStarters button,.calendarAiFollowups button{padding:9px 11px;border:1px solid rgba(148,163,184,.12);border-radius:10px;background:rgba(148,163,184,.05);color:#aeb9cb;text-align:left;font-size:11px}.calendarAiFollowups>div{display:flex;gap:6px;flex-wrap:wrap}.calendarAiFollowups button{padding:7px 9px}.calendarAiStarters button:hover,.calendarAiFollowups button:hover{border-color:rgba(124,92,255,.35);background:rgba(124,92,255,.08);color:#fff}
      .calendarAiComposer{position:relative;padding:13px 14px 29px;border-top:1px solid rgba(148,163,184,.1);background:rgba(7,11,22,.72)}.calendarAiComposer textarea{width:100%;min-height:50px;max-height:150px;padding:14px 52px 14px 14px;border:1px solid rgba(148,163,184,.16);border-radius:14px;outline:0;resize:none;overflow-y:auto;background:#0c1426;color:#fff;line-height:1.4}.calendarAiComposer textarea:focus{border-color:#7463e8;box-shadow:0 0 0 3px rgba(116,99,232,.12)}.calendarAiComposer>button{position:absolute;right:23px;top:22px;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:10px;background:linear-gradient(135deg,#7058eb,#4e3ebd);color:#fff}.calendarAiComposer>button:disabled{opacity:.35}.calendarAiComposer small{position:absolute;left:18px;bottom:9px;color:#59667d;font-size:9px}@media(max-width:900px){.calendarAi{right:14px;bottom:72px}.calendarAiPanel{top:70px;right:8px;bottom:8px;width:calc(100vw - 16px);border-radius:18px}.calendarAiBackdrop{top:62px}}
    `}</style>
  </div>;
}
