'use client';

import { formatNaira, type Listing, REPORT_REASONS } from '@neva/core';
import { CheckCircle2, Circle, ImageOff } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Modal } from '../components/ui';
import { showToast, useStore, useUI } from '../store';

/** Who an "Also block" on this report would block: the user, or the owner/sender of the reported thing. */
function blockTargetFor(type: 'listing' | 'user' | 'message' | 'story', target: string): string | undefined {
  const s = useStore.getState();
  let uid: string | undefined;
  if (type === 'user') uid = target;
  else if (type === 'listing') uid = s.listings[target]?.sellerId;
  else if (type === 'story') uid = s.stories.find((x) => x.id === target)?.userId;
  else
    for (const list of Object.values(s.messages)) {
      const m = list.find((x) => x.id === target);
      if (m) {
        uid = m.senderId;
        break;
      }
    }
  return uid && uid !== s.meId && !s.blocked.includes(uid) ? uid : undefined;
}

export function ReportModal() {
  const report = useUI((s) => s.report)!;
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const [blockTarget] = useState(() => blockTargetFor(report.type, report.target));
  const [alsoBlock, setAlsoBlock] = useState(report.type === 'user');
  const [didBlock, setDidBlock] = useState(false);
  const close = () => useUI.setState({ report: null });
  const submit = () => {
    if (!reason) return;
    const s = useStore.getState();
    setCaseNo(s.submitReport({ targetType: report.type, targetId: report.target, reason, details: details.trim() || undefined }));
    if (alsoBlock && blockTarget && !s.blocked.includes(blockTarget)) {
      s.toggleBlock(blockTarget);
      setDidBlock(true);
    }
  };
  const blockName = blockTarget ? (report.type === 'user' ? report.name : undefined) ?? useStore.getState().users[blockTarget]?.displayName : undefined;

  if (caseNo)
    return (
      <Modal title="Report sent" onClose={close} footer={<button className="btn primary" onClick={close}>Done</button>}>
        <div style={{ lineHeight: 1.55 }}>
          Thanks — our team will review it. Your case number is <b>{caseNo}</b>.
        </div>
        {didBlock && <div className="muted" style={{ fontSize: 13.5 }}>We’ve also blocked {blockName ?? 'this account'} for you.</div>}
      </Modal>
    );

  return (
    <Modal
      title={`Report ${report.type}`}
      onClose={close}
      footer={
        <>
          <button className="btn line" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!reason} onClick={submit}>Send report</button>
        </>
      }>
      {report.name && <div className="muted">{report.name}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="check">
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            {r}
          </label>
        ))}
      </div>
      <textarea className="field" placeholder="Anything else we should know? (optional)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
      {blockTarget && (
        <label className="check">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
          Also block {blockName ?? 'this account'}
        </label>
      )}
      <div className="faint" style={{ fontSize: 12.5 }}>Reports are confidential. The person won’t know who reported them.</div>
    </Modal>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export function ReviewModal({ sellerId }: { sellerId: string }) {
  const seller = useStore((s) => s.users[sellerId]);
  const existing = useStore((s) => s.reviews.find((r) => r.sellerId === sellerId && r.reviewerId === s.meId));
  const conversations = useStore((s) => s.conversations);
  const listings = useStore((s) => s.listings);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState(existing?.text ?? '');
  const [item, setItem] = useState<string | undefined>(existing?.listingId);
  // This seller's items you actually discussed with them.
  const discussed = useMemo(
    () =>
      Array.from(new Set(Object.values(conversations).filter((c) => c.participantId === sellerId && c.listingId).map((c) => c.listingId!)))
        .map((lid) => listings[lid])
        .filter((l): l is Listing => !!l && l.sellerId === sellerId),
    [conversations, listings, sellerId],
  );
  const close = () => useUI.setState({ review: null });
  const save = () => {
    if (!rating) return;
    useStore.getState().saveReview({ sellerId, listingId: item, rating, text });
    showToast(existing ? 'Rating updated' : 'Thanks for rating');
    close();
  };
  const remove = () => {
    if (!confirm('Remove your rating for this seller?')) return;
    useStore.getState().deleteReview(sellerId);
    showToast('Rating removed');
    close();
  };
  const shown = hover || rating;
  return (
    <Modal
      title={`Rate ${seller?.shopName ?? seller?.displayName ?? 'seller'}`}
      onClose={close}
      footer={
        <>
          {existing && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={remove}>Remove</button>}
          <button className="btn line" onClick={close}>Cancel</button>
          <button className="btn primary" disabled={!rating} onClick={save}>{existing ? 'Update' : 'Submit'}</button>
        </>
      }>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''} · ${LABELS[n]}`} style={{ fontSize: 36, color: n <= shown ? 'var(--accent)' : 'var(--text3)', lineHeight: 1 }}>
              ★
            </button>
          ))}
        </div>
        <div className={shown ? '' : 'faint'} style={{ fontSize: 14, fontWeight: 500, minHeight: 20 }}>{shown ? LABELS[shown] : 'Choose a rating'}</div>
      </div>
      {discussed.length > 0 && (
        <div>
          <label className="flabel">Which item? (optional)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {discussed.map((l) => {
              const on = item === l.id;
              return (
                <button key={l.id} onClick={() => setItem(on ? undefined : l.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 10, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-soft)' : 'transparent', textAlign: 'left' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: 'var(--input)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.images[0] ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOff size={16} className="faint" />}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="ellipsis" style={{ fontSize: 14 }}>{l.title}</div>
                    <div className="faint" style={{ fontSize: 12.5 }}>{formatNaira(l.priceMinor)}</div>
                  </div>
                  {on ? <CheckCircle2 size={20} color="var(--accent)" /> : <Circle size={20} className="faint" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <textarea className="field" placeholder="How was dealing with this seller? (optional)" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="faint" style={{ fontSize: 12.5 }}>Ratings are shown publicly with your name. Only people who have chatted with a seller can rate them.</div>
    </Modal>
  );
}
