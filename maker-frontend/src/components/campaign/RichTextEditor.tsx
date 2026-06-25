import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className={`px-2 py-1 rounded text-xs font-medium transition-all ${
        active
          ? 'bg-[var(--accent)] text-white'
          : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-raised)]'
      }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({ value, onChange, placeholder = 'Escreva aqui…', minHeight = 160 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[inherit] px-4 py-3 text-sm text-[var(--ink)] leading-relaxed prose prose-invert max-w-none',
      },
    },
  })

  if (!editor) return null

  return (
    <div
      className="border border-[var(--line)] rounded-lg overflow-hidden bg-[var(--surface-raised)] focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all"
      style={{ '--tw-prose-invert-body': 'var(--ink-soft)' } as React.CSSProperties}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--line)] bg-[var(--surface)]">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
          <span className="line-through">S</span>
        </ToolbarButton>
        <div className="w-px h-4 bg-[var(--line)] mx-1" />
        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          ≡
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          1.
        </ToolbarButton>
        <div className="w-px h-4 bg-[var(--line)] mx-1" />
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => {
            const url = window.prompt('URL do link:', editor.getAttributes('link').href)
            if (url === null) return
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            }
          }}
          title="Link"
        >
          ⌥
        </ToolbarButton>
        <div className="flex-1" />
        <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Limpar formatação">
          ✕
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
