'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ChecklistBuilder } from '@/components/checklist/checklist-builder'

const ChecklistsPage = () => {
  const [checklists, setChecklists] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    fetchChecklists()
  }, [])

  const fetchChecklists = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/checklists', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setChecklists(data)
      }
    } catch (error) {
      console.error('Failed to fetch checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/checklists/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        fetchChecklists()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete checklist')
      }
    } catch (error) {
      console.error('Failed to delete checklist:', error)
      alert('Failed to delete checklist')
    }
  }

  const handleEdit = (id: string) => {
    setSelectedChecklist(id)
    setEditDialogOpen(true)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 animate-pulse">
          <div className="mb-8 h-10 w-56 rounded bg-muted" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Checklists</h1>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Checklist
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Checklist</DialogTitle>
              </DialogHeader>
              <ChecklistBuilder
                checklistId="new"
                onSave={() => {
                  setCreateDialogOpen(false)
                  fetchChecklists()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checklists.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No checklists created yet
                </p>
              </CardContent>
            </Card>
          ) : (
            checklists.map((checklist) => (
              <Card key={checklist.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <CardTitle className="text-lg truncate">{checklist.name}</CardTitle>
                        <Badge variant="outline" className="font-medium shrink-0 bg-background border-primary/20">
                          v{checklist.version || '1.0'}
                        </Badge>
                      </div>
                      {checklist.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {checklist.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">
                          Created: {checklist.createdAt ? new Date(checklist.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </span>
                        {checklist.updatedAt && checklist.updatedAt !== checklist.createdAt && (
                          <span className="whitespace-nowrap">
                            • Updated: {new Date(checklist.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {checklist.type && (
                      <Badge variant="secondary" className="shrink-0">{checklist.type}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Items:</span>
                      <span className="font-medium">
                        {checklist.items?.length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Used in:</span>
                      <span className="font-medium">
                        {checklist._count?.audits || 0} audit(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(checklist.id)}
                        className="flex-1"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(checklist.id, checklist.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Checklist</DialogTitle>
              <DialogDescription>
                Update the checklist template
              </DialogDescription>
            </DialogHeader>
            {selectedChecklist && (
              <ChecklistBuilder
                checklistId={selectedChecklist}
                onSave={() => {
                  setEditDialogOpen(false)
                  setSelectedChecklist(null)
                  fetchChecklists()
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

export default ChecklistsPage
