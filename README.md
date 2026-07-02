# zenlist
Limit to 5 tasks. Find your focus.

A minimalist, persistent and private desktop todo app built with Tauri that helps you focus on what truly matters.

> *"Multitasking isn't productivity—it's just distraction wearing a disguise."*

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/ihsaanabrahams)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-24C8DB?logo=tauri)](https://tauri.app/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-blue)](#)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)



## 🎯 The Philosophy

In a world of endless notifications and sprawling task lists, it's easy to feel overwhelmed and scattered. **zenlist** was built on a simple principle: **Limit to Focus.**

Instead of staring at a daunting list of 50+ items, you are challenged to choose **only 5 tasks** for the day or per session. This constraint forces you to prioritize the most impactful actions, reducing decision fatigue and helping you channel your energy into meaningful progress.

It's not about doing less; it's about doing what matters, better.

> Research shows that our brains can only hold about 4-7 items in working memory at once. By limiting your daily tasks to 5, you're working with your brain's natural capacity, not against it.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| **The 5-Item Limit** | A hard cap of 5 tasks. No clutter. No overwhelm. Just focus. |
| **Persistent & Private** | Your tasks are saved locally using Tauri's secure storage. Nothing leaves your machine. Your data stays yours. |
| **Always On Top** | Need to keep your priorities visible? Pin the app so it stays on top of all other windows. (Windows 10 & 11 tested) |
| **Dark Mode** | A sleek, easy-on-the-eyes dark theme for late-night focusing sessions. |
| **Confetti Celebration** | Mark that 5th and final task as complete, and enjoy a burst of confetti! A satisfying celebration for a day's core work done. |
| **Smooth Animations** | Subtle, polished animations make interacting with your list a joy. |
| **Resizable** | Adjust the window to small or large as you like for optimal visibility. |
| **Start Fresh** | A single tap of a trash icon clears all tasks instantly, allowing you to reset your focus for a new day. |
| **Minimalist Widget Look** | Designed to be a clean, unobtrusive addition to your workspace. |
| **Tiny Footprint** | Built with Tauri, the entire app is less than 10MB. It's fast, lightweight, and respectful of your system resources. |

---
## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Build Tool:** Vite
- **Desktop Framework:** Tauri (Rust) - for a secure, small, and high-performance desktop app.
- **Persistence:** Tauri's secure storage

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Rust](https://www.rust-lang.org/tools/install)

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/ihsaanabrahams/zenlist.git
cd zenlist
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run tauri dev
```

## Building the App

To create a production build for Windows:

```bash
npm run tauri build
```

The installer (`.msi` or `.exe`) will be located in one of the following directories:

- `src-tauri/target/release/bundle/msi/`
- `src-tauri/target/release/bundle/nsis/`


### ☕ Support the Project
If zenlist has helped you tame your to-do list and find your focus, consider supporting its development.

Your donations will help:

- 🐛 Maintain and update the app to ensure compatibility with future Windows versions
- ✨ Develop new features like optional cloud backup, custom themes, and performance improvements
- 💻 Cover development costs and keep the project open-source and accessible to everyone
- 🎯 Support my time so I can continue improving this tool

**Donate** [![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-FFDD00?logo=buymeacoffee&logoColor=000000)](https://buymeacoffee.com/ihsaanabrahams)

💖 Your support, no matter the size, is deeply appreciated and will directly fuel the future of this project.
