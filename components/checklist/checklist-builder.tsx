'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Type, HelpCircle, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChecklistItem {
  id?: string
  type: 'title' | 'question'
  ref?: string
  auditQuestion?: string
  complianceCriteria?: string
  docRef?: string
  content: string // For title content
  order: number
  parentId?: string | null
}

interface ChecklistBuilderProps {
  checklistId: string
  onSave?: () => void
}

export const ChecklistBuilder = ({ checklistId, onSave }: ChecklistBuilderProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [checklistType, setChecklistType] = useState<'Internal' | 'External'>('Internal')
  const [version, setVersion] = useState('1.0')
  const [changeLog, setChangeLog] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const isSavingRef = useRef(false) // Use ref to prevent race conditions
  const isNew = checklistId === 'new'

  useEffect(() => {
    if (!isNew) {
      fetchChecklist()
    } else {
      setLoading(false)
    }
  }, [checklistId, isNew])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy selected rows with Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedRows.length > 0) {
        const activeElement = document.activeElement
        // Don't copy if user is typing in an input/textarea
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }
        e.preventDefault()
        handleCopyRows(selectedRows)
      }
      // Delete selected rows with Delete key
      if (e.key === 'Delete' && selectedRows.length > 0) {
        const activeElement = document.activeElement
        // Don't delete if user is typing in an input/textarea
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }
        e.preventDefault()
        const sortedIndices = [...selectedRows].sort((a, b) => b - a)
        sortedIndices.forEach(index => {
          const newItems = items.filter((_, i) => i !== index)
          newItems.forEach((item, idx) => {
            item.order = idx
          })
          setItems(newItems)
        })
        setSelectedRows([])
      }
      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedRows([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRows, items, checklistType])

  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/checklists/${checklistId}`)
      if (res.ok) {
        const data = await res.json()
        setName(data.name || '')
        setDescription(data.description || '')
        setType(data.type || '')
        setChecklistType(data.checklistType || 'Internal')
        setVersion(data.version || '1.0')
        const mappedItems: ChecklistItem[] = (data.items || []).map((item: any) => ({
          id: item.id,
          type: item.type,
          ref: item.ref || '',
          auditQuestion: item.auditQuestion || '',
          complianceCriteria: item.complianceCriteria || '',
          docRef: item.docRef || '',
          content: item.content || '',
          order: item.order,
          parentId: item.parentId,
        }))
        setItems(mappedItems)
      }
    } catch (error) {
      console.error('Failed to fetch checklist:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Prevent multiple simultaneous saves
    if (isSavingRef.current || saving) {
      return
    }

    if (!name.trim()) {
      alert('Please enter a checklist name')
      return
    }

    isSavingRef.current = true
    setSaving(true)
    try {
      // Rebuild hierarchy - questions belong to the nearest title above them
      const itemsToSave: ChecklistItem[] = []
      const titleMap = new Map<number, string>() // Map order index to title ID

      items.forEach((item, index) => {
        if (item.type === 'title') {
          // Store the title ID for questions below
          titleMap.set(index, item.id || `temp-title-${index}`)
          itemsToSave.push({
            ...item,
            id: item.id || `temp-title-${index}`,
            order: index,
            parentId: null,
            ref: undefined,
            auditQuestion: undefined,
            complianceCriteria: undefined,
            docRef: undefined,
          })
        } else {
          // Find the nearest title above this question
          let parentId: string | null = null
          for (let i = index - 1; i >= 0; i--) {
            if (titleMap.has(i)) {
              parentId = titleMap.get(i) || null
              break
            }
          }
            itemsToSave.push({
            ...item,
            order: index,
            parentId: parentId,
            content: '', // Don't save content for questions
          })
        }
      })

      if (isNew) {
        // Create new checklist
        const res = await fetch('/api/checklists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            type,
            items: itemsToSave,
          }),
        })

        if (res.ok) {
          onSave?.()
        } else {
          const errorData = await res.json()
          alert(`Failed to create checklist: ${errorData.error || 'Unknown error'}`)
        }
      } else {
        // Update existing checklist
        const res = await fetch(`/api/checklists/${checklistId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            type,
            items: itemsToSave,
            changeLog: changeLog || undefined,
          }),
        })

        if (res.ok) {
          const savedData = await res.json()
          if (savedData.version) {
            setVersion(savedData.version)
          }
          setChangeLog('') // Reset change log after successful save
          onSave?.()
        } else {
          const errorData = await res.json()
          alert(`Failed to save checklist: ${errorData.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('Failed to save checklist:', error)
      alert('Failed to save checklist')
    } finally {
      setSaving(false)
      isSavingRef.current = false
    }
  }

  const handlePaste = (e: React.ClipboardEvent, rowIndex?: number) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const lines = pastedData.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) return

    // Determine which row to fill - use rowIndex if provided, otherwise use focusedRowIndex
    const targetRowIndex = rowIndex !== undefined ? rowIndex : (focusedRowIndex !== null ? focusedRowIndex : null)

    // If pasting on a specific row and we have multiple lines, always create new rows
    // If only one line, fill the current row
    if (targetRowIndex !== null && targetRowIndex < items.length && lines.length === 1) {
      const firstLine = lines[0]
      const columns = firstLine.split(/\t/).map(col => col.trim())
      
      if (columns.length > 0) {
        const item = items[targetRowIndex]
        const firstCol = columns[0] || ''
        const hasMultipleColumns = columns.length >= 2
        const looksLikeRef = /^[\d\.]+$/.test(firstCol) || /^[A-Z\d\.\-]+$/.test(firstCol)
        
        // Fill the current row if we have multiple columns (it's question data)
        if (hasMultipleColumns) {
          const updatedItems = [...items]
          updatedItems[targetRowIndex] = {
            ...item,
            type: 'question', // Ensure it's a question type
            ref: looksLikeRef ? firstCol : (item.ref || ''),
            auditQuestion: columns[1] || columns[0] || '',
            complianceCriteria: columns[2] || '',
            docRef: checklistType === 'External' ? (columns[3] || '') : '',
          }
          setItems(updatedItems)
          return
        }
      }
    }

    // For multiple lines or pasting in empty area, create new rows
    const insertIndex = targetRowIndex !== null && targetRowIndex < items.length ? targetRowIndex + 1 : items.length
    handlePasteLines(lines, insertIndex)
  }

  const handlePasteLines = (lines: string[], insertIndex: number) => {
    const newItems: ChecklistItem[] = []

    lines.forEach((line, lineIndex) => {
      // Split by tab (Excel/Google Sheets)
      const columns = line.split(/\t/).map(col => col.trim())
      
      if (columns.length === 0 || columns.every(col => !col)) return

      // Better title detection:
      const firstCol = columns[0] || ''
      const hasMultipleColumns = columns.length >= 2
      const looksLikeRef = /^[\d\.]+$/.test(firstCol) || /^[A-Z\d\.\-]+$/.test(firstCol)
      const isAllCapsShort = /^[A-Z\s]+$/.test(firstCol) && firstCol.length < 50 && firstCol.length > 0
      
      // It's a question if:
      // - Has 2+ columns AND first column looks like a ref (e.g., "9.2.1")
      // - Has 2+ columns AND second column has substantial content
      // Otherwise, if it's a single short column that's all caps, treat as title
      const isTitle = !hasMultipleColumns && (isAllCapsShort || firstCol.length < 30)

      const newItem: ChecklistItem = {
        type: isTitle ? 'title' : 'question',
        content: isTitle ? firstCol : '',
        ref: isTitle ? '' : firstCol,
        auditQuestion: isTitle ? '' : (columns[1] || ''),
        complianceCriteria: isTitle ? '' : (columns[2] || ''),
        docRef: isTitle ? '' : (checklistType === 'External' ? (columns[3] || '') : ''),
        order: insertIndex + lineIndex,
        parentId: null,
      }

      // If it's a question, find the nearest title above
      if (!isTitle) {
        // First check new items
        for (let i = newItems.length - 1; i >= 0; i--) {
          if (newItems[i].type === 'title') {
            newItem.parentId = newItems[i].id || null
            break
          }
        }
        // If no title in new items, check existing items
        if (!newItem.parentId && items.length > 0) {
          const checkIndex = insertIndex > 0 ? insertIndex - 1 : items.length - 1
          for (let i = checkIndex; i >= 0; i--) {
            if (items[i].type === 'title') {
              newItem.parentId = items[i].id || null
              break
            }
          }
        }
      }

      newItems.push(newItem)
    })

    if (newItems.length > 0) {
      const updatedItems = [...items]
      updatedItems.splice(insertIndex, 0, ...newItems)
      // Update orders
      updatedItems.forEach((item, idx) => {
        item.order = idx
      })
      setItems(updatedItems)
    }
  }

  const handleAddRow = (type: 'title' | 'question', afterIndex?: number) => {
    const newItem: ChecklistItem = {
      type,
      content: '',
      ref: '',
      auditQuestion: '',
      complianceCriteria: '',
      docRef: '',
      order: afterIndex !== undefined ? afterIndex + 1 : items.length,
      parentId: null,
    }

    if (afterIndex !== undefined) {
      const newItems = [...items]
      newItems.splice(afterIndex + 1, 0, newItem)
      // Update orders
      newItems.forEach((item, idx) => {
        item.order = idx
      })
      // If it's a question, find the nearest title above
      if (type === 'question') {
        for (let i = afterIndex; i >= 0; i--) {
          if (newItems[i].type === 'title') {
            newItem.parentId = newItems[i].id || null
            break
          }
        }
      }
      setItems(newItems)
    } else {
      // If it's a question, find the nearest title above
      if (type === 'question' && items.length > 0) {
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].type === 'title') {
            newItem.parentId = items[i].id || null
            break
          }
        }
      }
      setItems([...items, newItem])
    }
  }

  const handleDeleteRow = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    // Update orders
    newItems.forEach((item, idx) => {
      item.order = idx
    })
    setItems(newItems)
    setSelectedRows([])
  }

  const handleCopyRows = (indices: number[]) => {
    if (indices.length === 0) return
    
    const rowsToCopy = indices
      .sort((a, b) => a - b)
      .map(index => items[index])
      .filter(Boolean)
    
    if (rowsToCopy.length === 0) return

    // Format as tab-separated values for pasting
    const textToCopy = rowsToCopy.map(item => {
      if (item.type === 'title') {
        return item.content
      } else {
        const parts = [
          item.ref || '',
          item.auditQuestion || '',
          item.complianceCriteria || '',
        ]
        if (checklistType === 'External') {
          parts.push(item.docRef || '')
        }
        return parts.join('\t')
      }
    }).join('\n')

    navigator.clipboard.writeText(textToCopy)
    setSelectedRows([])
  }

  const handleSelectRow = (index: number, e: React.MouseEvent) => {
    // Don't select if clicking on input/textarea/button
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.closest('button')) {
      return
    }

    if (e.ctrlKey || e.metaKey) {
      // Multi-select with Ctrl/Cmd
      setSelectedRows(prev => 
        prev.includes(index) 
          ? prev.filter(i => i !== index)
          : [...prev, index]
      )
    } else if (e.shiftKey && selectedRows.length > 0) {
      // Range select with Shift
      const lastSelected = selectedRows[selectedRows.length - 1]
      const start = Math.min(lastSelected, index)
      const end = Math.max(lastSelected, index)
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      setSelectedRows(Array.from(new Set([...selectedRows, ...range])))
    } else {
      // Single select
      setSelectedRows([index])
    }
  }

  const handleContentChange = (index: number, content: string) => {
    const newItems = [...items]
    newItems[index].content = content
    setItems(newItems)
  }

  const handleFieldChange = (
    index: number,
    field: 'ref' | 'auditQuestion' | 'complianceCriteria' | 'docRef',
    value: string
  ) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleTypeChange = (index: number, type: 'title' | 'question') => {
    const newItems = [...items]
    newItems[index].type = type
    // If changing to question and there's a title before it, set parentId
    if (type === 'question') {
      let parentId: string | null = null
      for (let i = index - 1; i >= 0; i--) {
        if (newItems[i].type === 'title') {
          parentId = newItems[i].id || null
          break
        }
      }
      newItems[index].parentId = parentId
    } else {
      newItems[index].parentId = null
    }
    setItems(newItems)
  }

  if (loading) {
    return <div className="p-4 text-center">Loading checklist...</div>
  }

  return (
      <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="name">Checklist Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., AMO Audit Checklist"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Category</Label>
          <Input
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g., AMO"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checklistType">Type *</Label>
          <Select
            value={checklistType}
            onValueChange={(value: 'Internal' | 'External') => setChecklistType(value)}
          >
            <SelectTrigger id="checklistType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Internal">Internal</SelectItem>
              <SelectItem value="External">External</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this checklist"
          />
        </div>
        {!isNew && (
          <div className="space-y-2">
            <Label htmlFor="version">Current Version</Label>
            <Input
              id="version"
              value={version}
              disabled
              className="bg-muted"
            />
          </div>
        )}
      </div>
      {!isNew && (
        <div className="space-y-2">
          <Label htmlFor="changeLog">Change Log (Optional)</Label>
          <Textarea
            id="changeLog"
            value={changeLog}
            onChange={(e) => setChangeLog(e.target.value)}
            placeholder="Describe what changed in this revision..."
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Version will automatically increment when you save changes to checklist items.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div>
          <h3 className="text-lg font-semibold">Checklist Items</h3>
          {selectedRows.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {selectedRows.length} row(s) selected. Press Ctrl+C to copy or Delete to remove.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyRows(selectedRows)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy {selectedRows.length} Row(s)
            </Button>
          )}
          <Button 
            type="button"
            onClick={handleSave} 
            disabled={saving || isSavingRef.current}
          >
            {saving ? 'Saving...' : isNew ? 'Create Checklist' : 'Save Checklist'}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table 
          className="w-full border-collapse"
          onPaste={(e) => handlePaste(e)}
        >
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium border border-border w-24">
                {checklistType === 'External' ? 'Checklist ID' : 'Ref'}
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium border border-border w-1/3">Audit Question / Check Item</th>
              <th className="px-4 py-2 text-left text-sm font-medium border border-border w-1/3">Compliance Criteria</th>
              {checklistType === 'External' && (
                <th className="px-4 py-2 text-left text-sm font-medium border border-border w-32">Doc Ref</th>
              )}
              <th className="px-1 py-2 text-center text-sm font-medium border border-border w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td 
                  colSpan={checklistType === 'External' ? 5 : 4} 
                  className="px-4 py-8 text-center text-muted-foreground border border-border"
                  onPaste={(e) => handlePaste(e)}
                >
                  No checklist items yet. Click "Add Title" or "Add Question" to get started, or paste data from Excel/table.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={index}
                  className={cn(
                    'border-b border-border hover:bg-muted/50 cursor-pointer',
                    item.type === 'title' && 'bg-muted/30',
                    selectedRows.includes(index) && 'bg-primary/10 ring-2 ring-primary'
                  )}
                  onClick={(e) => handleSelectRow(index, e)}
                  onFocus={() => setFocusedRowIndex(index)}
                  onPaste={(e) => handlePaste(e, index)}
                >
                  {item.type === 'title' ? (
                    <>
                      <td colSpan={checklistType === 'External' ? 4 : 3} className="px-4 py-2 border border-border">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handleTypeChange(
                                index,
                                item.type === 'title' ? 'question' : 'title'
                              )
                            }
                            className="h-8"
                          >
                            <Type className="h-4 w-4" />
                          </Button>
                          <Input
                            value={item.content}
                            onChange={(e) => handleContentChange(index, e.target.value)}
                            placeholder="Enter title..."
                            className="font-semibold flex-1"
                          />
                        </div>
                      </td>
                      <td className="px-1 py-2 border border-border">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow('title', index)}
                            className="h-7 px-1.5 text-xs"
                            aria-label="Add title after this row"
                            title="Add Title"
                          >
                            <Type className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow('question', index)}
                            className="h-7 px-1.5 text-xs"
                            aria-label="Add question after this row"
                            title="Add Question"
                          >
                            <HelpCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRow(index)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            aria-label="Delete row"
                            title="Delete Row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 border border-border">
                        <Input
                          value={item.ref || ''}
                          onChange={(e) => handleFieldChange(index, 'ref', e.target.value)}
                          onFocus={() => setFocusedRowIndex(index)}
                          onPaste={(e) => handlePaste(e, index)}
                          placeholder={checklistType === 'External' ? 'Checklist ID' : 'Ref'}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-2 border border-border">
                        <Textarea
                          value={item.auditQuestion || ''}
                          onChange={(e) => handleFieldChange(index, 'auditQuestion', e.target.value)}
                          onFocus={() => setFocusedRowIndex(index)}
                          onPaste={(e) => handlePaste(e, index)}
                          placeholder="Audit Question / Check Item"
                          className="w-full min-h-[60px] resize-none"
                          rows={2}
                        />
                      </td>
                      <td className="px-4 py-2 border border-border">
                        <Textarea
                          value={item.complianceCriteria || ''}
                          onChange={(e) => handleFieldChange(index, 'complianceCriteria', e.target.value)}
                          onFocus={() => setFocusedRowIndex(index)}
                          onPaste={(e) => handlePaste(e, index)}
                          placeholder="Compliance Criteria"
                          className="w-full min-h-[60px] resize-none"
                          rows={2}
                        />
                      </td>
                      {checklistType === 'External' && (
                        <td className="px-4 py-2 border border-border">
                          <Textarea
                            value={item.docRef || ''}
                            onChange={(e) => handleFieldChange(index, 'docRef', e.target.value)}
                            placeholder="Doc Ref"
                            className="w-full min-h-[60px] resize-none"
                            rows={2}
                          />
                        </td>
                      )}
                      <td className="px-1 py-2 border border-border">
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow('title', index)}
                            className="h-7 px-1.5 text-xs"
                            aria-label="Add title after this row"
                            title="Add Title"
                          >
                            <Type className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddRow('question', index)}
                            className="h-7 px-1.5 text-xs"
                            aria-label="Add question after this row"
                            title="Add Question"
                          >
                            <HelpCircle className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRow(index)}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            aria-label="Delete row"
                            title="Delete Row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleAddRow('title')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Title
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAddRow('question')}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
        </div>
      )}
    </div>
  )
}
