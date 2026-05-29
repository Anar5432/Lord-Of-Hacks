Mini-Project: Vanilla JS Videogame
Overview
This is an individual project. The goal is to learn how to control a generative AI to create a game with some very strict specifications while we learn about DOM manipulation.

Build a browser-based game using only HTML, CSS, and vanilla JavaScript. No libraries. No frameworks. No game engines.

You must use free AI tools. It is about fairness. Not everyone has the same budget, and using a paid plan would give some students an unfair advantage over others. If a tool asks for a credit card, find a free alternative.

Rules
Allowed ✅
HTML, CSS, Vanilla JS
Free AI tools (ChatGPT free, Claude free, Gemini...)
Not Allowed ⛔
jQuery, Three.js, Phaser, Pixi.js
Canvas API, DOM manipulation	Tailwind, Bootstrap, any CSS framework
Any paid AI plan or API key that costs money
Start Simple. Seriously 😅
Remember the KISS principle? Keep it Super Simple! Do not ask the AI to write everything from the beggining. We need to divide the tasks and plan beforehand. Use trello/Jira/Github for that.

Before You Write a Single Line of Code
Open Excalidraw and draw your game. Boxes are fine. Stick figures are fine. It just has to exist on a sketch first.
List every entity in your game (player, enemy, bullet, wall, coin...)
Decide: OOP or functional?
OOP → each entity is a class (class Player, class Enemy)
Functional → entities are objects, behavior is functions
Dicide the logic of the game loop: What updates every frame? What triggers what?
Prepare your tasklist in trello/jira/github
README.md
Your README must include all the details shown above (see evaluation).

AI_DIARY.md
This is a log of your AI-assisted development. In the first section of this file tell us which AI tool/tools you have used for the project and why.

Every time the AI gives you broken code or steers you wrong, write it down.

Format each entry like this:

### [Date] - [Short description of what went wrong]
 
**What I asked the AI:** ...
**What it gave me:** ...
**What was wrong:** ...
**How I fixed it:** ...
**Time lost:** ~X minutes
Explain this code

Be honest. This is not graded on whether the AI was perfect. It is graded on whether you understood what was happening and fixed it yourself.

Evaluation
This rubric is out of 100 points. Every milestone is a reward. Complete it earn the points.

Reward	Points
⭐ Star	2 pts
🥇 Medal	3 pts
🏆 Trophy	4 pts
💎 Diamond	7 pts
README sections carry the most weight because they show your planning and understanding, not just working code. Mandatory commits are checked in git history; missing one means losing those points even if the feature works.

Planning phase (10 points)
[x] ⭐ Draw the game in Excalidraw, share it in slack

[x] ⭐ Create the directory on your machine with initial files (HTML, CSS, JS)

[x] ⭐ Create the repo and push an initial commit (share the repo in slack)

[x] ⭐ Write README.md and start AI_DIARY.md

[x] ⭐ Deploy to GitHub Pages

Movement/Interaction phase (35 points)
[x] 🥇 Get one entity moving on screen (keyboard or mouse)

[x] 🏆 Mandatory Commit: "feat: player movement"

[x] ⭐ Add a second entity (enemy, obstacle, collectible...)

[x] 🥇 Implement collision or interaction logic

[x] 🏆 Mandatory Commit: "feat: collission implemented" (collission or interaction)

[x] ⭐ Add a score or a lose condition

[x] 🏆 Mandatory Commit: "feat: add score/lose"

[x] ⭐ Add start screen and game over screen

[x] 🏆 Mandatory Commit: "feat: start & game over screen"

[x] 🥇 Game must be restartable without refreshing the page

[x] 🏆 Mandatory Commit: "feat: game restart"

Persistence phase (6 points)
[x] ⭐ Save and display a high score using localStorage

[x] 🏆 Mandatory Commit: "feat: high score"

Documentation (49 points)
[x] 💎 README: write the game description and list of entities, paste the drawing you made in excalidraw

[x] 💎 README: write the how to play section (controls, objective, win/lose)

[x] 💎 README: write the tech decisions section (OOP or functional, and why)

[x] 💎 README: add the link to AI_DIARY.md

[x] 💎 README: add the link to Github pages

[x] 💎 README: write the known bugs / what you'd fix next section

[x] 💎 AI_DIARY.md has at least 5 entries

Deliverables
GitHub repo URL (public)
README.md with all sections filled
GitHub Pages URL in the readme (live game)
AI_DIARY.md with at least 5 entries