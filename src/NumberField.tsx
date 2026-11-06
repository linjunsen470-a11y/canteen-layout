import { useId, useRef, useState } from 'react';

// A rejected draft restores the saved value and explains why, without an undo step.
export function NumberField({ value, onCommit, min, max, disabled, placeholder }: {
    value: number | undefined;
    placeholder?: string;
    onCommit: (n: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
}) {
    const [draft, setDraft] = useState<string | null>(null), [error, setError] = useState('');
    const cancelled = useRef(false), errorId = useId();
    return <><input type="number" step="any" placeholder={placeholder} value={draft ?? (value===undefined?'':Math.round(value * 1000) / 1000)} min={min} max={max} disabled={disabled} aria-invalid={!!error} aria-describedby={error?errorId:undefined}
      onChange={e => {setDraft(e.target.value);setError('')}} onBlur={() => {
        if (!cancelled.current && draft !== null) {
            const n=Number(draft), message=draft.trim()===''||!Number.isFinite(n)?'请输入有效数字':min!==undefined&&n<min?`不能小于 ${min}`:max!==undefined&&n>max?`不能大于 ${Math.round(max*1000)/1000}`:'';
            if(message)setError(`${message}，已保留原值`);else onCommit(n);
        }
        cancelled.current=false;setDraft(null);
      }} onKeyDown={e => {
        e.stopPropagation();
        if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}
        if(e.key==='Escape'){cancelled.current=true;setError('');e.currentTarget.blur()}
      }}/>{error&&<small id={errorId} className="field-error" role="status">{error}</small>}</>;
}
