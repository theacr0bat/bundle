'use client';
import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, ArrowRight, Check, X, Globe2, FlaskConical, Landmark, Music2, Trophy, HelpCircle, RotateCcw, Share2, Target, ChevronLeft, Clock3, Users, Sparkles, LockKeyhole, Volume2, VolumeX, Flame } from 'lucide-react';
import type { Question } from '../lib/game';
import { basePoints, scoreBreakdown, missDistance } from '../lib/scoring';
import AnswerSweep from '../components/game/AnswerSweep';
import { openAudio, revealSound } from '../lib/audio';
import { shareText, parseChallenge, isHit, visibleCrowd } from '../lib/insights';
import type { Crowd, Me } from '../lib/insights';
import { practiceQuestions } from '../lib/practice';
import type { SavedAnswer } from '../lib/server';
type PublicQ = Omit<Question, 'answer' | 'source' | 'noteTr' | 'noteEn'>;
type Game = {
    scoreVersion: number;
    day: string;
    edition: number;
    resetAt: string;
    questions: PublicQ[];
    run: null | {
        cursor: number;
        score: number;
        completed: boolean;
        answers: SavedAnswer[];
    };
};
type Stats = {
    others: number;
    total: number;
    average: number | null;
    percentile: number | null;
    tied: number;
    score: number | null;
};
const icons = { space: Globe2, science: FlaskConical, history: Landmark, culture: Music2, sport: Trophy };
const names = { space: 'Space', science: 'Nature & Science', history: 'World & History', culture: 'Culture & Play', sport: 'Sport' };
export default function Home() {
    const [owner, setOwner] = useState(false);
    const [game, setGame] = useState<Game | null>(null);
    const [view, setView] = useState<'home' | 'game' | 'results'>('home');
    const [index, setIndex] = useState(0);
    const [low, setLow] = useState(0);
    const [high, setHigh] = useState(100);
    const [lowText, setLowText] = useState('0');
    const [highText, setHighText] = useState('100');
    const [reveal, setReveal] = useState<SavedAnswer | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [help, setHelp] = useState(false);
    const [privacy, setPrivacy] = useState(false);
    const [chosenLow, setChosenLow] = useState(false);
    const [chosenHigh, setChosenHigh] = useState(false);
    const [settled, setSettled] = useState(false);
    const [sound, setSound] = useState(true);
    const audio = useRef<AudioContext | null>(null);
    const [practice, setPractice] = useState(false);
    const [replay, setReplay] = useState(false);
    const [localQuestions, setLocalQuestions] = useState<Question[]>(practiceQuestions);
    const [dailyBackup, setDailyBackup] = useState<Game | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [me, setMe] = useState<Me | null>(null);
    const [crowd, setCrowd] = useState<Record<number, Crowd>>({});
    const [challenge, setChallenge] = useState<{
        score: number;
        edition: number;
    } | null>(null);
    const [countdown, setCountdown] = useState('—');
    const [copied, setCopied] = useState(false);
    useEffect(() => { void fetch('/api/admin?view=access', { cache: 'no-store' }).then(r => { if (r.ok)
        setOwner(true); }).catch(() => { }); }, []);
    useEffect(() => setLowText(chosenLow ? String(low) : ''), [low, chosenLow]);
    useEffect(() => setHighText(chosenHigh ? String(high) : ''), [high, chosenHigh]);
    useEffect(() => { setSound(localStorage.getItem('aralik_sound') !== 'off'); return () => { void audio.current?.close(); }; }, []);
    async function toggleSound() { const on = !sound; setSound(on); localStorage.setItem('aralik_sound', on ? 'on' : 'off'); if (!on)
        return; if (!audio.current || audio.current.state === 'closed')
        audio.current = openAudio(); const ok = await revealSound(audio.current, true, .35); if (!ok)
        setError('Audio could not start. Check device volume and browser permissions.'); }
    function resetRange(q: PublicQ) { setLow(q.min); setHigh(q.max); setChosenLow(false); setChosenHigh(false); setLowText(''); setHighText(''); setSettled(false); }
    const format = (n: number) => new Intl.NumberFormat('en-US', { useGrouping: !['year', 'years'].includes(game?.questions[index]?.unitEn || '') }).format(n);
    const pct = (n: number) => `${n}%`;
    const difficulty = (key: string) => ({ easy: 'Easy', medium: 'Medium', hard: 'Hard' }[key] || '');
    const category = (key: string) => names[key as keyof typeof names] || key;
    async function load() { setError(''); try {
        const r = await fetch('/api/game', { cache: 'no-store' });
        if (!r.ok)
            throw new Error();
        const d: Game = await r.json();
        setGame(d);
        void refreshMe();
        setReveal(null);
        setIndex(Math.min(d.run?.cursor || 0, 4));
        if (d.run?.completed)
            setView('results');
    }
    catch {
        setError('Could not load the game. Check your connection and try again.');
    } }
    useEffect(() => { const c = parseChallenge(location.search); if (c)
        setChallenge(c); load(); }, []);
    useEffect(() => { if (!game)
        return; const tick = () => { const ms = Math.max(0, Date.parse(game.resetAt) - Date.now()); const sec = Math.floor(ms / 1000); setCountdown([Math.floor(sec / 3600), Math.floor(sec % 3600 / 60), sec % 60].map(x => String(x).padStart(2, '0')).join(':')); }; tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, [game?.resetAt]);
    useEffect(() => { if (!game)
        return; const q = game.questions[index]; resetRange(q); }, [index, game?.day, game?.questions[index]?.id]);
    useEffect(() => { if (view !== 'results' || practice)
        return; refreshStats(); void refreshMe(); void refreshCrowd(); const id = setInterval(refreshStats, 30000); return () => clearInterval(id); }, [view, game?.run?.score, practice]);
    useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setHelp(false);
        setPrivacy(false);
    } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);
    async function refreshStats() { try {
        const r = await fetch('/api/stats', { cache: 'no-store' });
        if (r.ok)
            setStats(await r.json());
    }
    catch { } }
    async function refreshMe() { try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        if (r.ok)
            setMe(await r.json());
    }
    catch { } }
    async function refreshCrowd() { try {
        const r = await fetch('/api/crowd', { cache: 'no-store' });
        if (r.ok)
            setCrowd(await r.json());
    }
    catch { } }
    useEffect(() => { if (reveal && settled && !practice)
        void refreshCrowd(); }, [reveal?.index, settled]);
    function start() { if (!game)
        return; if (practice) {
        setPractice(false);
        setReplay(false);
        setCrowd({});
        setGame(dailyBackup);
        setIndex(Math.min(dailyBackup?.run?.cursor || 0, 4));
        setView(dailyBackup?.run?.completed ? 'results' : 'game');
        setReveal(null);
        if (dailyBackup)
            resetRange(dailyBackup.questions[Math.min(dailyBackup.run?.cursor || 0, 4)]);
        return;
    } setView(game.run?.completed ? 'results' : 'game'); setIndex(Math.min(game.run?.cursor || 0, 4)); setReveal(null); resetRange(game.questions[Math.min(game.run?.cursor || 0, 4)]); setError(''); }
    function startPractice() { setReplay(false); setLocalQuestions(practiceQuestions); if (!practice)
        setDailyBackup(game); setPractice(true); setStats(null); setCrowd({}); setGame({ scoreVersion: 3, day: game?.day || '', edition: game?.edition || 1, resetAt: game?.resetAt || new Date().toISOString(), questions: practiceQuestions, run: null }); setIndex(0); setReveal(null); resetRange(practiceQuestions[0]); setView('game'); setError(''); }
    async function startReplay() { setError(''); try {
        const r = await fetch('/api/replay', { cache: 'no-store' });
        if (!r.ok)
            throw new Error();
        const d = await r.json() as {
            questions: Question[];
        };
        if (!practice)
            setDailyBackup(game);
        setLocalQuestions(d.questions);
        setReplay(true);
        setPractice(true);
        setStats(null);
        setCrowd({});
        setGame(g => g ? { ...g, scoreVersion: dailyBackup?.scoreVersion ?? g.scoreVersion, questions: d.questions, run: null } : g);
        setIndex(0);
        setReveal(null);
        resetRange(d.questions[0]);
        setView('game');
    }
    catch {
        setError('Could not open the replay. Finish the daily round first.');
    } }
    function finishReveal(a: SavedAnswer) { setSettled(false); setReveal(a); if (sound) {
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.1 : 2.2;
        void revealSound(audio.current, isHit(a), duration).then(ok => { if (!ok)
            setError('Turn the sound icon off and on again to enable audio.'); });
    } }
    async function submit() { if (!game || busy || reveal || !chosenLow || !chosenHigh)
        return; if (sound) {
        if (!audio.current || audio.current.state === 'closed')
            audio.current = openAudio();
        void audio.current?.resume().catch(() => { });
    } if (practice) {
        const pq = localQuestions[index];
        const breakdown = scoreBreakdown(pq, low, high, game.scoreVersion);
        const a: SavedAnswer = { v: game.scoreVersion, base: breakdown.base, bonus: breakdown.bonus, index, id: pq.id, low, high, score: breakdown.total, answer: pq.answer, source: '', noteTr: pq.noteTr, noteEn: pq.noteEn };
        finishReveal(a);
        setGame(g => g ? { ...g, run: { cursor: index + 1, score: (g.run?.score || 0) + a.score, completed: index === 4, answers: [...(g.run?.answers || []), a] } } : g);
        return;
    } setBusy(true); setError(''); try {
        const r = await fetch('/api/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: game.day, index, low, high }) });
        const d = await r.json() as {
            error?: string;
            answer: SavedAnswer;
            cursor: number;
            score: number;
            completed: boolean;
        };
        if (!r.ok) {
            if (d.error === 'new_day')
                throw new Error('A new day has started. Refresh to play today’s game.');
            throw new Error('Could not save your answer. Your range is safe; try again.');
        }
        finishReveal(d.answer);
        setGame(g => g ? { ...g, run: { cursor: d.cursor, score: d.score, completed: d.completed, answers: [...(g.run?.answers || []).filter(a => a.index !== index), d.answer].sort((a, b) => a.index - b.index) } } : g);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function next() { if (!settled)
        return; if (index === 4)
        setView('results');
    else {
        const n = index + 1;
        const q = game!.questions[n];
        resetRange(q);
        setIndex(n);
        setReveal(null);
    } setError(''); }
    async function share() { if (!game?.run)
        return; const text = shareText({ edition: game.edition, answers: game.run.answers, total: game.run.score, percentile: stats?.percentile ?? null, streak: me?.streak || 0, url: `${window.location.origin}/?m=${game.run.score}&e=${game.edition}` }); const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2500); }; try {
        if (window.matchMedia('(pointer: coarse)').matches && navigator.share) {
            await navigator.share({ text });
            return;
        }
        await navigator.clipboard.writeText(text);
        done();
    }
    catch (e) {
        if ((e as Error).name === 'AbortError')
            return;
        try {
            await navigator.clipboard.writeText(text);
            done();
        }
        catch {
            setError('Copy the page link to share.');
        }
    } }
    const chosen = chosenLow && chosenHigh;
    const q = game?.questions[index];
    const width = q ? Math.max(0, Math.min(1, (high - low) / (q.max - q.min))) : .4;
    const potential = q ? basePoints(q, low, high, game?.scoreVersion) : 0;
    const score = game?.run?.score || 0;
    const correct = game?.run?.answers.filter(a => isHit(a)).length || 0;
    return <div className="site-shell">
  <header className="header"><a href="/" className="brand" aria-label="BOUNDLE home"><span className="brand-mark">[<i />]</span>BOUNDLE</a><div className="header-center"><span className="live-dot"/>{'YOUR DAILY KNOWLEDGE BREAK'}</div><div className="header-actions"><button className="icon-button sound-toggle" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute sound' : 'Enable sound'}>{sound ? <Volume2 size={19}/> : <VolumeX size={19}/>}</button><button className="icon-button" onClick={() => setHelp(true)} aria-label={'How to play?'}><HelpCircle size={21}/></button></div></header>
  <main>
  {view === 'home' && <>
   <section className="home-board">
    <div className="board-top"><span className="eyebrow">{'FIVE QUESTIONS. ONE DAILY ROUND.'}</span><span className="edition">#{String(game?.edition || 1).padStart(3, '0')}</span></div>
    <h1>{'Trust your mind.'}<br /><span>{'Draw your range.'}</span></h1>
    <p className="home-description">{'You don’t need the exact answer. Set two bounds. Trust what you know. The smaller your range, the bigger your score.'}</p>
    <div className="home-actions"><button className="primary" onClick={start} disabled={!game}>{game?.run?.completed ? 'Today’s result' : game?.run?.cursor ? 'Continue' : 'Play today'}<ArrowRight size={20}/></button><button className="practice-button" onClick={startPractice} disabled={!game}>{'Try the new practice round'}<ArrowUpRight size={16}/></button></div>
    {game?.scoreVersion === 2 && <p className="edition-notice">{"New scoring is live in practice. Daily play switches on 4 November at 00:00 UTC. Today’s first results keep their original rules."}</p>}
    <div className="home-extra">{!practice && challenge && game && challenge.edition === game.edition && !game.run?.completed && <p className="challenge"><Share2 size={16}/>{`A friend scored ${challenge.score} on round #${String(challenge.edition).padStart(3, '0')}. Can you beat it?`}</p>}{me && me.streak > 0 && <p className="streak"><Flame size={18}/>{`${me.streak}${me.capped ? '+' : ''}-day streak`}{!me.doneToday && <small>{'play today to keep it'}</small>}</p>}</div>
    <div className="home-meter" aria-label={'Set your own range'}><div className="meter-annotation"><span>{'DEMO · Catch the hidden number.'}</span><span>{'HOW SURE ARE YOU?'}</span></div><div className="meter-line demo" aria-hidden="true"><i className="demo-fill"/><b className="demo-bracket l">[</b><b className="demo-bracket r">]</b><span className="demo-target"><em>687</em></span></div><div className="meter-scale">{Array.from({ length: 31 }, (_, i) => <i key={i}/>)}</div><div className="meter-caption"><span>{'Think wide.'}</span><strong>{'Play narrow.'}</strong></div></div>
    <div className="home-fineprint"><span>05 {'QUESTIONS'}</span><span>~02 {'MINUTES'}</span><span>1000 {'POINTS'}</span></div>
    {error && <div className="error" role="alert">{error}<button onClick={load}>{'Try again'} ↻</button></div>}
   </section>
   <section className="daily-strip"><div className="daily-label"><span className="live-dot"/>{'ON THE TABLE TODAY'}</div><div className="categories">{Object.entries(icons).map(([key, Icon]) => <span key={key}><Icon size={15}/>{category(key)}</span>)}</div><div className="strip-reset"><Clock3 size={14}/><b>{countdown}</b></div></section>
   <section className="rules-row"><article><span>01</span><div><h2>{'Set two bounds.'}</h2><p>{'Where does the answer fall? Both bounds are yours to choose.'}</p></div></article><article><span>02</span><div><h2>{'Lock it in.'}</h2><p>{'Catch the answer to score. A tighter range earns you more.'}</p></div></article><article><span>03</span><div><h2>{'See how you did.'}</h2><p>{'Compare with everyone who played the same questions.'}</p></div></article></section>
  </>}
  {view === 'game' && q && game && <section className="game-section"><div className="game-top"><button className="text-button" onClick={() => setView('home')}><ChevronLeft size={17}/>{'Home'}</button><span className="eyebrow">{practice ? (replay ? 'DAILY ROUND · REPLAY' : 'PRACTICE · NOT RANKED') : 'DAILY ROUND'} #{String(game.edition).padStart(3, '0')}</span><span className="game-score">{score}<small> / 1000</small></span></div><div className="progress" aria-label={`${index + 1}/5`}>{game.questions.map((_, i) => <div key={i} className={i === index ? 'current' : i < index ? 'done' : ''}><span>{String(i + 1).padStart(2, '0')}</span><i /></div>)}</div>
   <div className="game-layout"><div className="question-card"><div className="question-meta"><span className={`category-tag ${q.category}`}>{(() => { const Icon = icons[q.category as keyof typeof icons]; return <Icon size={15}/>; })()}{category(q.category)}</span>{q.difficulty && <span className={`difficulty ${q.difficulty}`}>{difficulty(q.difficulty)}</span>}<span className="eyebrow">{'QUESTION'} {index + 1} / 5</span></div><h1 className="question-title">{q.en}</h1><p className="question-hint">{'Find the smallest range that contains the answer.'}</p>
   <div className="range-numbers"><label><span>{'LOWER BOUND'}</span><input type="number" aria-label={'Lower bound'} min={q.min} max={high} step="1" value={lowText} placeholder="—" disabled={!!reveal || busy} onBlur={() => setLowText(chosenLow ? String(low) : '')} onChange={e => { setLowText(e.target.value); const n = e.target.valueAsNumber; if (Number.isSafeInteger(n) && n >= q.min && n <= high) {
            setLow(n);
            setChosenLow(true);
        }
        else
            setChosenLow(false); }}/></label><span className="number-dash">—</span><label><span>{'UPPER BOUND'}</span><input type="number" aria-label={'Upper bound'} min={low} max={q.max} step="1" value={highText} placeholder="—" disabled={!!reveal || busy} onBlur={() => setHighText(chosenHigh ? String(high) : '')} onChange={e => { setHighText(e.target.value); const n = e.target.valueAsNumber; if (Number.isSafeInteger(n) && n <= q.max && n >= low) {
            setHigh(n);
            setChosenHigh(true);
        }
        else
            setChosenHigh(false); }}/></label></div><div className="range-unit">{q.unitEn}</div>
   <div className={`slider-wrap ${reveal ? 'is-revealed' : ''} ${chosen ? 'has-range' : 'no-range'} ${settled ? 'is-settled' : ''}`}><div className="range-base"/><div className="range-fill" style={{ left: `${100 * (low - q.min) / (q.max - q.min)}%`, width: `${100 * width}%` }}/><div className="slider-ticks">{Array.from({ length: 41 }, (_, i) => <i key={i}/>)}</div><input type="range" className="range-input low" aria-label={'Drag lower bound'} min={q.min} max={q.max} step="1" value={low} disabled={!!reveal || busy} style={{ zIndex: low > q.min + (q.max - q.min) * .8 ? 5 : 3 }} onChange={e => { setLow(Math.min(high, Number(e.target.value))); setChosenLow(true); }}/><input type="range" className="range-input high" aria-label={'Drag upper bound'} min={q.min} max={q.max} step="1" value={high} disabled={!!reveal || busy} onChange={e => { setHigh(Math.max(low, Number(e.target.value))); setChosenHigh(true); }}/>{reveal && <AnswerSweep key={q.id} min={q.min} max={q.max} answer={reveal.answer} hit={isHit(reveal)} onComplete={() => setSettled(true)}/>} {reveal && settled && <div className={`true-marker ${isHit(reveal) ? 'hit' : 'miss'}`} style={{ left: `${100 * (reveal.answer - q.min) / (q.max - q.min)}%` }}><span>{format(reveal.answer)}</span><i /></div>}</div><div className="slider-labels"><span>{format(q.min)}</span><span>{format(q.max)}</span></div>{reveal && settled && visibleCrowd(crowd, practice, index) && <div className="crowd"><div className="crowd-strip" aria-hidden="true">{crowd[index].bins.map((b, i) => <i key={i} style={{ opacity: Math.max(.07, b) }}/>)}<span className="crowd-answer" style={{ left: `${100 * (reveal.answer - q.min) / (q.max - q.min)}%` }}/></div><p className="crowd-note"><Users size={14}/>{`${pct(Math.round(100 * crowd[index].hits / crowd[index].n))} of ${crowd[index].n} other players caught this one. Brighter red = where most ranges overlapped.`}</p></div>}
   {!reveal ? <><div className="potential"><span><Target size={16}/>{(game.scoreVersion === 2 ? 'Previous round · base score' : 'If the answer is in this range')}</span><strong>{chosen ? `+${potential}` : '—'} <small>{'pts'}</small></strong></div><button className="primary lock-button" onClick={submit} disabled={busy || !chosen || low < q.min || high > q.max || low > high}>{busy ? 'Saving…' : !chosen ? 'Choose both bounds first' : 'Lock my range'}<LockKeyhole size={18}/></button><p className="lock-note">{'Bounds are inclusive. Your answer is final once locked.'}</p></> : <div className={`reveal ${isHit(reveal) ? 'success' : 'missed'} ${settled ? 'revealed' : 'revealing'}`} aria-live="polite"><div className="reveal-heading"><span className="reveal-icon">{isHit(reveal) ? <Check size={22}/> : <X size={22}/>}</span><div><h3>{isHit(reveal) ? 'You caught it!' : 'Outside your range.'}</h3><p>{'The answer'} <strong>{format(reveal.answer)}</strong> {q.unitEn}</p></div><strong className="earned">+{reveal.score}</strong></div>{settled && reveal.bonus === 40 && <div className="precision-bonus">+40 · {'±5% PRECISION BONUS'}</div>}{settled && !isHit(reveal) && <p className="miss-distance">{reveal.answer < reveal.low ? `Your lower bound was ${format(missDistance(reveal))} ${q.unitEn} above the answer.` : `Your upper bound was ${format(missDistance(reveal))} ${q.unitEn} below the answer.`}</p>}<p className="answer-note">{reveal.noteEn} </p><button className="primary lock-button" onClick={next} disabled={!settled}>{index === 4 ? 'See my results' : 'Next question'}<ArrowRight size={19}/></button></div>}
   {error && <p className="error" role="alert">{error}</p>}</div>
   <aside className="game-aside"><span className="eyebrow">{'THE SCORECARD'}</span><h2>{'Tight range.'}<br /><em>{'High score.'}</em></h2><p>{'A wide range feels safe. A narrow range earns more. The choice is yours.'}</p><div className="score-guide"><div><span className="guide-line narrow"/><span>{'Exact answer'}</span><b>200</b></div>{game.scoreVersion === 2 ? <div><span className="guide-line medium"/><span>{'Previous round precision bonus'}</span><b>+40</b></div> : <><div><span className="guide-line medium"/><span>{'10% of the bar'}</span><b>162</b></div><div><span className="guide-line wide"/><span>{'25% of the bar'}</span><b>113</b></div><div><span className="guide-line wide"/><span>{'50% of the bar'}</span><b>50</b></div></>}<div><span className="guide-line wide"/><span>{'Full range'}</span><b>0</b></div><div><span className="guide-miss">×</span><span>{'Answer outside'}</span><b>0</b></div></div><div className="aside-bottom"><Clock3 size={17}/><p>{'Take your time. Speed doesn’t affect your score.'}</p></div></aside></div>
  </section>}
  {view === 'results' && game?.run && <section className="results-section"><div className="results-eyebrow eyebrow"><span className="live-dot"/>{practice ? (replay ? 'REPLAY COMPLETE' : 'PRACTICE COMPLETE') : 'TODAY, COMPLETE'} · #{String(game.edition).padStart(3, '0')}</div><h1>{score >= 650 ? 'You know your stuff.' : score >= 300 ? 'Nicely played.' : 'Curiosity wins.'}</h1><p className="result-subtitle">{'Five questions down. Here’s where you landed.'}</p><div className="result-score"><span>{score}</span><small>/ 1000</small><span className="result-spark">✳</span></div><div className="result-summary"><span><Check size={16}/>{correct}/5 {'answers caught'}</span><span>{'A fresh chance tomorrow.'}</span></div>
   {practice ? <div className="practice-result">{replay && <button className="primary" onClick={startReplay}>{'Replay the daily round'}<RotateCcw size={17}/></button>}<p>{replay ? 'Replay complete. Your first daily score and ranking are unchanged.' : 'That was practice. Your daily score and ranking are unchanged.'}</p><button className="primary" onClick={start}>{'Back to the daily game'}<ArrowRight size={18}/></button></div> : <div className="comparison-card"><div className="comparison-top"><span className="eyebrow"><Users size={15}/>{'COMPARE WITH REAL PLAYERS'}</span><button className="icon-button" onClick={refreshStats} aria-label={'Refresh statistics'}><RotateCcw size={16}/></button></div>{stats ? stats.others > 0 ? <><div className="comparison-grid"><div><span>{'Your score'}</span><strong>{score}</strong></div><div><span>{'Other players’ average'}</span><strong>{stats.average}</strong></div><div><span>{'Players you outscored'}</span><strong className="orange">{pct(stats.percentile ?? 0)}</strong></div></div><p className="comparison-foot">{`Compared with the first completed scores of ${stats.others} other players today. Ties are not counted as outscored. Updates as players finish.`}</p></> : <div className="empty-stats"><span className="empty-icon"><Users size={24}/></span><h3>{'You’re today’s trailblazer.'}</h3><p>{'There are no other completed scores to compare yet. Your comparison will appear here as other players finish.'}</p></div> : <div className="empty-stats"><p>{'Loading your comparison. If it takes too long, use the refresh button.'}</p></div>}</div>}
   {!practice && challenge && game && challenge.edition === game.edition && <p className="challenge result-challenge"><Share2 size={16}/>{`Your friend’s shared score: ${challenge.score} · You: ${score} — ${score > challenge.score ? 'you beat it!' : score === challenge.score ? 'a tie.' : 'not this time.'}`}</p>}{!practice && me && me.played > 0 && <div className="comparison-card"><div className="comparison-top"><span className="eyebrow"><Flame size={15}/>{'YOUR STATS · LAST 90 DAYS'}</span></div><div className="my-grid"><div><span>{'Streak'}</span><strong className="orange">{me.streak}{me.capped ? '+' : ''}</strong></div><div><span>{'Best streak'}</span><strong>{me.bestStreak}</strong></div><div><span>{'Average score'}</span><strong>{me.average}</strong></div><div><span>{'Range hit rate'}</span><strong>{pct(me.hitRate ?? 0)}</strong></div></div></div>}{!practice && <div className="results-actions"><button className="primary" onClick={share}>{copied ? 'Result copied!' : 'Share your result'}{copied ? <Check size={18}/> : <Share2 size={18}/>}</button><div className="next-round"><span>{'NEXT ROUND'}</span><strong>{countdown}</strong></div></div>}{!practice && <button className="primary replay-button" onClick={startReplay}>{'Replay the daily round'}<RotateCcw size={17}/></button>}{!practice && <button className="practice-button results-practice" onClick={startPractice}>{'Try a practice round'}<ArrowUpRight size={16}/></button>}{error && <p className="error">{error}</p>}
   <div className="answer-review"><div className="review-title"><h2>{'A little wiser than before'}</h2><span className="eyebrow">{'5 QUESTIONS · 5 DISCOVERIES'}</span></div>{game.run.answers.map((a, i) => { const item = game.questions[i]; return <details key={a.id}><summary><span className={`review-status ${isHit(a) ? 'hit' : 'miss'}`}>{isHit(a) ? <Check size={16}/> : <X size={16}/>}</span><span>{item.en}{item.difficulty && <small className={`review-difficulty ${item.difficulty}`}>{difficulty(item.difficulty)}</small>}</span><strong>+{a.score}</strong><span className="detail-plus">+</span></summary><div className="review-body"><p>{'Your range'}: <b>{format(a.low)} – {format(a.high)}</b> · {'Answer'}: <b>{format(a.answer)}</b> {item.unitEn}</p><p>{a.noteEn} </p>{visibleCrowd(crowd, practice, i) && <p>{'Other players who caught it'}: <b>{pct(Math.round(100 * crowd[i].hits / crowd[i].n))}</b></p>}</div></details>; })}</div><button className="text-button result-home" onClick={() => setView('home')}><ChevronLeft size={16}/>{'Back to home'}</button>
  </section>}
  </main>
  <footer className="footer"><span className="footer-tag">BOUNDLE <i>·</i> {'Make room for curiosity.'}</span><div>{owner && <a href="/admin">{'Manage'}</a>}<button onClick={() => setHelp(true)}>{'How to play'}</button><button onClick={() => setPrivacy(true)}>{'Privacy'}</button><span>© {new Date().getFullYear()}</span></div></footer>
  {(help || privacy) && <div className="modal-overlay" onClick={() => { setHelp(false); setPrivacy(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={e => e.stopPropagation()}><button autoFocus className="icon-button modal-close" onClick={() => { setHelp(false); setPrivacy(false); }} aria-label={'Close'}><X size={22}/></button><span className="eyebrow">BOUNDLE / {help ? 'THE FIELD GUIDE' : 'PRIVACY'}</span><h2 id="modal-title">{help ? 'A little knowledge. A little nerve.' : 'Just your game’s footprint.'}</h2>{help ? <><p>{'Five numerical questions, the same for everyone each day. Choose lower and upper bounds that you think contain the answer. Both endpoints count.'}</p><ol><li>{'Drag the range handles or type your numbers directly.'}</li><li>{'Lock your range. Catch the answer for 0–200 points; miss it for zero.'}</li><li>{'Finish all five to see your total and compare with real players.'}</li></ol><div className="modal-note">{'New scoring: 200 × (1 − chosen width / bar width)². Catch the answer to earn the displayed score; miss for 0. No separate bonus. Exact answer: 200; half the bar: 50; full bar: 0.'}</div><p>{'Your first daily answers are saved; refreshing won’t reset your game. A new round begins worldwide at 00:00 UTC.'}</p><p className="small-muted">{'Each daily round contains 2 easy, 2 medium and 1 hard question. Difficulty labels are editorial estimates. Questions are frozen when the daily round opens; later edits do not change that day’s results.'}</p></> : <><p>{'A necessary browser identity cookie remembers your game progress. Your sound preference stays on this device.'}</p><p>{'Daily answers, scores and a one-way identifier are stored on the server. If signed in, the same account continues the same daily game. Names and emails are not displayed on scoreboards.'}</p><p>{'Comparisons use first completed results only. No advertising or tracking analytics have been added. Fonts load from Google Fonts, which receives your IP address with the request.'}</p><p className="small-muted">{'When playing anonymously, clearing cookies or switching browsers may be treated as a new player.'}</p></>}<button className="primary" onClick={() => { setHelp(false); setPrivacy(false); }}>{'Got it'}<Check size={18}/></button></section></div>}
 </div>;
}
