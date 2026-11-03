"use client"

import { useEffect, useRef } from "react"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Underline,
} from "lucide-react"

interface NewsRichTextEditorProps {
  initialContent: string
  onChange: (content: string) => void
  disabled?: boolean
}

const allowedTags = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "span",
  "h2",
  "h3",
  "div",
])
const discardedTags = new Set([
  "iframe",
  "math",
  "object",
  "script",
  "style",
  "svg",
  "template",
])
const fontSizes = new Set(["12px", "14px", "16px", "18px", "24px", "32px"])
const formattedContentPattern =
  /<(?:p|br|strong|b|em|i|u|s|ul|ol|li|blockquote|span|h[23]|div)(?:\s|\/?>)/i

function appendSanitizedNodes(source: Node, destination: Node): void {
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      destination.appendChild(document.createTextNode(child.textContent ?? ""))
      continue
    }

    if (!(child instanceof HTMLElement)) {
      continue
    }

    const tagName = child.tagName.toLowerCase()
    if (discardedTags.has(tagName)) {
      continue
    }

    if (!allowedTags.has(tagName)) {
      appendSanitizedNodes(child, destination)
      continue
    }

    const cleanElement = document.createElement(tagName)
    if (tagName === "span") {
      const fontSize = child.style.fontSize
      if (fontSizes.has(fontSize)) {
        cleanElement.setAttribute("style", `font-size: ${fontSize}`)
      }
    }
    destination.appendChild(cleanElement)
    if (tagName !== "br") {
      appendSanitizedNodes(child, cleanElement)
    }
  }
}

function sanitizeEditorContent(content: string): string {
  const template = document.createElement("template")
  template.innerHTML = content

  const cleanTemplate = document.createElement("template")
  appendSanitizedNodes(template.content, cleanTemplate.content)
  return cleanTemplate.innerHTML
}

function getInitialEditorContent(content: string): string {
  if (!content) {
    return ""
  }

  if (formattedContentPattern.test(content)) {
    return sanitizeEditorContent(content)
  }

  const template = document.createElement("template")
  for (const paragraph of content.split(/\n\s*\n/)) {
    const element = document.createElement("p")
    for (const [index, line] of paragraph.split("\n").entries()) {
      if (index > 0) {
        element.appendChild(document.createElement("br"))
      }
      element.appendChild(document.createTextNode(line))
    }
    template.content.appendChild(element)
  }
  return template.innerHTML
}

export function NewsRichTextEditor({
  initialContent,
  onChange,
  disabled = false,
}: NewsRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = getInitialEditorContent(initialContent)
    }
  }, [initialContent])

  function rememberSelection() {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (
      selection?.rangeCount &&
      editor?.contains(selection.anchorNode) &&
      editor.contains(selection.focusNode)
    ) {
      selectionRef.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreSelection(): boolean {
    const editor = editorRef.current
    const range = selectionRef.current
    if (!editor || !range || !editor.contains(range.commonAncestorContainer)) {
      return false
    }

    editor.focus()
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    return true
  }

  function handleFormat(command: "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList") {
    if (!restoreSelection()) {
      editorRef.current?.focus()
    }
    document.execCommand(command, false)
    rememberSelection()
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  function handleFontSizeChange(fontSize: string) {
    if (!fontSizes.has(fontSize) || !restoreSelection()) {
      return
    }

    document.execCommand("fontSize", false, "7")
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
      const span = document.createElement("span")
      span.style.fontSize = fontSize
      while (font.firstChild) {
        span.appendChild(font.firstChild)
      }
      font.replaceWith(span)
    })
    rememberSelection()
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  function updateContent() {
    rememberSelection()
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const toolbarButtonClass =
    "inline-flex h-9 w-9 items-center justify-center rounded border border-gray-600 bg-[#1A1C1E] text-gray-200 hover:bg-[#34373C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <div className="overflow-hidden rounded-md border border-gray-600 bg-[#1A1C1E]">
      <div
        aria-label="Article formatting"
        className="flex flex-wrap items-center gap-2 border-b border-gray-600 p-2"
        role="toolbar"
      >
        <button
          type="button"
          aria-label="Bold"
          title="Bold"
          className={toolbarButtonClass}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleFormat("bold")}
        >
          <Bold aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Italic"
          title="Italic"
          className={toolbarButtonClass}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleFormat("italic")}
        >
          <Italic aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Underline"
          title="Underline"
          className={toolbarButtonClass}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleFormat("underline")}
        >
          <Underline aria-hidden="true" className="h-4 w-4" />
        </button>
        <span aria-hidden="true" className="mx-1 h-6 border-l border-gray-600" />
        <button
          type="button"
          aria-label="Bulleted list"
          title="Bulleted list"
          className={toolbarButtonClass}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleFormat("insertUnorderedList")}
        >
          <List aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Numbered list"
          title="Numbered list"
          className={toolbarButtonClass}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => handleFormat("insertOrderedList")}
        >
          <ListOrdered aria-hidden="true" className="h-4 w-4" />
        </button>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          Font size
          <select
            aria-label="Font size"
            defaultValue=""
            disabled={disabled}
            onChange={(event) => {
              handleFontSizeChange(event.currentTarget.value)
              event.currentTarget.value = ""
            }}
            className="h-9 rounded border border-gray-600 bg-[#1A1C1E] px-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <option value="" disabled>
              Select
            </option>
            <option value="12px">12 px</option>
            <option value="14px">14 px</option>
            <option value="16px">16 px</option>
            <option value="18px">18 px</option>
            <option value="24px">24 px</option>
            <option value="32px">32 px</option>
          </select>
        </label>
      </div>
      <div
        ref={editorRef}
        id="article-content"
        aria-label="Article content"
        aria-multiline="true"
        aria-required="true"
        contentEditable={!disabled}
        role="textbox"
        suppressContentEditableWarning
        onInput={updateContent}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        className="news-article-content min-h-72 px-3 py-3 text-white outline-none empty:before:text-gray-500 empty:before:content-['Write_your_article_here...']"
      />
      <p className="border-t border-gray-600 px-3 py-2 text-xs text-gray-500">
        Select text to format it. You can also use keyboard shortcuts like Ctrl+B and Ctrl+I.
      </p>
    </div>
  )
}
