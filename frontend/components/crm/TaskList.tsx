"use client";

import { useState } from "react";
import { DBTask } from "@shared/types/src";
import { useTasks, useCreateTask, useCompleteTask, useDeleteTask } from "@/hooks/api/useTasks";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { Check, Circle, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TaskListProps {
  leadId: string;
}

export function TaskList({ leadId }: TaskListProps) {
  const { data: tasksData, isLoading } = useTasks({ leadId });
  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  const tasks = tasksData?.data || [];

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      // Convert date string (YYYY-MM-DD) to ISO datetime string
      let dueAtDateTime: string | undefined;
      if (newTaskDueDate) {
        // Set time to end of day in local timezone, then convert to ISO
        const date = new Date(newTaskDueDate + "T23:59:59");
        dueAtDateTime = date.toISOString();
      }

      await createTask.mutateAsync({
        leadId,
        title: newTaskTitle.trim(),
        dueAt: dueAtDateTime,
      });
      setNewTaskTitle("");
      setNewTaskDueDate("");
      setShowAddForm(false);
      toast.success("Task created");
    } catch {
      toast.error("Failed to create task");
    }
  };

  const handleToggleComplete = async (taskId: string) => {
    try {
      await completeTask.mutateAsync(taskId);
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask.mutateAsync(taskId);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const formatDueDate = (dueAt: Date | string | null) => {
    if (!dueAt) return null;
    return format(new Date(dueAt), "MMM d, yyyy");
  };

  const isOverdue = (task: DBTask) => {
    if (!task.dueAt || task.completedAt) return false;
    return new Date(task.dueAt) < new Date();
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading tasks...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Tasks</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreateTask} className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <FormInput
            placeholder="Task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <FormInput
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="sm" disabled={createTask.isPending}>
              {createTask.isPending ? "Adding..." : "Add"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No tasks yet</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                task.completedAt ? "bg-muted/30 border-border" : "bg-card border-border"
              }`}
            >
              <button
                onClick={() => handleToggleComplete(task.id)}
                className={`mt-0.5 flex-shrink-0 ${
                  task.completedAt ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              >
                {task.completedAt ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    task.completedAt
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {task.title}
                </p>
                {task.dueAt && (
                  <div
                    className={`flex items-center gap-1 mt-1 text-xs ${
                      isOverdue(task) ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{formatDueDate(task.dueAt)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDelete(task.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
