'use client'

import { useEffect } from 'react'
import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SmsTiptapEditorProps = {
  content: string
  onChange: (html: string) => void
  editable?: boolean
  placeholder?: string
  className?: string
}

export const SmsTiptapEditor = ({
  content,
  onChange,
  editable = true,
  placeholder = 'Start typing…',
  className,
}: SmsTiptapEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'max-w-none min-h-[200px] px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current === content) return
    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-input bg-muted/30 min-h-[200px] animate-pulse',
          className
        )}
        aria-hidden
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background overflow-hidden',
        !editable && 'opacity-90',
        className
      )}
    >
      {editable ? (
        <div
          className="flex flex-wrap gap-1 border-b border-input bg-muted/40 p-1.5"
          role="toolbar"
          aria-label="Text formatting"
        >
          <Button
            type="button"
            variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="Bold"
            aria-pressed={editor.isActive('bold')}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="Italic"
            aria-pressed={editor.isActive('italic')}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="Bullet list"
            aria-pressed={editor.isActive('bulletList')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="Numbered list"
            aria-pressed={editor.isActive('orderedList')}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
