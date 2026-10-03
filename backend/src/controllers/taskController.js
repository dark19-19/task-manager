// backend/src/controllers/taskController.js
import pool from '../db/pool.js';

// ---------- GET /api/tasks ----------
export async function listTasks(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, title, description, completed, created_at, updated_at
       FROM tasks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('listTasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

// ---------- POST /api/tasks ----------
export async function createTask(req, res) {
  try {
    const { title, description } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description)
       VALUES ($1, $2, $3)
       RETURNING id, title, description, completed, created_at, updated_at`,
      [req.user.id, title.trim(), description?.trim() || null]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    console.error('createTask error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
}

// ---------- PUT /api/tasks/:id ----------
export async function updateTask(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const { title, description, completed } = req.body;

    // Build the update dynamically so we only touch provided fields
    const fields = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      fields.push(`title = $${idx++}`);
      values.push(title.trim());
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(description === null ? null : description.trim() || null);
    }
    if (completed !== undefined) {
      if (typeof completed !== 'boolean') {
        return res.status(400).json({ error: 'completed must be a boolean' });
      }
      fields.push(`completed = $${idx++}`);
      values.push(completed);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Always bump updated_at
    fields.push(`updated_at = NOW()`);

    // Add task id and user id for the WHERE clause
    values.push(taskId, req.user.id);

    const query = `
      UPDATE tasks
      SET ${fields.join(', ')}
      WHERE id = $${idx++} AND user_id = $${idx}
      RETURNING id, title, description, completed, created_at, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (err) {
    console.error('updateTask error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
}

// ---------- DELETE /api/tasks/:id ----------
export async function deleteTask(req, res) {
  try {
    const taskId = parseInt(req.params.id, 10);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task id' });
    }

    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [taskId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted', id: result.rows[0].id });
  } catch (err) {
    console.error('deleteTask error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
}