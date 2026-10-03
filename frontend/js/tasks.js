// frontend/js/tasks.js
const { useState, useEffect, useRef } = React;

function TasksScreen({ user, onLogout }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ---------- Initial load ----------
    useEffect(() => {
        let cancelled = false;
        api.listTasks()
            .then((data) => {
                if (!cancelled) setTasks(data.tasks);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    // ---------- Add task ----------
    async function handleAdd(title, description) {
        // Optimistic: create a temp task with a fake id
        const tempId = `temp-${Date.now()}`;
        const optimistic = {
            id: tempId,
            title,
            description: description || null,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            _pending: true,
        };
        setTasks((prev) => [optimistic, ...prev]);

        try {
            const data = await api.createTask(title, description);
            // Replace temp with real
            setTasks((prev) =>
                prev.map((t) => (t.id === tempId ? data.task : t))
            );
        } catch (err) {
            // Rollback
            setTasks((prev) => prev.filter((t) => t.id !== tempId));
            setError(err.message);
        }
    }

    // ---------- Toggle completed ----------
    async function handleToggle(task) {
        const nextCompleted = !task.completed;

        // Optimistic update
        setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t))
        );

        try {
            const data = await api.updateTask(task.id, { completed: nextCompleted });
            setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
        } catch (err) {
            // Rollback
            setTasks((prev) =>
                prev.map((t) => (t.id === task.id ? { ...t, completed: task.completed } : t))
            );
            setError(err.message);
        }
    }

    // ---------- Update title / description ----------
    async function handleUpdate(id, patch) {
        // Snapshot for rollback
        const previous = tasks.find((t) => t.id === id);
        if (!previous) return;

        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

        try {
            const data = await api.updateTask(id, patch);
            setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
        } catch (err) {
            setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
            setError(err.message);
        }
    }

    // ---------- Delete ----------
    async function handleDelete(id) {
        const previous = tasks;
        setTasks((prev) => prev.filter((t) => t.id !== id));

        try {
            await api.deleteTask(id);
        } catch (err) {
            setTasks(previous);
            setError(err.message);
        }
    }

    // ---------- Render ----------
    return (
        <div className="app-shell">
            <header className="app-header">
                <div className="app-header-inner">
                    <h1 className="app-logo">Task Manager</h1>
                    <div className="app-user">
                        <span className="user-email">{user.email}</span>
                        <button className="btn-secondary" onClick={onLogout}>Log out</button>
                    </div>
                </div>
            </header>

            <main className="app-main">
                {error && (
                    <div className="error banner">
                        {error}
                        <button className="link" onClick={() => setError('')}>Dismiss</button>
                    </div>
                )}

                <AddTaskForm onAdd={handleAdd} />

                {loading ? (
                    <div className="loading-inline">Loading tasks…</div>
                ) : tasks.length === 0 ? (
                    <div className="empty">No tasks yet. Add one above to get started.</div>
                ) : (
                    <ul className="task-list">
                        {tasks.map((task) => (
                            <TaskItem
                                key={task.id}
                                task={task}
                                onToggle={() => handleToggle(task)}
                                onUpdate={(patch) => handleUpdate(task.id, patch)}
                                onDelete={() => handleDelete(task.id)}
                            />
                        ))}
                    </ul>
                )}
            </main>
        </div>
    );
}

// ============================================================
// Add task form
// ============================================================
function AddTaskForm({ onAdd }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [expanded, setExpanded] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const titleInput = useRef(null);

    async function handleSubmit(e) {
        e.preventDefault();
        const trimmed = title.trim();
        if (!trimmed) return;

        setSubmitting(true);
        await onAdd(trimmed, description.trim());
        setSubmitting(false);

        setTitle('');
        setDescription('');
        setExpanded(false);
        titleInput.current?.focus();
    }

    return (
        <form className="add-task" onSubmit={handleSubmit}>
            <div className="add-task-row">
                <input
                    ref={titleInput}
                    type="text"
                    className="add-task-title"
                    placeholder="What needs to be done?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onFocus={() => setExpanded(true)}
                />
                <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting || !title.trim()}
                >
                    {submitting ? '…' : 'Add'}
                </button>
            </div>

            {expanded && (
                <textarea
                    className="add-task-desc"
                    placeholder="Description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                />
            )}
        </form>
    );
}

// ============================================================
// Single task row
// ============================================================
function TaskItem({ task, onToggle, onUpdate, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(task.title);
    const [draftDesc, setDraftDesc] = useState(task.description || '');
    const [confirmingDelete, setConfirmingDelete] = useState(false);

    function startEdit() {
        setDraftTitle(task.title);
        setDraftDesc(task.description || '');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
    }

    function saveEdit() {
        const t = draftTitle.trim();
        if (!t) return;
        onUpdate({ title: t, description: draftDesc.trim() || null });
        setEditing(false);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
        if (e.key === 'Escape') cancelEdit();
    }

    if (editing) {
        return (
            <li className="task-item editing">
                <div className="task-edit">
                    <input
                        type="text"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        className="task-edit-title"
                    />
                    <textarea
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={2}
                        className="task-edit-desc"
                        placeholder="Description (optional)"
                    />
                    <div className="task-edit-actions">
                        <button className="btn-primary" onClick={saveEdit} disabled={!draftTitle.trim()}>
                            Save
                        </button>
                        <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                    </div>
                </div>
            </li>
        );
    }

    return (
        <li className={`task-item ${task.completed ? 'completed' : ''} ${task._pending ? 'pending' : ''}`}>
            <input
                type="checkbox"
                className="task-check"
                checked={task.completed}
                onChange={onToggle}
                disabled={task._pending}
            />

            <div className="task-body" onDoubleClick={startEdit}>
                <div className="task-title">{task.title}</div>
                {task.description && <div className="task-desc">{task.description}</div>}
            </div>

            <div className="task-actions">
                {confirmingDelete ? (
                    <>
                        <button className="btn-danger" onClick={() => { onDelete(); }}>
                            Delete
                        </button>
                        <button className="btn-secondary" onClick={() => setConfirmingDelete(false)}>
                            Cancel
                        </button>
                    </>
                ) : (
                    <>
                        <button className="btn-icon" title="Edit" onClick={startEdit} disabled={task._pending}>
                            ✎
                        </button>
                        <button className="btn-icon danger" title="Delete" onClick={() => setConfirmingDelete(true)} disabled={task._pending}>
                            🗑
                        </button>
                    </>
                )}
            </div>
        </li>
    );
}