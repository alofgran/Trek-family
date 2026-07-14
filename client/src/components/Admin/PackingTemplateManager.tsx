import { useState, useEffect, useRef } from 'react'
import { adminApi } from '../../api/client'
import { useToast } from '../shared/Toast'
import { useTranslation } from '../../i18n'
import { Plus, Trash2, Edit2, Package, X, Check, ChevronDown, ChevronRight, FolderPlus } from 'lucide-react'

interface TemplateCategory { id: number; template_id: number; name: string; sort_order: number }
interface TemplateItem { id: number; category_id: number; name: string; sort_order: number; traveler_type?: string | null }
interface Template { id: number; name: string; item_count: number; category_count: number; created_by_name: string; traveler_type?: string | null }

const TRAVELER_TYPE_OPTIONS = ['', 'adult', 'teen', 'child', 'infant'] as const

export default function PackingTemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createTravelerType, setCreateTravelerType] = useState<string>('')

  // Expanded template state
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [categories, setCategories] = useState<TemplateCategory[]>([])
  const [items, setItems] = useState<TemplateItem[]>([])

  // Editing states
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null)
  const [editTemplateName, setEditTemplateName] = useState('')
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [editItemName, setEditItemName] = useState('')

  // Adding states
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingItemToCatId, setAddingItemToCatId] = useState<number | null>(null)
  const [newItemName, setNewItemName] = useState('')
  const [newItemTravelerType, setNewItemTravelerType] = useState('')
  const addItemRef = useRef<HTMLInputElement>(null)

  const toast = useToast()
  const { t } = useTranslation()

  useEffect(() => { loadTemplates() }, [])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const data = await adminApi.packingTemplates()
      setTemplates(data.templates || [])
    } catch { toast.error(t('admin.packingTemplates.loadError')) }
    finally { setIsLoading(false) }
  }

  const toggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setAddingCategory(false)
    setAddingItemToCatId(null)
    try {
      const data = await adminApi.getPackingTemplate(id)
      setCategories(data.categories || [])
      setItems(data.items || [])
    } catch { toast.error(t('admin.packingTemplates.loadError')) }
  }

  // Template CRUD
  const handleCreateTemplate = async () => {
    if (!createName.trim()) return
    try {
      const data = await adminApi.createPackingTemplate({ name: createName.trim(), traveler_type: createTravelerType || null })
      setTemplates(prev => [{ ...data.template, item_count: 0, category_count: 0 }, ...prev])
      setCreateName(''); setCreateTravelerType(''); setShowCreate(false)
      setExpandedId(data.template.id); setCategories([]); setItems([])
      toast.success(t('admin.packingTemplates.created'))
    } catch { toast.error(t('admin.packingTemplates.createError')) }
  }

  const handleChangeTravelerType = async (id: number, travelerType: string) => {
    try {
      await adminApi.updatePackingTemplate(id, { traveler_type: travelerType || null })
      setTemplates(prev => prev.map(tmpl => tmpl.id === id ? { ...tmpl, traveler_type: travelerType || null } : tmpl))
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleDeleteTemplate = async (id: number) => {
    try {
      await adminApi.deletePackingTemplate(id)
      setTemplates(prev => prev.filter(t => t.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success(t('admin.packingTemplates.deleted'))
    } catch { toast.error(t('admin.packingTemplates.deleteError')) }
  }

  const handleRenameTemplate = async (id: number) => {
    if (!editTemplateName.trim()) { setEditingTemplate(null); return }
    try {
      await adminApi.updatePackingTemplate(id, { name: editTemplateName.trim() })
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editTemplateName.trim() } : t))
      setEditingTemplate(null)
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  // Category CRUD
  const handleAddCategory = async () => {
    if (!newCatName.trim() || !expandedId) return
    try {
      const data = await adminApi.addTemplateCategory(expandedId, { name: newCatName.trim() })
      setCategories(prev => [...prev, data.category])
      setNewCatName(''); setAddingCategory(false)
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleRenameCategory = async (catId: number) => {
    if (!editCatName.trim() || !expandedId) { setEditingCatId(null); return }
    try {
      await adminApi.updateTemplateCategory(expandedId, catId, { name: editCatName.trim() })
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, name: editCatName.trim() } : c))
      setEditingCatId(null)
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleDeleteCategory = async (catId: number) => {
    if (!expandedId) return
    try {
      await adminApi.deleteTemplateCategory(expandedId, catId)
      setCategories(prev => prev.filter(c => c.id !== catId))
      setItems(prev => prev.filter(i => i.category_id !== catId))
    } catch { toast.error(t('admin.packingTemplates.deleteError')) }
  }

  // Item CRUD
  const handleAddItem = async (catId: number) => {
    if (!newItemName.trim() || !expandedId) return
    try {
      const data = await adminApi.addTemplateItem(expandedId, catId, { name: newItemName.trim(), traveler_type: newItemTravelerType || null })
      setItems(prev => [...prev, data.item])
      setNewItemName(''); setNewItemTravelerType('')
      setTimeout(() => addItemRef.current?.focus(), 30)
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleRenameItem = async (itemId: number) => {
    if (!editItemName.trim() || !expandedId) { setEditingItemId(null); return }
    try {
      await adminApi.updateTemplateItem(expandedId, itemId, { name: editItemName.trim() })
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, name: editItemName.trim() } : i))
      setEditingItemId(null)
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleChangeItemTravelerType = async (itemId: number, travelerType: string) => {
    if (!expandedId) return
    try {
      await adminApi.updateTemplateItem(expandedId, itemId, { traveler_type: travelerType || null })
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, traveler_type: travelerType || null } : i))
    } catch { toast.error(t('admin.packingTemplates.saveError')) }
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!expandedId) return
    try {
      await adminApi.deleteTemplateItem(expandedId, itemId)
      setItems(prev => prev.filter(i => i.id !== itemId))
    } catch { toast.error(t('admin.packingTemplates.deleteError')) }
  }

  const inputStyle = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none'
  const btnIcon = 'p-1.5 rounded-lg transition-colors'

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">{t('admin.packingTemplates.title')}</h2>
          <p className="text-xs text-slate-400 mt-1">{t('admin.packingTemplates.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.packingTemplates.create')}</span>
        </button>
      </div>

      {/* Create template */}
      {showCreate && (
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <Package size={16} className="text-slate-400 flex-shrink-0" />
          <input autoFocus value={createName} onChange={e => setCreateName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplate(); if (e.key === 'Escape') setShowCreate(false) }}
            placeholder={t('admin.packingTemplates.namePlaceholder')} className={inputStyle} />
          <select value={createTravelerType} onChange={e => setCreateTravelerType(e.target.value)}
            className="px-2 py-2 border border-slate-200 rounded-lg text-sm outline-none">
            {TRAVELER_TYPE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt ? t(`travelers.type.${opt}`) : t('admin.packingTemplates.anyTraveler')}</option>
            ))}
          </select>
          <button onClick={handleCreateTemplate} className={`${btnIcon} text-slate-600 hover:text-slate-900`}><Check size={16} /></button>
          <button onClick={() => setShowCreate(false)} className={`${btnIcon} text-slate-400 hover:text-slate-600`}><X size={16} /></button>
        </div>
      )}

      {/* Template list */}
      {isLoading ? (
        <div className="p-8 text-center"><div className="w-8 h-8 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" /></div>
      ) : templates.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-400">{t('admin.packingTemplates.empty')}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {templates.map(tmpl => (
            <div key={tmpl.id}>
              {/* Template row */}
              <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <button onClick={() => toggleExpand(tmpl.id)} className="text-slate-400 flex-shrink-0 p-0 bg-transparent border-none cursor-pointer">
                  {expandedId === tmpl.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <Package size={16} className="text-slate-400 flex-shrink-0" />
                {editingTemplate === tmpl.id ? (
                  <input autoFocus value={editTemplateName} onChange={e => setEditTemplateName(e.target.value)}
                    onBlur={() => handleRenameTemplate(tmpl.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameTemplate(tmpl.id); if (e.key === 'Escape') setEditingTemplate(null) }}
                    className="flex-1 px-2 py-0.5 border border-slate-300 rounded text-sm" />
                ) : (
                  <span onClick={() => toggleExpand(tmpl.id)} className="flex-1 text-sm font-medium text-slate-700 cursor-pointer">{tmpl.name}</span>
                )}
                <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full">
                  {tmpl.category_count} {t('admin.packingTemplates.categories')} · {tmpl.item_count} {t('admin.packingTemplates.items')}
                </span>
                <select value={tmpl.traveler_type || ''} onChange={e => handleChangeTravelerType(tmpl.id, e.target.value)}
                  title={t('admin.packingTemplates.ageBand')}
                  className="text-xs px-1.5 py-1 border border-slate-200 rounded-lg outline-none text-slate-600">
                  {TRAVELER_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt ? t(`travelers.type.${opt}`) : t('admin.packingTemplates.anyTraveler')}</option>
                  ))}
                </select>
                <button onClick={() => { setEditingTemplate(tmpl.id); setEditTemplateName(tmpl.name) }}
                  className={`${btnIcon} hover:bg-slate-100 text-slate-400 hover:text-slate-700`}><Edit2 size={14} /></button>
                <button onClick={() => handleDeleteTemplate(tmpl.id)}
                  className={`${btnIcon} hover:bg-red-50 text-slate-400 hover:text-red-500`}><Trash2 size={14} /></button>
              </div>

              {/* Expanded content */}
              {expandedId === tmpl.id && (
                <div className="px-5 pb-4 ml-8 space-y-3">
                  {categories.map(cat => {
                    const catItems = items.filter(i => i.category_id === cat.id)
                    return (
                      <div key={cat.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50">
                          {editingCatId === cat.id ? (
                            <>
                              <input autoFocus value={editCatName} onChange={e => setEditCatName(e.target.value)}
                                onBlur={() => handleRenameCategory(cat.id)}
                                onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') setEditingCatId(null) }}
                                className="flex-1 px-2 py-0.5 border border-slate-300 rounded text-sm font-semibold" />
                            </>
                          ) : (
                            <span className="flex-1 text-xs font-bold text-slate-500 uppercase tracking-wider">{cat.name}</span>
                          )}
                          <span className="text-xs text-slate-400">{catItems.length}</span>
                          <button onClick={() => { setAddingItemToCatId(addingItemToCatId === cat.id ? null : cat.id); setNewItemName(''); setNewItemTravelerType(''); setTimeout(() => addItemRef.current?.focus(), 30) }}
                            className={`${btnIcon} text-slate-400 hover:text-slate-700`}><Plus size={13} /></button>
                          <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name) }}
                            className={`${btnIcon} text-slate-400 hover:text-slate-700`}><Edit2 size={13} /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)}
                            className={`${btnIcon} text-slate-400 hover:text-red-500`}><Trash2 size={13} /></button>
                        </div>

                        {/* Items */}
                        {(catItems.length > 0 || addingItemToCatId === cat.id) && (
                          <div className="divide-y divide-slate-50">
                            {catItems.map(item => (
                              <div key={item.id} className="flex items-center gap-3 px-4 py-2 group">
                                {editingItemId === item.id ? (
                                  <>
                                    <input autoFocus value={editItemName} onChange={e => setEditItemName(e.target.value)}
                                      onKeyDown={e => { if (e.key === 'Enter') handleRenameItem(item.id); if (e.key === 'Escape') setEditingItemId(null) }}
                                      className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm" />
                                    <button onClick={() => handleRenameItem(item.id)} className="p-1 text-slate-600 hover:text-slate-900"><Check size={13} /></button>
                                    <button onClick={() => setEditingItemId(null)} className="p-1 text-slate-400"><X size={13} /></button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 text-sm text-slate-700">{item.name}</span>
                                    <select value={item.traveler_type || ''} onChange={e => handleChangeItemTravelerType(item.id, e.target.value)}
                                      title={t('admin.packingTemplates.ageBand')}
                                      className="text-xs px-1 py-0.5 border border-slate-200 rounded outline-none text-slate-500">
                                      {TRAVELER_TYPE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt ? t(`travelers.type.${opt}`) : t('admin.packingTemplates.anyTraveler')}</option>
                                      ))}
                                    </select>
                                    <button onClick={() => { setEditingItemId(item.id); setEditItemName(item.name) }}
                                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-all"><Edit2 size={12} /></button>
                                    <button onClick={() => handleDeleteItem(item.id)}
                                      className="p-1 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"><Trash2 size={12} /></button>
                                  </>
                                )}
                              </div>
                            ))}

                            {/* Add item inline */}
                            {addingItemToCatId === cat.id && (
                              <div className="flex items-center gap-2 px-4 py-2">
                                <input ref={addItemRef} value={newItemName} onChange={e => setNewItemName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' && newItemName.trim()) handleAddItem(cat.id); if (e.key === 'Escape') { setAddingItemToCatId(null); setNewItemName(''); setNewItemTravelerType('') } }}
                                  placeholder={t('admin.packingTemplates.itemName')}
                                  className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-sm" />
                                <select value={newItemTravelerType} onChange={e => setNewItemTravelerType(e.target.value)}
                                  title={t('admin.packingTemplates.ageBand')}
                                  className="text-xs px-1.5 py-1 border border-slate-200 rounded-lg outline-none text-slate-600">
                                  {TRAVELER_TYPE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt ? t(`travelers.type.${opt}`) : t('admin.packingTemplates.anyTraveler')}</option>
                                  ))}
                                </select>
                                <button onClick={() => handleAddItem(cat.id)} disabled={!newItemName.trim()}
                                  className="p-1.5 rounded-lg bg-slate-900 text-white disabled:bg-slate-300 hover:bg-slate-700 transition-colors"><Plus size={13} /></button>
                                <button onClick={() => { setAddingItemToCatId(null); setNewItemName(''); setNewItemTravelerType('') }}
                                  className="p-1 text-slate-400 hover:text-slate-600"><X size={13} /></button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add category button */}
                  {addingCategory ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setAddingCategory(false); setNewCatName('') } }}
                        placeholder={t('admin.packingTemplates.categoryName')}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                      <button onClick={handleAddCategory} className={`${btnIcon} text-slate-600 hover:text-slate-900`}><Check size={15} /></button>
                      <button onClick={() => { setAddingCategory(false); setNewCatName('') }} className={`${btnIcon} text-slate-400`}><X size={15} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingCategory(true)}
                      className="flex items-center gap-2 px-3 py-2.5 w-full text-sm text-slate-400 hover:text-slate-600 border border-dashed border-slate-200 rounded-lg hover:border-slate-400 transition-colors">
                      <FolderPlus size={14} /> {t('admin.packingTemplates.addCategory')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
