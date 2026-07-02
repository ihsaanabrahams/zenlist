import { PhysicalSize } from '@tauri-apps/api/dpi';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  confirmClear,
  isWindowPinned,
  loadMemo,
  quitApp,
  resetMemo,
  saveMemo,
  setWindowPinned,
} from '../storage/bridge.js';

const TASK_COUNT = 5;
const THEME_STORAGE_KEY = 'zenlist.theme';
const RESIZE_MIN_WIDTH = 240;
const RESIZE_MIN_HEIGHT = 294;

function createBlankTask() {
  return { text: '', completed: false, details: '' };
}

function createBlankMemo(dateLabel) {
  return {
    date: dateLabel,
    tasks: Array.from({ length: TASK_COUNT }, createBlankTask),
  };
}

function normalizeMemo(memo) {
  const date = normalizeDateLabel(memo?.date);
  const tasks = Array.from({ length: TASK_COUNT }, (_, index) => {
    const task = Array.isArray(memo?.tasks) ? memo.tasks[index] : null;
    return {
      text: typeof task?.text === 'string' ? task.text : '',
      completed: Boolean(task?.completed),
      details: typeof task?.details === 'string' ? task.details : '',
    };
  });

  return { date, tasks };
}

function normalizeDateLabel(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return formatDate(new Date());
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed);
  }

  return value;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(value);
}

function countCompleted(tasks) {
  return tasks.reduce((total, task) => total + (task.completed ? 1 : 0), 0);
}

function allTasksFilled(tasks) {
  return tasks.every((task) => task.text.trim().length > 0);
}

class ZenMemoApp {
  constructor() {
    this.window = this.resolveWindow();
    this.isPinned = false;
    this.isExpanded = false;
    this.isDarkMode = false;
    this.baseWindowSize = null;
    this.draggedTaskIndex = null;
    this.dropTaskIndex = null;
    this.dropInsertionIndex = null;
    this.dragGhost = null;
    this.onPointerReorderMove = this.handlePointerReorderMove.bind(this);
    this.onPointerReorderEnd = this.handlePointerReorderEnd.bind(this);
    this.allCompleted = false;
    this.activeDetailTaskIndex = null;
    this.toastTimeout = null;
    this.state = createBlankMemo(formatDate(new Date()));
    this.saveQueue = Promise.resolve();
    this.elements = {
      taskList: document.querySelector('[data-task-list]'),
      progressFill: document.querySelector('[data-progress-fill]'),
      progressCount: document.querySelector('[data-progress-count]'),
      progressPercent: document.querySelector('[data-progress-percent]'),
      dateLabel: document.querySelector('[data-date]'),
      pinButton: document.querySelector('[data-pin-button]'),
      resizeButton: document.querySelector('[data-resize-button]'),
      themeButton: document.querySelector('[data-theme-button]'),
      clearButton: document.querySelector('[data-clear-button]'),
      header: document.querySelector('[data-drag-region]'),
      detailBackdrop: document.querySelector('[data-task-detail-backdrop]'),
      detailModal: document.querySelector('[data-task-detail-modal]'),
      detailTitle: document.querySelector('[data-task-detail-title]'),
      detailInput: document.querySelector('[data-task-detail-input]'),
      detailClose: document.querySelector('[data-task-detail-close]'),
    };
  }

  resolveWindow() {
    try {
      return getCurrentWindow();
    } catch (error) {
      return null;
    }
  }

  async start() {
    this.syncThemeState();
    this.bindWindowControls();
    this.bindHeaderDragging();
    this.bindShortcuts();
    this.bindPinButton();
    this.bindResizeButton();
    this.bindThemeButton();
    this.bindClearButton();
    this.bindDetailDialog();

    const loaded = await loadMemo().catch((error) => {
      console.error('Failed to load memo state', error);
      return createBlankMemo(formatDate(new Date()));
    });

    this.state = normalizeMemo(loaded);
    await this.syncPinnedState();
    this.applyUiScale();
    this.renderResizeState();
    this.renderThemeState();
    this.render();
    this.focusFirstEmptyTask();
  }

  syncThemeState() {
    try {
      this.isDarkMode = localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch (error) {
      console.error('Failed to read theme preference', error);
      this.isDarkMode = false;
    }

    this.applyTheme();
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
  }

  applyUiScale() {
    const scale = this.isExpanded ? 0.8 : 1;
    document.documentElement.style.setProperty('--ui-scale', String(scale));
  }

  showDebugToast(message, kind = 'info') {
    let toast = document.querySelector('[data-debug-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'debug-toast';
      toast.dataset.debugToast = 'true';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }

    toast.textContent = message;
    toast.classList.remove('is-error', 'is-visible');
    if (kind === 'error') {
      toast.classList.add('is-error');
    }

    window.clearTimeout(this.toastTimeout);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    this.toastTimeout = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2400);
  }

  bindWindowControls() {
    if (!this.window) {
      return;
    }

    this.window.onCloseRequested(async (event) => {
      event.preventDefault();
      await this.window.hide();
    });
  }

  bindHeaderDragging() {
    this.elements.header.addEventListener('pointerdown', async (event) => {
      if (event.button !== 0) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && target.closest('button, input, textarea, a, label')) {
        return;
      }

      try {
        if (this.window) {
          await this.window.startDragging();
        }
      } catch (error) {
        console.error('Failed to drag window', error);
      }
    });
  }

  bindShortcuts() {
    document.addEventListener('keydown', async (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (this.isDetailDialogOpen()) {
          this.closeDetailDialog();
          return;
        }

        if (this.window) {
          await this.window.hide();
        }
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        await this.clearMemo();
        return;
      }

      if (event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'q') {
        event.preventDefault();
        await quitApp();
      }
    });
  }

  bindClearButton() {
    this.elements.clearButton.addEventListener('click', async () => {
      await this.clearMemo();
    });
  }

  bindDetailDialog() {
    if (!this.elements.detailBackdrop || !this.elements.detailModal || !this.elements.detailInput) {
      return;
    }

    this.elements.detailClose?.addEventListener('click', () => {
      this.closeDetailDialog();
    });

    this.elements.detailBackdrop.addEventListener('click', (event) => {
      if (event.target === this.elements.detailBackdrop) {
        this.closeDetailDialog();
      }
    });

    this.elements.detailModal.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    this.elements.detailInput.addEventListener('input', async (event) => {
      if (this.activeDetailTaskIndex === null) {
        return;
      }

      this.state.tasks[this.activeDetailTaskIndex].details = event.target.value;
      await this.persistState();
      this.syncTaskRowState();
    });
  }

  bindPinButton() {
    this.elements.pinButton.addEventListener('click', async () => {
      const next = !this.isPinned;
      const pinned = await setWindowPinned(next).catch((error) => {
        console.error('Failed to set pinned state', error);
        return this.isPinned;
      });

      this.isPinned = Boolean(pinned);
      this.renderPinState();
    });
  }

  bindResizeButton() {
    if (!this.elements.resizeButton) {
      return;
    }

    this.elements.resizeButton.addEventListener('click', async () => {
      if (!this.window) {
        this.showDebugToast('Window API unavailable in browser preview.', 'error');
        return;
      }

      this.showDebugToast('Resize requested...');

      try {
        if (!this.baseWindowSize) {
          this.baseWindowSize = await this.window.innerSize();
        }

        const scale = this.isExpanded ? 1 : 0.8;
        const width = Math.max(1, Math.round(this.baseWindowSize.width * scale));
        const height = Math.max(1, Math.round(this.baseWindowSize.height * scale));

        // Keep the window non-resizable for users while still allowing a scripted resize toggle.
        await this.window.setResizable(true);
        try {
          await this.window.setMinSize(new PhysicalSize(RESIZE_MIN_WIDTH, RESIZE_MIN_HEIGHT));
          await this.window.setSize(new PhysicalSize(width, height));

          const appliedSize = await this.window.innerSize();
          const resized = appliedSize.width === width && appliedSize.height === height;
          if (!resized) {
            this.showDebugToast(
              `Resize blocked: target ${width}x${height}, current ${appliedSize.width}x${appliedSize.height}.`,
              'error',
            );
            return;
          }
        } finally {
          await this.window.setResizable(false);
        }

        this.isExpanded = !this.isExpanded;
        this.applyUiScale();
        this.renderResizeState();
        this.showDebugToast(`Window size: ${width}x${height}`);
      } catch (error) {
        console.error('Failed to toggle window size', error);
        this.showDebugToast(`Resize error: ${String(error)}`, 'error');
      }
    });
  }

  bindThemeButton() {
    if (!this.elements.themeButton) {
      return;
    }

    this.elements.themeButton.addEventListener('click', () => {
      this.isDarkMode = !this.isDarkMode;
      this.applyTheme();

      try {
        localStorage.setItem(THEME_STORAGE_KEY, this.isDarkMode ? 'dark' : 'light');
      } catch (error) {
        console.error('Failed to persist theme preference', error);
      }

      this.renderThemeState();
    });
  }

  async syncPinnedState() {
    this.isPinned = await isWindowPinned().catch((error) => {
      console.error('Failed to read pinned state', error);
      return false;
    });
    this.renderPinState();
  }

  renderPinState() {
    const pinned = Boolean(this.isPinned);
    this.elements.pinButton.setAttribute('aria-pressed', String(pinned));
    this.elements.pinButton.classList.toggle('is-active', pinned);
    this.elements.pinButton.title = pinned ? 'Unpin window' : 'Pin window';
    this.elements.pinButton.setAttribute('aria-label', pinned ? 'Unpin window' : 'Pin window');
  }

  renderResizeState() {
    if (!this.elements.resizeButton) {
      return;
    }

    const expanded = Boolean(this.isExpanded);
    this.elements.resizeButton.setAttribute('aria-pressed', String(expanded));
    this.elements.resizeButton.classList.toggle('is-active', expanded);
    this.elements.resizeButton.title = expanded ? 'Restore window size' : 'Shrink window';
    this.elements.resizeButton.setAttribute('aria-label', expanded ? 'Restore window size' : 'Shrink window');
  }

  renderThemeState() {
    if (!this.elements.themeButton) {
      return;
    }

    const darkMode = Boolean(this.isDarkMode);
    this.elements.themeButton.setAttribute('aria-pressed', String(darkMode));
    this.elements.themeButton.classList.toggle('is-active', darkMode);
    this.elements.themeButton.title = darkMode ? 'Enable light mode' : 'Enable dark mode';
    this.elements.themeButton.setAttribute('aria-label', darkMode ? 'Enable light mode' : 'Enable dark mode');
  }

  render() {
    const completed = countCompleted(this.state.tasks);
    const percent = Math.round((completed / TASK_COUNT) * 100);

    this.elements.dateLabel.textContent = this.state.date;
    this.elements.progressCount.textContent = `${completed} of ${TASK_COUNT}`;
    this.elements.progressPercent.textContent = `${percent}%`;
    this.elements.progressFill.style.width = `${percent}%`;
    this.handleCompletionCelebration(completed === TASK_COUNT);

    if (!this.rowElements) {
      this.rowElements = this.state.tasks.map((task, index) => this.buildTaskRow(index, task));
      this.inputElements = this.rowElements.map((row) => row.querySelector('.task-input'));
      this.checkboxElements = this.rowElements.map((row) => row.querySelector('.task-check'));
      this.elements.taskList.replaceChildren(...this.rowElements);
    }

    this.syncTaskRowState();
  }

  syncTaskRowState() {
    this.state.tasks.forEach((task, index) => {
      const row = this.rowElements[index];
      const input = this.inputElements[index];
      const checkbox = this.checkboxElements[index];
      row.dataset.taskRow = String(index);
      row.classList.toggle('is-complete', task.completed);
      row.classList.toggle('has-details', task.details.trim().length > 0);
      input.value = task.text;
      input.setAttribute('aria-label', `Task ${index + 1}`);
      input.title = task.details.trim().length > 0 ? 'Triple-click to delete task' : 'Triple-click to delete task';
      checkbox.checked = task.completed;
      checkbox.setAttribute('aria-label', `Complete task ${index + 1}`);

      if (this.activeDetailTaskIndex === index && this.elements.detailInput) {
        this.elements.detailInput.value = task.details;
      }
    });
  }

  buildTaskRow(index, task) {
    const row = document.createElement('div');
    row.className = 'task-row';
    row.dataset.taskRow = String(index);
    row.classList.toggle('is-complete', task.completed);

    const getRowIndex = () => Number(row.dataset.taskRow);

    const grip = document.createElement('span');
    grip.className = 'task-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }

      this.draggedTaskIndex = getRowIndex();
      this.dropTaskIndex = this.draggedTaskIndex;
      this.dropInsertionIndex = this.draggedTaskIndex;
      document.body.classList.add('is-reordering');
      row.classList.add('is-dragging');
      this.createDragGhost(row, event.clientX, event.clientY);
      this.clearDropTargets();
      window.addEventListener('pointermove', this.onPointerReorderMove);
      window.addEventListener('pointerup', this.onPointerReorderEnd, { once: true });
      window.addEventListener('pointercancel', this.onPointerReorderEnd, { once: true });
      event.preventDefault();
    });

    const checkbox = document.createElement('input');
    checkbox.className = 'task-check';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Complete task ${index + 1}`);
    checkbox.tabIndex = -1;

    const input = document.createElement('input');
    input.className = 'task-input';
    input.type = 'text';
    input.value = task.text;
    input.setAttribute('aria-label', `Task ${index + 1}`);

    input.addEventListener('input', async (event) => {
      const value = event.target.value;
      const taskIndex = getRowIndex();
      this.state.tasks[taskIndex].text = value;
      await this.persistState();
      this.renderProgressOnly();
    });

    input.addEventListener('change', async (event) => {
      const value = event.target.value;
      const taskIndex = getRowIndex();
      this.state.tasks[taskIndex].text = value;
      await this.persistState();
      this.renderProgressOnly();
    });

    input.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const taskIndex = getRowIndex();
        if (!allTasksFilled(this.state.tasks) && taskIndex < TASK_COUNT - 1) {
          this.focusTask(taskIndex + 1);
        }
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        const taskIndex = getRowIndex();
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = taskIndex + direction;
        if (nextIndex >= 0 && nextIndex < TASK_COUNT) {
          this.focusTask(nextIndex);
        }
        return;
      }

      if (event.key === 'Backspace' && event.currentTarget.value.length === 0 && getRowIndex() > 0) {
        event.preventDefault();
        this.focusTask(getRowIndex() - 1);
      }
    });

    input.addEventListener('focus', () => {
      row.classList.add('focused');
    });

    input.addEventListener('click', async (event) => {
      if (event.detail !== 3 || event.button !== 0) {
        return;
      }

      event.preventDefault();
      const taskIndex = getRowIndex();
      this.state.tasks[taskIndex].text = '';
      this.state.tasks[taskIndex].completed = false;
      this.state.tasks[taskIndex].details = '';
      event.currentTarget.value = '';
      checkbox.checked = false;
      await this.persistState();
      this.renderProgressOnly();
      this.focusTask(taskIndex);
    });

    /*
    row.addEventListener('dblclick', (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.task-grip, .task-check')) {
        return;
      }

      this.openDetailDialog(getRowIndex());
    });
    */

    input.addEventListener('blur', () => {
      row.classList.remove('focused');
    });

    checkbox.addEventListener('change', async (event) => {
      const checked = event.target.checked;
      const taskIndex = getRowIndex();
      this.state.tasks[taskIndex].completed = checked;

      const targetIndex = checked
        ? this.state.tasks.length
        : this.state.tasks.findIndex((task) => task.completed);

      if (targetIndex !== -1) {
        this.moveTask(taskIndex, targetIndex);
      }

      await this.persistState();
      this.renderProgressOnly();
    });

    row.append(grip, checkbox, input);
    return row;
  }

  handlePointerReorderMove(event) {
    if (this.draggedTaskIndex === null) {
      return;
    }

    this.updateDragGhost(event.clientX, event.clientY);

    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetRow = targetElement instanceof Element ? targetElement.closest('.task-row') : null;
    this.clearDropTargets();

    if (!targetRow) {
      this.dropTaskIndex = this.draggedTaskIndex;
      this.dropInsertionIndex = this.draggedTaskIndex;
      return;
    }

    const targetIndex = Number(targetRow.dataset.taskRow);
    if (Number.isNaN(targetIndex)) {
      this.dropTaskIndex = this.draggedTaskIndex;
      this.dropInsertionIndex = this.draggedTaskIndex;
      return;
    }

    const targetBounds = targetRow.getBoundingClientRect();
    const isAfterHalf = event.clientY > targetBounds.top + targetBounds.height / 2;
    this.dropTaskIndex = targetIndex;
    this.dropInsertionIndex = isAfterHalf ? targetIndex + 1 : targetIndex;

    if (targetIndex !== this.draggedTaskIndex) {
      targetRow.classList.add(isAfterHalf ? 'is-drop-after' : 'is-drop-before');
    }
  }

  async handlePointerReorderEnd() {
    window.removeEventListener('pointermove', this.onPointerReorderMove);
    window.removeEventListener('pointerup', this.onPointerReorderEnd);
    window.removeEventListener('pointercancel', this.onPointerReorderEnd);
    document.body.classList.remove('is-reordering');
    this.removeDragGhost();

    const fromIndex = this.draggedTaskIndex;
    const toIndex = this.dropInsertionIndex ?? fromIndex;
    this.draggedTaskIndex = null;
    this.dropTaskIndex = null;
    this.dropInsertionIndex = null;
    this.clearDropTargets();

    if (fromIndex === null || toIndex === null) {
      return;
    }

    await this.reorderTasks(fromIndex, toIndex);
  }

  clearDropTargets() {
    this.rowElements?.forEach((row) => {
      row.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after', 'is-dragging');
    });
  }

  createDragGhost(row, clientX, clientY) {
    this.removeDragGhost();
    const rect = row.getBoundingClientRect();
    const ghost = row.cloneNode(true);
    ghost.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after');
    ghost.classList.add('drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);
    this.dragGhost = ghost;
    this.updateDragGhost(clientX, clientY);
  }

  updateDragGhost(clientX, clientY) {
    if (!this.dragGhost) {
      return;
    }

    const offsetX = 18;
    const offsetY = 14;
    this.dragGhost.style.transform = `translate3d(${clientX + offsetX}px, ${clientY + offsetY}px, 0)`;
  }

  removeDragGhost() {
    if (!this.dragGhost) {
      return;
    }

    this.dragGhost.remove();
    this.dragGhost = null;
  }

  async reorderTasks(fromIndex, toIndex) {
    const insertIndex = this.moveTask(fromIndex, toIndex);
    if (insertIndex === null) {
      return;
    }

    await this.persistState();
    this.focusTask(insertIndex);
  }

  moveTask(fromIndex, toIndex) {
    const taskCount = this.state.tasks.length;
    const clampedToIndex = Math.max(0, Math.min(toIndex, taskCount));
    const insertIndex = clampedToIndex > fromIndex ? clampedToIndex - 1 : clampedToIndex;

    if (
      fromIndex < 0 ||
      fromIndex >= taskCount ||
      clampedToIndex < 0 ||
      clampedToIndex > taskCount ||
      insertIndex === fromIndex
    ) {
      return null;
    }

    const previousPositions = new Map(
      (this.rowElements ?? []).map((row) => [row, row.getBoundingClientRect().top]),
    );

    const movedTask = this.state.tasks[fromIndex];
    this.state.tasks.splice(fromIndex, 1);
    this.state.tasks.splice(insertIndex, 0, movedTask);

    if (!this.rowElements || !this.inputElements || !this.checkboxElements) {
      this.render();
      return insertIndex;
    }

    const [movedRow] = this.rowElements.splice(fromIndex, 1);
    const [movedInput] = this.inputElements.splice(fromIndex, 1);
    const [movedCheckbox] = this.checkboxElements.splice(fromIndex, 1);

    this.rowElements.splice(insertIndex, 0, movedRow);
    this.inputElements.splice(insertIndex, 0, movedInput);
    this.checkboxElements.splice(insertIndex, 0, movedCheckbox);

    this.elements.taskList.replaceChildren(...this.rowElements);
    this.syncTaskRowState();
    this.animateTaskMove(previousPositions);
    return insertIndex;
  }

  animateTaskMove(previousPositions) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.rowElements.forEach((row) => {
      const previousTop = previousPositions.get(row);
      if (previousTop === undefined) {
        return;
      }

      const currentTop = row.getBoundingClientRect().top;
      const deltaY = previousTop - currentTop;
      if (Math.abs(deltaY) < 1) {
        row.style.transform = '';
        return;
      }

      row.style.transition = 'none';
      row.style.transform = `translateY(${deltaY}px)`;
      row.getBoundingClientRect();
      requestAnimationFrame(() => {
        row.style.transition = '';
        row.style.transform = '';
      });
    });
  }

  isDetailDialogOpen() {
    return this.activeDetailTaskIndex !== null;
  }

  openDetailDialog(index) {
    if (
      index < 0 ||
      index >= this.state.tasks.length ||
      !this.elements.detailBackdrop ||
      !this.elements.detailInput ||
      !this.elements.detailTitle
    ) {
      return;
    }

    const task = this.state.tasks[index];
    this.activeDetailTaskIndex = index;
    this.elements.detailTitle.textContent = task.text.trim() || `Task ${index + 1} details`;
    this.elements.detailInput.value = task.details;
    this.elements.detailBackdrop.hidden = false;
    requestAnimationFrame(() => {
      this.elements.detailBackdrop.classList.add('is-open');
      this.elements.detailInput.focus();
      const length = this.elements.detailInput.value.length;
      this.elements.detailInput.setSelectionRange(length, length);
    });
  }

  closeDetailDialog() {
    if (!this.elements.detailBackdrop) {
      return;
    }

    const activeIndex = this.activeDetailTaskIndex;
    this.activeDetailTaskIndex = null;
    this.elements.detailBackdrop.classList.remove('is-open');
    window.setTimeout(() => {
      if (!this.elements.detailBackdrop.classList.contains('is-open')) {
        this.elements.detailBackdrop.hidden = true;
      }
    }, 140);

    if (activeIndex !== null) {
      this.focusTask(activeIndex);
    }
  }

  focusTask(index) {
    const input = this.inputElements?.[index];
    if (!input) {
      return;
    }

    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
  }

  focusFirstEmptyTask() {
    const index = this.state.tasks.findIndex((task) => task.text.trim().length === 0);
    this.focusTask(index === -1 ? 0 : index);
  }

  renderProgressOnly() {
    const completed = countCompleted(this.state.tasks);
    const percent = Math.round((completed / TASK_COUNT) * 100);
    this.elements.progressCount.textContent = `${completed} of ${TASK_COUNT}`;
    this.elements.progressPercent.textContent = `${percent}%`;
    this.elements.progressFill.style.width = `${percent}%`;
    this.handleCompletionCelebration(completed === TASK_COUNT);
    this.syncTaskRowState();
  }

  handleCompletionCelebration(allCompleted) {
    if (allCompleted && !this.allCompleted) {
      this.launchConfetti();
    }

    this.allCompleted = allCompleted;
  }

  launchConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const layer = document.createElement('div');
    layer.className = 'confetti-layer';

    const colors = ['#22c55e', '#38bdf8', '#f59e0b', '#f472b6', '#a78bfa', '#f43f5e'];
    const pieceCount = 42;
    for (let index = 0; index < pieceCount; index += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.setProperty('--x', `${Math.random() * 100}%`);
      piece.style.setProperty('--delay', `${Math.random() * 260}ms`);
      piece.style.setProperty('--duration', `${1300 + Math.random() * 900}ms`);
      piece.style.setProperty('--drift', `${-22 + Math.random() * 44}px`);
      piece.style.setProperty('--rot', `${Math.round(Math.random() * 360)}deg`);
      piece.style.setProperty('--color', colors[index % colors.length]);
      layer.append(piece);
    }

    const container = document.querySelector('.memo-card') ?? document.body;
    container.append(layer);
    window.setTimeout(() => layer.remove(), 2400);
  }

  async persistState() {
    const normalized = normalizeMemo(this.state);
    this.state = normalized;
    this.saveQueue = this.saveQueue
      .then(() => saveMemo(normalized))
      .catch((error) => {
        console.error('Failed to save memo state', error);
      });
    await this.saveQueue;
  }

  async clearMemo() {
    const confirmed = await confirmClear().catch((error) => {
      console.error('Failed to show confirmation dialog', error);
      return false;
    });

    if (!confirmed) {
      return;
    }

    const blankMemo = createBlankMemo(formatDate(new Date()));
    this.state = blankMemo;
    this.closeDetailDialog();
    this.render();
    await resetMemo().catch((error) => {
      console.error('Failed to reset memo state', error);
    });
    this.focusTask(0);
  }
}

export function createZenMemoApp() {
  const app = new ZenMemoApp();
  void app.start();
  return app;
}