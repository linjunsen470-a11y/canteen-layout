import { useRef, useState } from 'react';
// Commit once on blur/Enter so typing a dimension remains one undo step.
export function NumberField({ value, onCommit, min, disabled, placeholder }: {
    value: number | undefined;
    placeholder?: string;
    onCommit: (n: number) => void;
    min?: number;
    disabled?: boolean;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    const cancelled = useRef(false);
    return <input type="number" placeholder={placeholder} value={draft ?? (value===undefined?'':Math.round(value * 1000) / 1000)} min={min} disabled={disabled} onChange={e => setDraft(e.target.value)} onBlur={() => { if (!cancelled.current && draft !== null && draft.trim() !== '') {
        const n = Number(draft);
        if (Number.isFinite(n) && (min === undefined || n >= min))
            onCommit(n);
    } cancelled.current = false; setDraft(null); }} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter')
        e.currentTarget.blur(); if (e.key === 'Escape') {
        cancelled.current = true;
        e.currentTarget.blur();
    } }}/>;
}
