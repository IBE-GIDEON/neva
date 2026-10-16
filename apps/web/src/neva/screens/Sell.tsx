'use client';

import { CATEGORIES, type Condition, CONDITIONS, type ListingDraft, OTHER_CATEGORY_IDEAS, tidyPlace } from '@neva/core';
import { ChevronDown, ChevronUp, ImagePlus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Modal } from '../components/ui';
import { LocationInput } from '../components/LocationInput';
import { pickImages } from '../lib/images';
import { openDrawer, showToast, useStore, useUI } from '../store';

const PROHIBITED = /\b(stolen|replica|clone|fake|1:1|first copy|blacklisted|icloud locked)\b/i;

type Form = {
  images: string[];
  title: string;
  price: string;
  negotiable: boolean;
  categoryId: string;
  customCategory: string;
  subcategory: string;
  condition: Condition | '';
  description: string;
  brand: string;
  model: string;
  attributes: Record<string, string>;
  city: string;
  area: string;
  pickup: boolean;
  delivery: boolean;
};

const toForm = (d: Partial<ListingDraft> | undefined, city: string): Form => ({
  images: d?.images ?? [],
  title: d?.title ?? '',
  price: d?.priceMinor ? String(Math.round(d.priceMinor / 100)) : '',
  negotiable: d?.negotiable ?? true,
  categoryId: d?.categoryId ?? '',
  customCategory: d?.customCategory ?? '',
  subcategory: d?.subcategory ?? '',
  condition: d?.condition ?? '',
  description: d?.description ?? '',
  brand: d?.brand ?? '',
  model: d?.model ?? '',
  attributes: d?.attributes ?? {},
  city: d?.city ?? city,
  area: d?.area ?? '',
  pickup: d?.pickup ?? true,
  delivery: d?.delivery ?? false,
});

const hasContent = (f: Form) =>
  !!(f.images.length || f.title.trim() || f.price || f.categoryId || f.condition || f.description.trim() || f.brand.trim() || f.model.trim() || Object.values(f.attributes).some((v) => v.trim()));

/** Form → store draft shape (attributes trimmed, empty values dropped). */
const toDraft = (f: Form, editingId?: string): Partial<ListingDraft> => ({
  step: 0,
  editingId,
  images: f.images,
  title: f.title,
  priceMinor: Number(f.price.replace(/\D/g, '')) * 100 || undefined,
  negotiable: f.negotiable,
  categoryId: f.categoryId || undefined,
  customCategory: f.categoryId === 'other' ? f.customCategory : undefined,
  subcategory: f.subcategory || undefined,
  condition: f.condition || undefined,
  description: f.description,
  brand: f.brand.trim() || undefined,
  model: f.model.trim() || undefined,
  attributes: Object.fromEntries(Object.entries(f.attributes).map(([k, v]) => [k.trim(), v.trim()]).filter(([k, v]) => k && v)),
  city: f.city,
  area: f.area.trim() || undefined,
  pickup: f.pickup,
  delivery: f.delivery,
});

/** Single-page listing form (new + edit) — same rules as the mobile form. New-listing drafts autosave to the store. */
export function SellModal({ editingId }: { editingId?: string }) {
  const otherIdeas = useStore(useShallow((s) => Object.values(s.listings).map((l) => l.customCategory).filter(Boolean) as string[]));
  // Read once on open: the edit draft (filled by store.editListing) or an unfinished new-listing draft.
  const [initial] = useState(() => {
    const s = useStore.getState();
    const myCity = s.users[s.meId]?.city ?? '';
    if (editingId) return { form: toForm(s.draft?.editingId === editingId ? s.draft : s.listings[editingId], myCity), restored: false };
    const d = s.draft && !s.draft.editingId ? s.draft : undefined;
    const form = toForm(d, myCity);
    return { form, restored: hasContent(form) };
  });
  const [f, setF] = useState<Form>(initial.form);
  const [restored, setRestored] = useState(initial.restored);
  const [resetKey, setResetKey] = useState(0);
  const [showDetails, setShowDetails] = useState(() => !!(initial.form.brand || initial.form.model || Object.keys(initial.form.attributes).length));
  const [asking, setAsking] = useState(false);
  const [ack, setAck] = useState(false);
  const update = (p: Partial<Form>) => setF((prev) => ({ ...prev, ...p }));

  // Debounced autosave of new-listing drafts so closing the window (or the modal) keeps the work.
  useEffect(() => {
    if (editingId) return;
    const t = setTimeout(() => {
      const st = useStore.getState();
      if (hasContent(f)) st.setDraft(toDraft(f));
      else if (st.draft && !st.draft.editingId) st.setDraft(null);
    }, 400);
    return () => clearTimeout(t);
  }, [f, editingId]);

  const hide = () => useUI.setState({ sell: { open: false } });
  const discard = () => {
    useStore.getState().setDraft(null);
    hide();
  };
  const keep = () => {
    useStore.getState().setDraft(null);
    useStore.getState().setDraft(toDraft(f));
    showToast('Draft saved');
    hide();
  };
  const close = () => {
    if (editingId) {
      if (JSON.stringify(f) !== JSON.stringify(initial.form) && !confirm('Discard your changes to this listing?')) return;
      return discard();
    }
    if (!hasContent(f)) return discard();
    if (asking) return keep(); // Escape / outside click while asking keeps the draft (safe default)
    setAsking(true);
  };
  const startOver = () => {
    useStore.getState().setDraft(null);
    const s = useStore.getState();
    setF(toForm(undefined, s.users[s.meId]?.city ?? ''));
    setRestored(false);
    setShowDetails(false);
    setAck(false);
    setResetKey((k) => k + 1);
  };

  const cat = CATEGORIES.find((c) => c.id === f.categoryId);
  const fixedKeys: readonly string[] = cat?.attrs ?? [];
  const ideas = useMemo(() => Array.from(new Set([...otherIdeas, ...OTHER_CATEGORY_IDEAS])), [otherIdeas]);
  const flagged = PROHIBITED.test(`${f.title} ${f.description}`);
  const priceMinor = Number(f.price.replace(/\D/g, '')) * 100;
  const isOther = f.categoryId === 'other';
  const missing = [
    !f.images.length && 'a photo',
    f.title.trim().length < 6 && 'a title',
    !(priceMinor > 0) && 'a price',
    (!f.categoryId || (isOther && f.customCategory.trim().length < 3)) && 'a category',
    !f.condition && 'the condition',
    f.description.trim().length < 20 && 'a description',
    f.city.trim().length < 2 && 'a city',
    !f.pickup && !f.delivery && 'pickup or delivery',
  ].filter(Boolean) as string[];
  const ready = !missing.length && ack && !flagged;

  const publish = () => {
    if (!ready) return;
    const s = useStore.getState();
    s.setDraft(null);
    s.setDraft({ ...toDraft(f, editingId), city: tidyPlace(f.city) });
    const id = s.publishDraft();
    if (id) {
      showToast(editingId ? 'Listing updated' : 'Listing published');
      hide();
      openDrawer({ kind: 'listing', id });
    }
  };

  return (
    <Modal
      large
      title={editingId ? 'Edit listing' : 'New listing'}
      onClose={close}
      footer={
        asking ? (
          <>
            <span style={{ fontSize: 14, marginRight: 'auto' }}>Keep this draft for later?</span>
            <button className="btn line" onClick={discard}>Discard</button>
            <button className="btn primary" onClick={keep}>Keep draft</button>
          </>
        ) : (
          <>
            {missing.length > 0 && <span className="faint" style={{ fontSize: 13, marginRight: 'auto' }}>Add {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` and ${missing.length - 3} more` : ''}</span>}
            <button className="btn line" onClick={close}>Cancel</button>
            <button className="btn primary" disabled={!ready} onClick={publish}>{editingId ? 'Save changes' : 'Publish'}</button>
          </>
        )
      }>
      {restored && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--accent-soft)' }}>
          <div className="grow">
            <div style={{ fontWeight: 500 }}>Continue your draft</div>
            <div className="muted" style={{ fontSize: 13 }}>We kept what you entered last time.</div>
          </div>
          <button className="btn ghost sm" onClick={startOver}>Start over</button>
        </div>
      )}

      <div>
        <label className="flabel">Photos · first one is the cover</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {f.images.map((u, i) => (
            <div key={i} style={{ position: 'relative', width: 96, height: 96, borderRadius: 10, overflow: 'hidden', cursor: i ? 'pointer' : undefined }} onClick={() => i && update({ images: [u, ...f.images.filter((_, j) => j !== i)] })} title={i ? 'Make cover' : 'Cover photo'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {i === 0 && <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 11, textAlign: 'center', padding: 2 }}>Cover</span>}
              <button onClick={(e) => { e.stopPropagation(); update({ images: f.images.filter((_, j) => j !== i) }); }} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,.6)', color: '#fff', display: 'grid', placeItems: 'center' }} aria-label="Remove photo">
                <X size={13} />
              </button>
            </div>
          ))}
          {f.images.length < 8 && (
            <button onClick={async () => { const picked = await pickImages(true); setF((prev) => ({ ...prev, images: [...prev.images, ...picked].slice(0, 8) })); }} style={{ width: 96, height: 96, borderRadius: 10, border: '1px dashed var(--text3)', display: 'grid', placeItems: 'center', color: 'var(--text2)' }}>
              <div style={{ textAlign: 'center' }}>
                <ImagePlus size={22} style={{ margin: '0 auto' }} />
                <div style={{ fontSize: 12, marginTop: 4 }}>{f.images.length}/8</div>
              </div>
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="flabel">Title</label>
        <input className="box" placeholder="e.g. iPhone 13 Pro 256GB, Sierra Blue" maxLength={80} value={f.title} onChange={(e) => update({ title: e.target.value })} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label className="flabel">Price (₦)</label>
          <input className="box" inputMode="numeric" value={f.price ? Number(f.price).toLocaleString('en-NG') : ''} onChange={(e) => update({ price: e.target.value.replace(/\D/g, '').slice(0, 10) })} />
        </div>
        <label className="check" style={{ alignSelf: 'end', height: 44 }}>
          <input type="checkbox" checked={f.negotiable} onChange={(e) => update({ negotiable: e.target.checked })} /> Open to offers
        </label>
        <div>
          <label className="flabel">Category</label>
          <select
            className="box"
            value={f.categoryId}
            onChange={(e) => {
              // Keep free-form details; drop the previous category's spec fields.
              const extras = Object.fromEntries(Object.entries(f.attributes).filter(([k]) => !fixedKeys.includes(k)));
              update({ categoryId: e.target.value, subcategory: '', attributes: extras });
            }}>
            <option value="">Choose…</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="flabel">Condition</label>
          <select className="box" value={f.condition} onChange={(e) => update({ condition: e.target.value as Condition })}>
            <option value="">Choose…</option>
            {CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        {isOther && (
          <div>
            <label className="flabel">Name the category</label>
            <input className="box" placeholder="e.g. Musical instruments" list="other-cats" value={f.customCategory} onChange={(e) => update({ customCategory: e.target.value.slice(0, 40) })} />
            <datalist id="other-cats">{ideas.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        )}
        {(isOther || (cat && cat.subs.length > 0)) && (
          <div>
            <label className="flabel">Type (optional)</label>
            <input className="box" placeholder={isOther ? 'e.g. Keyboard, amplifier' : 'Type or pick'} list="cat-subs" value={f.subcategory} onChange={(e) => update({ subcategory: e.target.value.slice(0, 30) })} />
            <datalist id="cat-subs">{(cat?.subs ?? []).map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        )}
      </div>
      {f.condition && <div className="faint" style={{ fontSize: 12.5, marginTop: -8 }}>{CONDITIONS.find((c) => c.id === f.condition)?.definition}</div>}

      <div>
        <label className="flabel">Description</label>
        <textarea
          className="box"
          style={{ height: 'auto', minHeight: 120, padding: 12, resize: 'vertical', lineHeight: 1.45 }}
          placeholder={isOther ? 'Describe the item in your own words — what it is, its condition, what’s included.' : 'Condition, any faults or repairs, what’s included, warranty'}
          value={f.description}
          onChange={(e) => update({ description: e.target.value.slice(0, 1500) })}
        />
        {f.description.trim().length > 0 && f.description.trim().length < 20 && <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>At least 20 characters</div>}
      </div>

      <div>
        <button type="button" onClick={() => setShowDetails(!showDetails)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '4px 0', fontSize: 15, fontWeight: 500 }}>
          <span className="grow" style={{ textAlign: 'left' }}>More details</span>
          <span className="faint" style={{ fontSize: 13, fontWeight: 400 }}>Optional</span>
          {showDetails ? <ChevronUp size={18} className="muted" /> : <ChevronDown size={18} className="muted" />}
        </button>
        {showDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="flabel">Brand</label>
                <input className="box" placeholder="e.g. Apple" maxLength={40} value={f.brand} onChange={(e) => update({ brand: e.target.value })} />
              </div>
              <div>
                <label className="flabel">Model</label>
                <input className="box" placeholder="e.g. iPhone 13 Pro" maxLength={60} value={f.model} onChange={(e) => update({ model: e.target.value })} />
              </div>
              {fixedKeys.map((a) => (
                <div key={a}>
                  <label className="flabel">{a}</label>
                  <input className="box" maxLength={60} value={f.attributes[a] ?? ''} onChange={(e) => update({ attributes: { ...f.attributes, [a]: e.target.value } })} />
                </div>
              ))}
            </div>
            <CustomDetails key={resetKey} fixedKeys={fixedKeys} attributes={f.attributes} onChange={(attributes) => update({ attributes })} />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label className="flabel">City or town</label>
          <LocationInput value={f.city} onChange={(city) => update({ city })} />
        </div>
        <div>
          <label className="flabel">Area (optional)</label>
          <input className="box" placeholder="e.g. Ikeja" value={f.area} onChange={(e) => update({ area: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 24 }}>
        <label className="check"><input type="checkbox" checked={f.pickup} onChange={(e) => update({ pickup: e.target.checked })} /> Pickup</label>
        <label className="check"><input type="checkbox" checked={f.delivery} onChange={(e) => update({ delivery: e.target.checked })} /> Delivery</label>
      </div>
      {flagged && <div className="error">Remove terms linked to prohibited items (stolen, replica, iCloud locked…) to publish.</div>}
      <label className="check muted" style={{ alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.45 }}>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 1, flexShrink: 0 }} />
        I own this item, the photos are of the actual item, and I’ve described its condition honestly.
      </label>
    </Modal>
  );
}

/** Free-form name/value details, stored alongside fixed specs in listing.attributes. */
function CustomDetails({ fixedKeys, attributes, onChange }: { fixedKeys: readonly string[]; attributes: Record<string, string>; onChange: (a: Record<string, string>) => void }) {
  const [rows, setRows] = useState<{ k: string; v: string }[]>(() => Object.entries(attributes).filter(([k]) => !fixedKeys.includes(k)).map(([k, v]) => ({ k, v })));
  const commit = (next: { k: string; v: string }[]) => {
    setRows(next);
    const fixed = Object.fromEntries(Object.entries(attributes).filter(([k]) => fixedKeys.includes(k)));
    const extra = Object.fromEntries(next.filter((r) => r.k.trim() && r.v.trim()).map((r) => [r.k.trim(), r.v]));
    onChange({ ...fixed, ...extra });
  };
  return (
    <div>
      {rows.length > 0 && <label className="flabel">Other details</label>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="box" style={{ flex: 1 }} placeholder="Name (e.g. Colour)" value={r.k} onChange={(e) => commit(rows.map((x, j) => (j === i ? { ...x, k: e.target.value.slice(0, 30) } : x)))} />
            <input className="box" style={{ flex: 1.3 }} placeholder="Value" value={r.v} onChange={(e) => commit(rows.map((x, j) => (j === i ? { ...x, v: e.target.value.slice(0, 60) } : x)))} />
            <button className="icon-btn" style={{ width: 34, height: 34, flexShrink: 0 }} onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label="Remove detail"><X size={16} /></button>
          </div>
        ))}
      </div>
      {rows.length < 8 && (
        <button className="btn ghost sm" style={{ marginTop: rows.length ? 8 : 0, paddingLeft: 8 }} onClick={() => setRows([...rows, { k: '', v: '' }])}>
          <Plus size={15} /> Add a detail
        </button>
      )}
    </div>
  );
}
