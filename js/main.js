// ==========================================================================
// Lord of the Hacks - Main Screen Orchestrator & DOM Handlers
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate game instance
    const game = new Game();
    
    // UI Elements
    const startScreen = document.getElementById('start-screen');
    const gameContainer = document.getElementById('game-container');
    const gameOverScreen = document.getElementById('game-over-screen');
    const victoryScreen = document.getElementById('victory-screen');
    const fadeOverlay = document.getElementById('fade-overlay');
    
    const startButton = document.getElementById('start-button');
    const retryButton = document.getElementById('retry-button');
    const menuButton = document.getElementById('menu-button');
    const nextLevelButton = document.getElementById('next-level-button');
    const victoryMenuButton = document.getElementById('victory-menu-button');
    
    const charCards = document.querySelectorAll('.char-card');
    const levelBtns = document.querySelectorAll('.level-btn');

    // Load Local Storage Saved State
    loadSavedState();

    // ==========================================================================
    // UI Interactions & Shop
    // ==========================================================================

    // Character Selector & Shop Purchase
    charCards.forEach(card => {
        card.addEventListener('click', () => {
            const char = card.getAttribute('data-char');
            const isLocked = card.classList.contains('locked');
            const cost = parseInt(card.getAttribute('data-cost') || '0');
            const requiresArkenstone = card.getAttribute('data-require-arkenstone') === 'true';
            
            if (isLocked) {
                // Try to unlock
                let unlocked = false;
                if (requiresArkenstone && !game.hasArkenstone) {
                    alert("This legendary Hero requires the Precious Arkenstone! Defeat Smaug in Level 3 to claim it.");
                    return;
                }
                
                if (game.coins >= cost) {
                    game.coins -= cost;
                    unlocked = true;
                    saveState();
                    alert(`Unlocked ${char}!`);
                } else {
                    alert(`Not enough coins! You need ${cost} coins.`);
                }
                
                if (!unlocked) return;
            }

            // Select character
            charCards.forEach(c => c.classList.remove('active'));
            card.classList.remove('locked');
            card.classList.add('active');
            
            const statusLabel = card.querySelector('.char-status');
            if (statusLabel) statusLabel.textContent = "Selected";
            
            game.selectedChar = char;
            saveState();
            updateShopCardsUI();
        });
    });

    // Level selector
    levelBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('locked')) return;
            
            levelBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            game.currentLevel = parseInt(btn.getAttribute('data-level'));
        });
    });

    // Start Button Action
    startButton.addEventListener('click', () => {
        triggerFadeTransition(() => {
            startScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            
            game.loadLevel(game.currentLevel);
            game.start();
        });
    });

    // Retry Button Action
    retryButton.addEventListener('click', () => {
        triggerFadeTransition(() => {
            gameOverScreen.classList.add('hidden');
            game.loadLevel(game.currentLevel);
            game.start();
        });
    });

    // Menu Buttons Action
    const returnToMainMenu = () => {
        triggerFadeTransition(() => {
            gameOverScreen.classList.add('hidden');
            victoryScreen.classList.add('hidden');
            gameContainer.classList.add('hidden');
            startScreen.classList.remove('hidden');
            
            loadSavedState(); // Refresh currency/unlocked levels UI
        });
    };

    menuButton.addEventListener('click', returnToMainMenu);
    victoryMenuButton.addEventListener('click', returnToMainMenu);

    // Next Level Action
    nextLevelButton.addEventListener('click', () => {
        const nextLevel = game.currentLevel + 1;
        if (LEVELS_CONFIG[nextLevel]) {
            triggerFadeTransition(() => {
                victoryScreen.classList.add('hidden');
                game.currentLevel = nextLevel;
                game.loadLevel(nextLevel);
                game.start();
            });
        } else {
            alert("Congratulations! You have completed all levels and saved Middle-earth!");
            returnToMainMenu();
        }
    });

    // ==========================================================================
    // State Persistence (Local Storage Helpers)
    // ==========================================================================

    function saveState() {
        const state = {
            coins: game.coins,
            hasArkenstone: game.hasArkenstone,
            currentCharacter: game.selectedChar,
            unlockedCharacters: getUnlockedCharactersList()
        };
        localStorage.setItem('lotr_game_state', JSON.stringify(state));
    }

    function loadSavedState() {
        const rawState = localStorage.getItem('lotr_game_state');
        if (rawState) {
            const state = JSON.parse(rawState);
            game.coins = state.coins || 0;
            game.hasArkenstone = state.hasArkenstone || false;
            game.selectedChar = state.currentCharacter || 'Hobbit';
            
            // Mark unlocked characters
            const unlockedList = state.unlockedCharacters || ['Hobbit'];
            charCards.forEach(card => {
                const charName = card.getAttribute('data-char');
                if (unlockedList.includes(charName)) {
                    card.classList.remove('locked');
                    const statusLabel = card.querySelector('.char-status');
                    if (statusLabel) {
                        statusLabel.textContent = (charName === game.selectedChar) ? "Selected" : "Unlocked";
                    }
                    if (charName === game.selectedChar) {
                        charCards.forEach(c => c.classList.remove('active'));
                        card.classList.add('active');
                    }
                }
            });
        }
        
        updateShopCardsUI();
        updateLevelSelectorUI();
    }

    function getUnlockedCharactersList() {
        const list = [];
        charCards.forEach(card => {
            if (!card.classList.contains('locked')) {
                list.push(card.getAttribute('data-char'));
            }
        });
        return list;
    }

    function updateShopCardsUI() {
        charCards.forEach(card => {
            const char = card.getAttribute('data-char');
            const isLocked = card.classList.contains('locked');
            const statusLabel = card.querySelector('.char-status');
            
            if (isLocked) {
                const cost = card.getAttribute('data-cost');
                const reqArkenstone = card.getAttribute('data-require-arkenstone') === 'true';
                statusLabel.textContent = `🔒 ${cost} Coins${reqArkenstone ? " + 💎" : ""}`;
            } else if (char !== game.selectedChar) {
                statusLabel.textContent = "Unlocked";
            } else {
                statusLabel.textContent = "Selected";
            }
        });
    }

    function updateLevelSelectorUI() {
        const unlockedLevels = JSON.parse(localStorage.getItem('lotr_unlocked')) || [1];
        levelBtns.forEach(btn => {
            const lvl = parseInt(btn.getAttribute('data-level'));
            if (unlockedLevels.includes(lvl)) {
                btn.classList.remove('locked');
                btn.removeAttribute('disabled');
                if (lvl === game.currentLevel) {
                    levelBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            } else {
                btn.classList.add('locked');
                btn.setAttribute('disabled', 'true');
            }
        });
    }

    // ==========================================================================
    // Visual Effects
    // ==========================================================================

    function triggerFadeTransition(onTransitionPeak) {
        fadeOverlay.classList.add('fade-active');
        
        // Transition peak happens at 500ms (opacity 1)
        setTimeout(() => {
            if (typeof onTransitionPeak === 'function') {
                onTransitionPeak();
            }
            
            // Fade out
            fadeOverlay.classList.remove('fade-active');
        }, 500);
    }
});
