## Live Demo Script (3 minutes)

### Setup (before demo)
- [ ] recorder-app running: `cd recorder-app && npm run dev`
- [ ] Live site open: `https://YOUR_USERNAME.github.io/ai-consultant-site`
- [ ] GitHub Actions tab open in another window

### Demo Flow

**[0:00] Show the live site**
"This is my AI consultant website, live on GitHub Pages — free hosting, zero monthly cost."

**[0:30] Show content.json**
"This single JSON file controls everything on the site. No HTML editing ever."

**[1:00] Open the recorder app**
"I'm going to update my 'About' section by recording a voice note."
- Select section: "about"
- Click Record
- Say: "I have 10 years of experience helping Fortune 500 companies adopt AI.
  I've worked with teams at Google, Microsoft, and several healthcare startups.
  My specialty is making AI understandable for non-technical executives."
- Click Stop

**[1:30] Transcribe**
- Click Transcribe
- Show the raw transcript with filler words, minor errors

**[1:45] Clean with Claude**
- Click Clean & Preview
- Show before/after: raw transcript → professional bio
- "Claude cleaned the transcript and structured it for my website"

**[2:00] Publish**
- Click Publish
- Switch to GitHub tab — show the commit being created
- Switch to Actions tab — show workflow running

**[2:30] Show updated live site**
- Refresh the live site
- "The site updated automatically — no code, no manual deploy"

**[3:00] Closing**
"The whole system costs about $0.01 per update. It's voice-first, beginner-friendly,
and completely free to host."