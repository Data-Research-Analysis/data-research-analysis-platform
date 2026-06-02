import { ref, computed, type Ref } from 'vue'
import { useReports, type IReport, type IReportItem } from '@/composables/useReports'

/**
 * Supported report item types for the drag & drop builder.
 */
export type ReportItemTypeName =
  | 'dashboard'
  | 'kpi_card'
  | 'ai_insight'
  | 'comparison_table'
  | 'text_block'
  | 'chart'
  | 'data_table'

/**
 * Display metadata for each item type shown in the picker / sidebar.
 */
export interface ReportItemTypeMeta {
  type: ReportItemTypeName
  label: string
  description: string
  icon: string
  category: 'data' | 'visual' | 'content'
}

/**
 * Internal representation of a builder section.
 */
export interface BuilderSection {
  _key: string
  id: number | null
  item_type: ReportItemTypeName
  display_order: number
  ref_id: number | null
  payload: Record<string, any>
  visible: boolean
  selected: boolean
}

let _keySeq = 0
function nextKey(): string {
  return `section-${Date.now()}-${++_keySeq}`
}

export const REPORT_ITEM_TYPES: ReportItemTypeMeta[] = [
  {
    type: 'kpi_card',
    label: 'KPI Cards',
    description: 'Row of metric cards with current values, trends, and sparklines',
    icon: 'chart-line',
    category: 'data',
  },
  {
    type: 'ai_insight',
    label: 'AI Insights',
    description: 'AI-generated insights grouped by category (trends, anomalies, recommendations)',
    icon: 'wand-magic-sparkles',
    category: 'data',
  },
  {
    type: 'comparison_table',
    label: 'Comparison Table',
    description: 'Grouped data table comparing metrics across dimensions (channels, campaigns)',
    icon: 'table',
    category: 'data',
  },
  {
    type: 'text_block',
    label: 'Text Block',
    description: 'Markdown text block for notes, executive summaries, and commentary',
    icon: 'align-left',
    category: 'content',
  },
  {
    type: 'dashboard',
    label: 'Dashboard',
    description: 'Embed an existing dashboard from this project',
    icon: 'table-columns',
    category: 'visual',
  },
  {
    type: 'chart',
    label: 'Chart',
    description: 'Individual chart from a dashboard',
    icon: 'chart-pie',
    category: 'visual',
  },
  {
    type: 'data_table',
    label: 'Data Table',
    description: 'Sortable, filterable data table from a data model',
    icon: 'database',
    category: 'data',
  },
]

function defaultPayload(type: ReportItemTypeName): Record<string, any> {
  switch (type) {
    case 'kpi_card':
      return {
        data_model_id: null,
        cards: [],
      }
    case 'ai_insight':
      return {
        data_model_id: null,
        insight_categories: ['trend', 'anomaly', 'correlation', 'recommendation'],
      }
    case 'comparison_table':
      return {
        data_model_id: null,
        dimension_column: '',
        metrics: [],
        sort_by: null,
        sort_order: 'desc',
      }
    case 'text_block':
      return {
        markdown_content: '',
      }
    case 'dashboard':
      return {}
    case 'chart':
      return {
        dashboard_id: null,
        chart_id: null,
      }
    case 'data_table':
      return {
        data_model_id: null,
        columns: [],
        sort_config: null,
        filter_config: null,
      }
    default:
      return {}
  }
}

/**
 * Composable that manages the full state of the report builder drag & drop editor.
 * Accepts either (projectId, reportId) as Refs/numbers or a single options object.
 */
export function useReportBuilder(
  projectIdOrOpts: Ref<number> | number | { projectId: number; reportId: number },
  reportIdMaybe?: Ref<number> | number,
) {
  const projectId: Ref<number> =
    typeof projectIdOrOpts === 'object' && 'projectId' in projectIdOrOpts
      ? ref(projectIdOrOpts.projectId)
      : typeof projectIdOrOpts === 'number'
        ? ref(projectIdOrOpts)
        : projectIdOrOpts

  const reportId: Ref<number> =
    typeof projectIdOrOpts === 'object' && 'reportId' in projectIdOrOpts
      ? ref(projectIdOrOpts.reportId)
      : reportIdMaybe !== undefined
        ? typeof reportIdMaybe === 'number' ? ref(reportIdMaybe) : reportIdMaybe
        : ref(0)

  const reportsApi = useReports()

  // ─── Core state ────────────────────────────────────────────────────────
  const report = ref<IReport | null>(null)
  const sections = ref<BuilderSection[]>([])
  const loading = ref(true)
  const saving = ref(false)
  const hasUnsavedChanges = ref(false)
  const previewMode = ref(false)
  const showItemPicker = ref(false)
  const showTypePicker = ref(false)

  const draftName = ref('')
  const draftDescription = ref('')

  const selectedSectionKey = ref<string | null>(null)

  // Drag state
  const dragIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)

  // Auto-save timer
  let _autoSaveInterval: ReturnType<typeof setInterval> | null = null
  let _mounted = false

  // ─── Computed ──────────────────────────────────────────────────────────
  const selectedSection = computed(() =>
    sections.value.find(s => s._key === selectedSectionKey.value) ?? null,
  )

  const canSave = computed(() => hasUnsavedChanges.value && !saving.value)
  const itemTypes = computed(() => REPORT_ITEM_TYPES)
  const isDragging = computed(() => dragIndex.value !== null)

  const dragKey = computed(() => {
    if (dragIndex.value === null) return null
    return sections.value[dragIndex.value]?._key ?? null
  })

  const dropIndicator = computed(() => {
    if (dragOverIndex.value === null || dragIndex.value === null) return null
    if (dragOverIndex.value === dragIndex.value) return null
    return sections.value[dragOverIndex.value]?._key ?? null
  })

  // ─── Load report ───────────────────────────────────────────────────────
  async function loadReport() {
    loading.value = true
    const data = await reportsApi.getReport(reportId.value, projectId.value)
    if (!_mounted) return
    if (!data) {
      loading.value = false
      return
    }
    report.value = data
    draftName.value = data.name
    draftDescription.value = data.description ?? ''

    sections.value = (data.items ?? []).map((item: IReportItem, idx: number) => ({
      _key: nextKey(),
      id: item.id ?? null,
      item_type: (item.item_type as ReportItemTypeName) || 'dashboard',
      display_order: item.display_order ?? idx,
      ref_id: item.ref_id ?? null,
      payload: item.payload
        ? typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload
        : defaultPayload((item.item_type as ReportItemTypeName) || 'dashboard'),
      visible: true,
      selected: false,
    }))

    loading.value = false
    hasUnsavedChanges.value = false
  }

  // ─── Load / Save aliases ───────────────────────────────────────────────
  async function loadFromReport(rId?: number, pId?: number) {
    if (rId) reportId.value = rId
    if (pId) projectId.value = pId
    await loadReport()
  }

  async function saveToReport(rId?: number, pId?: number): Promise<boolean> {
    if (rId) reportId.value = rId
    if (pId) projectId.value = pId
    return save()
  }

  // ─── Section CRUD ──────────────────────────────────────────────────────
  function addSection(type: ReportItemTypeName) {
    const section: BuilderSection = {
      _key: nextKey(),
      id: null,
      item_type: type,
      display_order: sections.value.length,
      ref_id: null,
      payload: defaultPayload(type),
      visible: true,
      selected: false,
    }
    sections.value.push(section)
    reindex()
    hasUnsavedChanges.value = true
    showItemPicker.value = false
    showTypePicker.value = false
    selectSection(section._key)
  }

  function removeSection(key: string) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx === -1) return
    sections.value.splice(idx, 1)
    if (selectedSectionKey.value === key) {
      selectedSectionKey.value = null
    }
    reindex()
    hasUnsavedChanges.value = true
  }

  function deleteSection(key: string) {
    removeSection(key)
  }

  function duplicateSection(key: string) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx === -1) return
    const original = sections.value[idx]
    const copy: BuilderSection = {
      ...original,
      _key: nextKey(),
      id: null,
      payload: JSON.parse(JSON.stringify(original.payload)),
    }
    sections.value.splice(idx + 1, 0, copy)
    reindex()
    hasUnsavedChanges.value = true
    selectSection(copy._key)
  }

  function toggleSectionVisibility(key: string) {
    const section = sections.value.find(s => s._key === key)
    if (section) {
      section.visible = !section.visible
      hasUnsavedChanges.value = true
    }
  }

  function selectSection(key: string | null) {
    sections.value.forEach(s => (s.selected = false))
    selectedSectionKey.value = key
    if (key) {
      const section = sections.value.find(s => s._key === key)
      if (section) section.selected = true
    }
  }

  function deselectSection() {
    selectSection(null)
  }

  // ─── Payload updates ──────────────────────────────────────────────────
  function updateSectionPayload(key: string, newPayload: Record<string, any>) {
    const section = sections.value.find(s => s._key === key)
    if (section) {
      section.payload = { ...section.payload, ...newPayload }
      hasUnsavedChanges.value = true
    }
  }

  function updateSectionRefId(key: string, refId: number | null) {
    const section = sections.value.find(s => s._key === key)
    if (section) {
      section.ref_id = refId
      hasUnsavedChanges.value = true
    }
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────
  function onDragStart(index: number, event: DragEvent) {
    dragIndex.value = index
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  function onDragOver(index: number, event: DragEvent) {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
    dragOverIndex.value = index
  }

  function onDragLeave(_index: number) { /* noop */ }

  function onDrop(index: number) {
    if (dragIndex.value === null || dragIndex.value === index) {
      dragIndex.value = null
      dragOverIndex.value = null
      return
    }
    const [moved] = sections.value.splice(dragIndex.value, 1)
    sections.value.splice(index, 0, moved)
    reindex()
    dragIndex.value = null
    dragOverIndex.value = null
    hasUnsavedChanges.value = true
  }

  function onDragEnd() {
    dragIndex.value = null
    dragOverIndex.value = null
  }

  // Key-based drag wrappers for component integration
  function handleDragStart(key: string, event: DragEvent) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx !== -1) onDragStart(idx, event)
  }

  function handleDragOver(key: string, event: DragEvent) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx !== -1) onDragOver(idx, event)
  }

  function handleDragLeave(_key: string) { onDragLeave(0) }

  function handleDrop(key: string) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx !== -1) onDrop(idx)
  }

  function handleCanvasDrop(event: DragEvent) {
    // Canvas drop — internal drag handled by handleDrop
    void event
  }

  function handleDragEndWrapper() { onDragEnd() }

  function handleTypeSelected(type: string) {
    addSection(type as ReportItemTypeName)
  }

  function moveSection(key: string, direction: -1 | 1) {
    if (direction === -1) moveSectionUp(key)
    else moveSectionDown(key)
  }

  function moveSectionUp(key: string) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx <= 0) return
    const temp = sections.value[idx]
    sections.value[idx] = sections.value[idx - 1]
    sections.value[idx - 1] = temp
    reindex()
    hasUnsavedChanges.value = true
  }

  function moveSectionDown(key: string) {
    const idx = sections.value.findIndex(s => s._key === key)
    if (idx === -1 || idx >= sections.value.length - 1) return
    const temp = sections.value[idx]
    sections.value[idx] = sections.value[idx + 1]
    sections.value[idx + 1] = temp
    reindex()
    hasUnsavedChanges.value = true
  }

  function reindex() {
    sections.value.forEach((s, i) => { s.display_order = i })
  }

  // ─── Persistence ──────────────────────────────────────────────────────
  async function save(): Promise<boolean> {
    if (!report.value) return false
    saving.value = true

    const itemsPayload: IReportItem[] = sections.value
      .filter(s => s.visible)
      .map((s, idx) => ({
        id: s.id ?? undefined,
        item_type: s.item_type,
        ref_id: s.ref_id,
        display_order: idx,
        payload: s.payload,
      }))

    const [metaOk, itemsOk] = await Promise.all([
      reportsApi.updateReport(report.value.id, projectId.value, {
        name: draftName.value.trim() || report.value.name,
        description: draftDescription.value.trim() || null,
      }),
      reportsApi.updateItems(report.value.id, projectId.value, itemsPayload),
    ])

    saving.value = false

    if (metaOk && itemsOk) {
      report.value = {
        ...report.value,
        name: draftName.value.trim() || report.value.name,
        description: draftDescription.value.trim() || null,
      }
      hasUnsavedChanges.value = false
      await loadReport()
      return true
    }
    return false
  }

  async function publish(): Promise<boolean> {
    if (!report.value) return false
    await save()
    const ok = await reportsApi.publishReport(report.value.id, projectId.value)
    if (ok) {
      report.value = { ...report.value, status: 'published' }
    }
    return ok
  }

  // ─── Auto-save ────────────────────────────────────────────────────────
  function startAutoSave() {
    _autoSaveInterval = setInterval(async () => {
      if (hasUnsavedChanges.value && !saving.value && _mounted) {
        await save()
      }
    }, 30_000)
  }

  function stopAutoSave() {
    if (_autoSaveInterval) {
      clearInterval(_autoSaveInterval)
      _autoSaveInterval = null
    }
  }

  function init() {
    _mounted = true
    loadReport()
    startAutoSave()
  }

  function destroy() {
    _mounted = false
    stopAutoSave()
  }

  return {
    // State
    report,
    sections,
    loading,
    saving,
    hasUnsavedChanges,
    previewMode,
    showItemPicker,
    showTypePicker,
    draftName,
    draftDescription,
    selectedSectionKey,
    selectedSection,
    canSave,
    itemTypes,
    isDragging,
    dragKey,
    dropIndicator,

    // Drag state
    dragIndex,
    dragOverIndex,

    // Actions
    loadReport,
    save,
    publish,
    init,
    destroy,

    // Load / Save aliases
    loadFromReport,
    saveToReport,

    // Section CRUD
    addSection,
    removeSection,
    deleteSection,
    duplicateSection,
    toggleSectionVisibility,
    selectSection,
    deselectSection,
    updateSectionPayload,
    updateSectionRefId,

    // Type picker bridge
    handleTypeSelected,

    // Drag & Drop (index-based)
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,

    // Drag & Drop (key-based, for component integration)
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleCanvasDrop,
    handleDragEnd: handleDragEndWrapper,
    moveSection,
    moveSectionUp,
    moveSectionDown,

    // Types
    REPORT_ITEM_TYPES,
  }
}