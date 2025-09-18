import React, { useEffect, useMemo, useRef, useState } from "react";

// Single-file Notes app (React + Tailwind). Drop this into your project and render <NotesApp />.
// - LocalStorage persistence
// - New / delete / pin
// - Search notes by title/body
// - Autosave with small debounce
// - Responsive: sidebar + editor (like iPhone Notes)

export default function NotesApp() {
  const [notes, setNotes] = useState(() => loadNotes());
  const [selectedId, setSelectedId] = useState(() => notes[0]?.id || null);
  const [query, setQuery] = useState("");

  // Save to localStorage whenever notes change
  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  // Keyboard: Cmd/Ctrl+N => new note
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes]);

  const handleNew = () => {
    const id = cryptoRandomId();
    const now = Date.now();
    const newNote = { id, title: "", body: "", updatedAt: now, pinned: false };
    setNotes((prev) => [newNote, ...prev]);
    setSelectedId(id);
  };

  const handleDelete = (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (id === selectedId) {
      // pick next candidate
      const remaining = notes.filter((n) => n.id !== id);
      setSelectedId(remaining[0]?.id || null);
    }
  };

  const togglePin = (id) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n))
    );
  };

  const updateNote = (id, patch) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
    );
  };

  // Sorting: pinned first, then by updatedAt desc
  const sorted = useMemo(() => {
    return [...notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sorted;
    const q = query.toLowerCase();
    return sorted.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
    );
  }, [sorted, query]);

  const selected = notes.find((n) => n.id === selectedId) || null;

  return (
    <div className="h-screen w-full grid grid-cols-1 md:grid-cols-[320px_1fr] bg-neutral-100 text-neutral-900">
      {/* Sidebar */}
      <aside className="border-b md:border-b-0 md:border-r border-neutral-200 bg-white flex flex-col min-h-0">
        <div className="p-3 border-b border-neutral-200 flex gap-2 items-center">
          <button
            onClick={handleNew}
            className="px-3 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90 active:scale-[.98]"
          >
            New
          </button>
          <Search value={query} onChange={setQuery} />
        </div>

        <NoteList
          notes={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onDelete={handleDelete}
          onTogglePin={togglePin}
        />
      </aside>

      {/* Editor */}
      <main className="min-h-0 flex flex-col">
        {selected ? (
          <EditorPane
            key={selected.id}
            note={selected}
            onChange={(patch) => updateNote(selected.id, patch)}
            onDelete={() => handleDelete(selected.id)}
            onTogglePin={() => togglePin(selected.id)}
          />
        ) : (
          <EmptyState onCreate={handleNew} />
        )}
      </main>
    </div>
  );
}

function Search({ value, onChange }) {
  return (
    <div className="relative flex-1">
      <input
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        placeholder="Search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

function NoteList({ notes, selectedId, onSelect, onDelete, onTogglePin }) {
  return (
    <div className="flex-1 overflow-auto">
      {notes.length === 0 ? (
        <div className="p-6 text-sm text-neutral-500">No notes</div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {notes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => onSelect(n.id)}
                className={`w-full text-left px-4 py-3 hover:bg-neutral-50 focus:bg-neutral-50 ${(selectedId === n.id) ? "bg-neutral-100" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <span
                    title={n.pinned ? "Pinned" : "Pin"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(n.id);
                    }}
                    className={`select-none mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${n.pinned ? "bg-yellow-300 border-yellow-400" : "border-neutral-300 text-neutral-400 hover:text-neutral-600"}`}
                  >
                    {n.pinned ? "★" : "☆"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{n.title || "Untitled"}</p>
                      <time className="shrink-0 text-[11px] text-neutral-500">
                        {formatTime(n.updatedAt)}
                      </time>
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-1">
                      {n.body?.trim() || ""}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(n.id);
                    }}
                    className="text-neutral-400 hover:text-red-600"
                    title="Delete"
                    aria-label="Delete note"
                  >
                    ␡
                  </button>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EditorPane({ note, onChange, onDelete, onTogglePin }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePin}
            className={`px-2 py-1 rounded-lg text-sm border ${note.pinned ? "bg-yellow-200 border-yellow-300" : "border-neutral-200"}`}
            title={note.pinned ? "Unpin" : "Pin"}
          >
            {note.pinned ? "★ Pinned" : "☆ Pin"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <time className="text-xs text-neutral-500">{formatFull(note.updatedAt)}</time>
          <button
            onClick={onDelete}
            className="px-2 py-1 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      <NoteEditor
        title={note.title}
        body={note.body}
        onChange={onChange}
      />
    </div>
  );
}

function NoteEditor({ title, body, onChange }) {
  const [titleState, setTitleState] = useState(title || "");
  const [bodyState, setBodyState] = useState(body || "");
  const timer = useRef(null);

  // Debounced autosave
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange({ title: titleState, body: bodyState });
    }, 350);
    return () => clearTimeout(timer.current);
  }, [titleState, bodyState]);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="mx-auto max-w-3xl px-4 pb-24">
        <input
          className="w-full mt-6 text-2xl md:text-3xl font-semibold bg-transparent outline-none placeholder:text-neutral-400"
          placeholder="Title"
          value={titleState}
          onChange={(e) => setTitleState(e.target.value)}
        />
        <textarea
          className="w-full mt-4 h-[60vh] md:h-[70vh] leading-7 bg-transparent outline-none resize-none placeholder:text-neutral-400"
          placeholder="Start typing..."
          value={bodyState}
          onChange={(e) => setBodyState(e.target.value)}
        />
      </div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex-1 grid place-items-center">
      <div className="text-center">
        <p className="text-4xl">🗒️</p>
        <h2 className="mt-2 text-lg font-semibold">No note selected</h2>
        <p className="text-sm text-neutral-500">Create a new note to get started.</p>
        <button
          onClick={onCreate}
          className="mt-4 px-4 py-2 rounded-xl bg-black text-white text-sm hover:opacity-90"
        >
          New Note
        </button>
      </div>
    </div>
  );
}

// --- Utilities ---
const STORAGE_KEY = "notes.simple.v1";

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((n) => ({
      id: n.id || cryptoRandomId(),
      title: n.title || "",
      body: n.body || "",
      updatedAt: typeof n.updatedAt === "number" ? n.updatedAt : Date.now(),
      pinned: Boolean(n.pinned),
    }));
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {}
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString();
}

function formatFull(ts) {
  return new Date(ts).toLocaleString();
}
