import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Code,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Palette,
} from "lucide-react";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const STYLE_TAG_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;

function extractStyleTags(html: string): { styles: string; body: string } {
  const matches = html.match(STYLE_TAG_REGEX);
  const styles = matches ? matches.join("\n") : "";
  const body = html.replace(STYLE_TAG_REGEX, "").trim();
  return { styles, body };
}

export function TiptapEditor({
  content,
  onChange,
  placeholder: _placeholder = "Inhalt schreiben...",
  className = "",
}: TiptapEditorProps) {
  const { styles: initialStyles, body: initialBody } = useMemo(
    () => extractStyleTags(content),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const styleTagsRef = useRef(initialStyles);
  const hasStyleTags = Boolean(styleTagsRef.current);
  const [isHtmlMode, setIsHtmlMode] = useState(hasStyleTags);
  const [htmlSource, setHtmlSource] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline hover:text-blue-800",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg",
        },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: initialBody,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const fullHtml = styleTagsRef.current
        ? styleTagsRef.current + "\n" + html
        : html;
      onChange(fullHtml);
      if (!isHtmlMode) {
        setHtmlSource(fullHtml);
      }
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl max-w-none focus:outline-none min-h-[200px] p-4 ${className}`,
      },
    },
  });

  useEffect(() => {
    setHtmlSource(content);
    const { styles } = extractStyleTags(content);
    styleTagsRef.current = styles;
  }, [content]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL eingeben:", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;

    const url = window.prompt("Bild-URL eingeben:");
    if (!url) return;

    const alt = window.prompt("Alt-Text (optional):", "") || "";
    editor.chain().focus().setImage({ src: url, alt }).run();
  }, [editor]);

  const setColor = useCallback(() => {
    if (!editor) return;
    const color = window.prompt(
      "Farbe eingeben (z.B. #ff0000, red):",
      "#000000"
    );
    if (!color) return;
    editor.chain().focus().setColor(color).run();
  }, [editor]);

  const toggleHtmlMode = useCallback(() => {
    if (!editor) return;

    if (isHtmlMode) {
      const { styles, body } = extractStyleTags(htmlSource);
      styleTagsRef.current = styles;
      editor.commands.setContent(body, { emitUpdate: false });
      onChange(htmlSource);
    } else {
      const editorHtml = editor.getHTML();
      const fullHtml = styleTagsRef.current
        ? styleTagsRef.current + "\n" + editorHtml
        : editorHtml;
      setHtmlSource(fullHtml);
    }

    setIsHtmlMode(!isHtmlMode);
  }, [editor, isHtmlMode, htmlSource, onChange]);

  const handleHtmlChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newHtml = e.target.value;
      setHtmlSource(newHtml);
      onChange(newHtml);
    },
    [onChange]
  );

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-gray-50">
        {!isHtmlMode && (
          <>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 1 })
                  ? "secondary"
                  : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              title="Überschrift 1"
            >
              <Heading1 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 2 })
                  ? "secondary"
                  : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              title="Überschrift 2"
            >
              <Heading2 className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("heading", { level: 3 })
                  ? "secondary"
                  : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              title="Überschrift 3"
            >
              <Heading3 className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant={editor.isActive("bold") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Fett"
            >
              <Bold className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("italic") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Kursiv"
            >
              <Italic className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("underline") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Unterstrichen"
            >
              <UnderlineIcon className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={editor.isActive("highlight") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Hervorheben"
            >
              <Highlighter className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={setColor}
              title="Textfarbe"
            >
              <Palette className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant={
                editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              title="Linksbündig"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive({ textAlign: "center" })
                  ? "secondary"
                  : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              title="Zentriert"
            >
              <AlignCenter className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              title="Rechtsbündig"
            >
              <AlignRight className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant={
                editor.isActive("bulletList") ? "secondary" : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Aufzählung"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("orderedList") ? "secondary" : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Nummerierte Liste"
            >
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant={
                editor.isActive("blockquote") ? "secondary" : "ghost"
              }
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Zitat"
            >
              <Quote className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant={editor.isActive("link") ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={setLink}
              title="Link"
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={addImage}
              title="Bild einfügen"
            >
              <ImagePlus className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              title="Rückgängig"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              title="Wiederholen"
            >
              <Redo className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-gray-300 mx-1" />
          </>
        )}

        {/* HTML Toggle */}
        <Button
          type="button"
          variant={isHtmlMode ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 ml-auto"
          onClick={toggleHtmlMode}
          title={isHtmlMode ? "Zurück zum Editor" : "HTML bearbeiten"}
        >
          <Code className="w-4 h-4" />
          <span className="text-xs">{isHtmlMode ? "Editor" : "HTML"}</span>
        </Button>
      </div>

      {/* Editor or HTML Source */}
      {isHtmlMode ? (
        <textarea
          ref={textareaRef}
          value={htmlSource}
          onChange={handleHtmlChange}
          className="w-full min-h-[200px] max-h-[600px] p-4 font-mono text-sm bg-gray-900 text-green-400 focus:outline-none resize-y"
          spellCheck={false}
        />
      ) : (
        <EditorContent
          editor={editor}
          className="min-h-[200px] max-h-[600px] overflow-y-auto"
        />
      )}
    </div>
  );
}
