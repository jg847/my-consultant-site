# AI Consultant Site

This project provides the foundation for an AI consultant's voice-to-GitHub-Pages web presence system. It starts with a strict TypeScript + Vitest setup and a single editable content source for future site generation.

## Prerequisites

- Node.js 18+
- A GitHub account
- API keys for OpenAI and Anthropic

## Setup

1. Clone the repository and open it in VS Code.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and fill in your real keys and GitHub values.
4. Validate types with `npm run typecheck`.
5. Run tests with `npm test`.

## How to update content

Edit only `content.json` to update site text and section data. Keep all required fields present and non-empty so schema tests continue to pass.

## Run locally

- Watch tests during development: `npm run dev`
- Run full test suite once: `npm test`

## GitHub Pages Setup

1. Go to repository **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select **Branch: main** and **Folder: /docs**.
4. Click **Save**.
5. Add repository secrets in **Settings → Secrets and variables → Actions**:
	- `OPENAI_API_KEY`
	- `ANTHROPIC_API_KEY`
	- `GITHUB_TOKEN` (auto-provided by GitHub Actions)

## 🚀 Quick Start for Classmates

**Time required: ~15 minutes**

### Prerequisites

- Node.js 20+ ([download](https://nodejs.org))
- GitHub account (free)
- OpenAI API key ([get one](https://platform.openai.com/api-keys))
- Anthropic API key ([get one](https://console.anthropic.com))

### Steps

1. **Fork this repository** — click Fork on GitHub.
2. **Clone your fork**

	```bash
	git clone https://github.com/YOUR_USERNAME/ai-consultant-site
	cd ai-consultant-site
	```

3. **Install dependencies**

	```bash
	npm install
	cd recorder-app && npm install && cd ..
	```

4. **Add secrets to GitHub** (Settings → Secrets and variables → Actions):
	- `OPENAI_API_KEY`
	- `ANTHROPIC_API_KEY`
5. **Enable GitHub Pages** (Settings → Pages → Source: main branch, /docs folder).
6. **Edit content.json** — replace placeholder data with your real info.
7. **Push to main** — GitHub Actions builds and deploys automatically.

Your site will be live at: `https://YOUR_USERNAME.github.io/ai-consultant-site`

### To update your site via voice

1. `cd recorder-app && npm run dev`
2. Open `http://localhost:3000`
3. Select section → Record → Transcribe → Review → Publish
4. GitHub Actions auto-deploys within 2 minutes

## License

MIT