use chrono::Local;
use serde::{Deserialize, Serialize};

pub const TASK_COUNT: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskItem {
  #[serde(default)]
  pub text: String,
  #[serde(default)]
  pub completed: bool,
  #[serde(default)]
  pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoState {
  pub date: String,
  pub tasks: Vec<TaskItem>,
}

impl TaskItem {
  pub fn blank() -> Self {
    Self {
      text: String::new(),
      completed: false,
      details: String::new(),
    }
  }
}

impl MemoState {
  pub fn today() -> String {
    Local::now().format("%a, %B %-d, %Y").to_string()
  }

  pub fn blank_today() -> Self {
    Self {
      date: Self::today(),
      tasks: (0..TASK_COUNT).map(|_| TaskItem::blank()).collect(),
    }
  }

  pub fn normalize(mut self) -> Self {
    if self.date.trim().is_empty() {
      self.date = Self::today();
    }

    if self.tasks.len() < TASK_COUNT {
      self.tasks
        .extend((0..(TASK_COUNT - self.tasks.len())).map(|_| TaskItem::blank()));
    }

    self.tasks.truncate(TASK_COUNT);
    self
  }
}
