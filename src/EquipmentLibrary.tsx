import { memo, useEffect, useState } from 'react';
import { PanelLeftClose, Search, Sparkles } from 'lucide-react';
import { CatalogEntry, catalog } from './model';
import { useCustomCatalog, reloadCustomCatalog } from './customCatalog';
import { useWorkspace } from './workspace';
import { ordinaryEquipment } from './equipmentFacing';
import { ComboPreset, comboPresets } from './combos';
import ObjectList from './ObjectList';
import CatalogThumbnail from './CatalogThumbnail';
import CustomItemDialog from './CustomItemDialog';
import CustomCatalogActions from './CustomCatalogActions';

const GROUP_ORDER = ['餐桌椅', '餐饮服务', '餐饮设备', '热厨设备', '厨房设备', '冷藏冷冻', '洗消设备', '照明灯具', '软装与门头', '空间构件', '收纳设施', '收纳保洁', '小型设备', '现场设施', '我的物件'];

export default memo(function EquipmentLibrary({
  onAdd,
  onAddCombo,
  savedSignal,
}: {
  onAdd: (entry: CatalogEntry) => void;
  onAddCombo?: (combo: ComboPreset) => void;
  savedSignal: number;
}) {
  const prefs = useWorkspace(), { leftTab } = prefs, libraryOpen = !prefs.focusMode && prefs.libraryOpen;
  const customState = useCustomCatalog(), custom = customState.entries;
  const [search, setSearch] = useState(''), [category, setCategory] = useState('全部分类'), [managing, setManaging] = useState(false);

  useEffect(() => { if (savedSignal) { setSearch(''); setCategory('我的物件'); } }, [savedSignal]);

  const groups = Array.from(new Set([...catalog.map(c => c.group), '我的物件'])).sort((a, b) => {
    return (GROUP_ORDER.indexOf(a) < 0 ? 99 : GROUP_ORDER.indexOf(a)) - (GROUP_ORDER.indexOf(b) < 0 ? 99 : GROUP_ORDER.indexOf(b));
  });

  const q = search.trim().toLowerCase();
  const matches = (c: CatalogEntry) =>
    `${c.name} ${c.specification ?? ''} ${c.group}`.toLowerCase().includes(q) &&
    (category === '全部分类' || (custom.includes(c) ? '我的物件' : c.group) === category);

  const matchingCombos = comboPresets.filter(c =>
    `${c.name} ${c.category} ${c.badge}`.toLowerCase().includes(q) &&
    (category === '全部分类' || category === '成套组合')
  );

  const itemCount = category === '成套组合' ? 0 : [...catalog, ...custom].filter(matches).length;
  const totalCount = itemCount + matchingCombos.length;

  const quickChips = ['全部分类', '成套组合', '餐桌椅', '餐饮服务', '热厨设备', '照明灯具', '软装与门头', '空间构件'];

  return <aside className="library" hidden={!libraryOpen}>
    <div className="panel-heading">
      <div><h3>{leftTab === 'objects' ? '场景对象' : '开店素材库'}</h3></div>
      <button title="收起设备库" aria-label="收起设备库" onClick={() => prefs.set({ libraryOpen: false })}><PanelLeftClose /></button>
    </div>
    <div className="sidebar-tabs" role="tablist" aria-label="左侧面板">
      <button role="tab" aria-selected={leftTab === 'catalog'} onClick={() => prefs.set({ leftTab: 'catalog' })}>设备与素材</button>
      <button role="tab" aria-selected={leftTab === 'objects'} onClick={() => prefs.set({ leftTab: 'objects' })}>对象列表</button>
    </div>
    {leftTab === 'objects' ? <ObjectList /> : <>
      <label className="catalog-search">
        <Search />
        <input aria-label="搜索设备" placeholder="搜索桌椅、厨具、灯具、绿植…" value={search} onChange={e => setSearch(e.target.value)} />
      </label>
      <div className="category-chips" role="group" aria-label="快捷分类">
        {quickChips.map(chip => (
          <button key={chip} type="button" className={category === chip ? 'is-active' : ''} onClick={() => setCategory(chip)}>{chip === '全部分类' ? '全部' : chip}</button>
        ))}
      </div>
      <div className="catalog-filter">
        <select aria-label="设备分类" value={category} onChange={e => setCategory(e.target.value)}>
          {['全部分类', '成套组合', ...groups].map(g => <option key={g}>{g}</option>)}
        </select>
        <small>{totalCount} 项</small>
      </div>
      <div className="library-actions">
        <CustomItemDialog onSaved={() => { setSearch(''); setCategory('我的物件'); }} />
        <button aria-pressed={managing} onClick={() => setManaging(v => !v)}>{managing ? '完成管理' : '管理规格'}</button>
      </div>

      {matchingCombos.length > 0 && (
        <section className="combo-section">
          <h4><Sparkles />成套快速组合（一键成组）</h4>
          <div className="combo-grid">
            {matchingCombos.map(combo => (
              <button
                key={combo.id}
                type="button"
                className="combo-card"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/canteen-combo', combo.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onAddCombo?.(combo)}
              >
                <span className="combo-top"><b>{combo.name}</b><em>{combo.badge}</em></span>
                <small>{combo.category} · 约 {combo.sizeLabel}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {category !== '成套组合' && groups.filter(g => (g === '我的物件' ? custom : catalog.filter(c => c.group === g)).some(matches)).map(g => (
        <section key={g}>
          <h4>{g}</h4>
          <div className="catalog">
            {(g === '我的物件' ? custom : catalog.filter(c => c.group === g)).filter(matches).map(c => (
              <div className="catalog-entry" key={c.id ?? c.name}>
                <button
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData('application/canteen-item', JSON.stringify(c));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => onAdd(c)}
                >
                  <CatalogThumbnail item={c} />
                  <b>{c.name}</b>
                  <small>{c.w} × {c.d} × {c.h} mm</small>
                </button>
                {managing && (custom.includes(c)
                  ? <CustomCatalogActions entry={c} />
                  : ordinaryEquipment(c) && <div className="catalog-save-action"><CustomItemDialog initial={c} copy label={`另存规格 · ${c.name}`} onSaved={() => { setSearch(''); setCategory('我的物件'); }} /></div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {customState.error && <div role="alert"><p>{customState.error}</p><button onClick={reloadCustomCatalog}>重新读取设备库</button></div>}
      {totalCount === 0 && <p className="empty-state">没有匹配的设备或组合</p>}
    </>}
  </aside>;
});
