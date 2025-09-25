
// Game state management
class GameState {
    constructor() {
        this.currentScreen = 'mainMenu';
        this.gameMode = 'single';
        this.playerRole = 'random';
        this.gameTime = 180;
        this.gameTimer = null;
        this.isPaused = false;
        this.gameRunning = false;
        
        // Game entities
        this.players = [];
        this.safeZones = [];
        this.powerUps = [];
        this.playerIndex = 0;
        
        // Game statistics
        this.taggedPlayers = [];
        this.gameStartTime = 0;
        this.currentRankings = [];
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.lastFrameTime = 0;
        
        // Input handling
        this.keys = {};
        this.lastTagTime = 0;
        this.tagCooldown = 1000; // 1 second cooldown to prevent spam tagging
    }
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupEventListeners();
        this.showScreen('mainMenu');

        // 🔹 Force-show mobile controls for testing
        const leftCtrl = document.getElementById('mobileControlsLeft');
        const rightCtrl = document.getElementById('mobileControlsRight');
        if (leftCtrl) leftCtrl.style.display = 'flex';
        if (rightCtrl) rightCtrl.style.display = 'flex';
    }

    setupEventListeners() {

        // Menu navigation
        document.getElementById('instructionsBtn').addEventListener('click', () => {
            this.showScreen('instructionsScreen');
        });
        
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        // Game controls
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.pauseGame();
        });
        
        document.getElementById('quitBtn').addEventListener('click', () => {
            this.quitGame();
        });
        
        document.getElementById('resumeBtn').addEventListener('click', () => {
            this.resumeGame();
        });
        
        document.getElementById('pauseQuitBtn').addEventListener('click', () => {
            this.quitToMenu();
        });
        
        // Game over controls
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            this.startGame();
        });
        
        document.getElementById('mainMenuBtn').addEventListener('click', () => {
            this.showScreen('mainMenu');
        });
        
        // Keyboard input
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            
            // Handle special keys
            if (e.key === 'Escape' && this.gameRunning) {
                this.pauseGame();
            } else if (e.key === 'f' && this.gameRunning) {
                this.activateFreeze();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        // MOBILE: if you previously added mobile buttons, they'll set keys['w','a','s','d'] accordingly
        // Mobile controls (works for both left + right)
        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            const dir = btn.dataset.dir;
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (dir === 'up') this.keys['w'] = true;
                if (dir === 'down') this.keys['s'] = true;
                if (dir === 'left') this.keys['a'] = true;
                if (dir === 'right') this.keys['d'] = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (dir === 'up') this.keys['w'] = false;
                if (dir === 'down') this.keys['s'] = false;
                if (dir === 'left') this.keys['a'] = false;
                if (dir === 'right') this.keys['d'] = false;
            });
        });
        // (If mobile control elements exist, attach their listeners in HTML / CSS changes)
    }
    
    showScreen(screenName) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenName).classList.add('active');
        this.currentScreen = screenName;
    }
    
    startGame() {
        // Get user settings
        this.gameMode = document.getElementById('modeSelect').value;
        this.playerRole = document.getElementById('roleSelect').value;
        
        // Initialize game
        this.setupGame();
        this.showScreen('gameScreen');
        this.gameRunning = true;
        this.isPaused = false;
        this.gameStartTime = Date.now();
        
        // Start game loop
        this.gameLoop();
        
        // Start timer
        this.startTimer();
    }
    
    setupGame() {
        // Create players (8 total including human player)
        this.players = [];
        
        // Create AI players
        for (let i = 0; i < 7; i++) {
            this.players.push(new AIPlayer(i, this.getRandomPosition()));
        }
        
        // Create human player
        const humanPlayer = new HumanPlayer(7, this.getRandomPosition());
        this.players.push(humanPlayer);
        this.playerIndex = 7;
        
        // Assign roles
        this.assignInitialRoles();
        
        // Create safe zones
        this.createSafeZones();
        
        // Create power-ups
        this.createPowerUps();
        
        // Update UI
        this.updateGameUI();
    }
    
    getRandomPosition() {
        const margin = 50;
        return {
            x: margin + Math.random() * (this.canvas.width - 2 * margin),
            y: margin + Math.random() * (this.canvas.height - 2 * margin)
        };
    }
    
    assignInitialRoles() {
        // Reset all players
        this.players.forEach(player => {
            player.isChaser = false;
            player.canTagBack = false;
        });
        this.taggedPlayers = [];
        
        let chaserIndex;
        
        if (this.playerRole === 'chaser') {
            chaserIndex = this.playerIndex;
        } else if (this.playerRole === 'runner') {
            // Random AI becomes chaser
            chaserIndex = Math.floor(Math.random() * (this.players.length - 1));
        } else {
            // Random assignment
            chaserIndex = Math.floor(Math.random() * this.players.length);
        }
        
        this.players[chaserIndex].isChaser = true;
        // initial chaser can tag others normally; do not block them
        this.players[chaserIndex].canTagBack = false;
        
        // Update UI role indicator
        const isPlayerChaser = chaserIndex === this.playerIndex;
        document.getElementById('roleText').textContent = isPlayerChaser ? 'Chaser' : 'Runner';
        document.getElementById('playerRole').className = 
            `status-indicator ${isPlayerChaser ? 'chaser' : 'runner'}`;
    }
    
    createSafeZones() {
        this.safeZones = [];
        const numZones = 4;
        
        for (let i = 0; i < numZones; i++) {
            this.safeZones.push({
                x: 100 + (i % 2) * (this.canvas.width - 250),
                y: 100 + Math.floor(i / 2) * (this.canvas.height - 250),
                width: 80,
                height: 80,
                occupants: []
            });
        }
    }
    
    createPowerUps() {
        this.powerUps = [];
        // Power-ups will spawn randomly during gameplay
        this.spawnPowerUp();
    }
    
    spawnPowerUp() {
        if (this.powerUps.length < 2) {
            const types = ['speed', 'invincible'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            this.powerUps.push({
                x: 50 + Math.random() * (this.canvas.width - 100),
                y: 50 + Math.random() * (this.canvas.height - 100),
                type: type,
                width: 20,
                height: 20,
                duration: type === 'speed' ? 5000 : 3000,
                collected: false
            });
        }
        
        // Schedule next power-up spawn
        setTimeout(() => this.spawnPowerUp(), 10000 + Math.random() * 15000);
    }
    
    startTimer() {
        this.gameTime = this.gameMode === 'single' ? 180 : 300; // 3 or 5 minutes
        
        this.gameTimer = setInterval(() => {
            if (!this.isPaused && this.gameRunning) {
                this.gameTime--;
                document.getElementById('gameTimer').textContent = this.gameTime;
                
                if (this.gameTime <= 0) {
                    this.endGame('timeUp');
                }
            }
        }, 1000);
    }
    
    gameLoop(currentTime = 0) {
        if (!this.gameRunning) return;
        
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        if (!this.isPaused) {
            this.update(deltaTime);
        }
        
        this.render();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update(deltaTime) {
        // Update all players
        this.players.forEach((player, index) => {
            if (index === this.playerIndex) {
                this.updateHumanPlayer(player, deltaTime);
            } else {
                this.updateAIPlayer(player, deltaTime);
            }
            
            player.update(deltaTime);
        });
        
        // IMPORTANT: update safe zone flags BEFORE collision checks
        this.checkSafeZoneCollisions();
        // Then check collisions (so tags respect safe zones)
        this.checkPlayerCollisions();
        this.checkPowerUpCollisions();
        
        // Update safe zone timers
        this.updateSafeZoneTimers();
        
        // Check win conditions
        this.checkWinConditions();
    }
    
    updateHumanPlayer(player, deltaTime) {
        // if frozen, don't move
        if (player.frozen) return;

        const speed = player.hasSpeedBoost ? player.speed * 1.5 : player.speed;
        
        if (this.keys['w'] || this.keys['arrowup']) {
            player.y -= speed * deltaTime / 16.67; // Normalize for 60fps
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            player.y += speed * deltaTime / 16.67;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            player.x -= speed * deltaTime / 16.67;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            player.x += speed * deltaTime / 16.67;
        }
        
        // Keep player in bounds
        player.x = Math.max(player.radius, Math.min(this.canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(this.canvas.height - player.radius, player.y));
    }
    
    updateAIPlayer(player, deltaTime) {
        // if frozen, don't move
        if (player.frozen) return;

        const speed = player.hasSpeedBoost ? player.speed * 1.5 : player.speed;
        
        if (player.isChaser) {
            // Chase nearest non-chaser that is not in a safe zone
            const target = this.findNearestRunner(player);
            if (target) {
                const dx = target.x - player.x;
                const dy = target.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    player.x += (dx / distance) * speed * deltaTime / 16.67;
                    player.y += (dy / distance) * speed * deltaTime / 16.67;
                }
            }
        } else {
            // Run from nearest chaser
            const chaser = this.findNearestChaser(player);
            if (chaser) {
                const dx = player.x - chaser.x;
                const dy = player.y - chaser.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0 && distance < 150) {
                    player.x += (dx / distance) * speed * deltaTime / 16.67;
                    player.y += (dy / distance) * speed * deltaTime / 16.67;
                } else {
                    // Random movement when safe
                    if (!player.moveTarget || this.getDistance(player, player.moveTarget) < 20) {
                        player.moveTarget = this.getRandomPosition();
                    }
                    
                    const dx = player.moveTarget.x - player.x;
                    const dy = player.moveTarget.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance > 0) {
                        player.x += (dx / distance) * speed * deltaTime / 16.67 * 0.5;
                        player.y += (dy / distance) * speed * deltaTime / 16.67 * 0.5;
                    }
                }
            }
        }
        
        // Keep AI player in bounds
        player.x = Math.max(player.radius, Math.min(this.canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(this.canvas.height - player.radius, player.y));
    }
    
    findNearestRunner(chaser) {
        let nearest = null;
        let minDistance = Infinity;
        
        this.players.forEach(player => {
            // skip chasers, invincible players, and players currently in safe zones
            if (!player.isChaser && !player.isInvincible && !player.inSafeZone) {
                const distance = this.getDistance(chaser, player);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = player;
                }
            }
        });
        
        return nearest;
    }
    
    findNearestChaser(runner) {
        let nearest = null;
        let minDistance = Infinity;
        
        this.players.forEach(player => {
            if (player.isChaser) {
                const distance = this.getDistance(runner, player);
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = player;
                }
            }
        });
        
        return nearest;
    }
    
    getDistance(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    checkPlayerCollisions() {
        if (Date.now() - this.lastTagTime < this.tagCooldown) return;
        
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const p1 = this.players[i];
                const p2 = this.players[j];
                
                const distance = this.getDistance(p1, p2);
                const collisionDistance = p1.radius + p2.radius;
                
                if (distance < collisionDistance) {
                    this.handlePlayerCollision(p1, p2, i, j);
                }
            }
        }
    }
    
    handlePlayerCollision(p1, p2, i1, i2) {
        // Check if one is chaser and other is not
        // Also ensure runner is NOT in a safe zone (safe zones are updated before collisions)
        if (p1.isChaser && !p2.isChaser && !p2.isInvincible && !p2.inSafeZone) {
            this.tagPlayer(p1, p2, i1, i2);
        } else if (p2.isChaser && !p1.isChaser && !p1.isInvincible && !p1.inSafeZone) {
            this.tagPlayer(p2, p1, i2, i1);
        }
    }
    
    tagPlayer(chaser, runner, chaserIndex, runnerIndex) {
        // 🛡️ Prevent tagging if runner is in a safe zone (extra guard)
        if (this.isInSafeZone && typeof this.isInSafeZone === 'function') {
            if (this.isInSafeZone(runner) && !runner.isChaser) {
                console.log(`SAFE: Player ${runnerIndex + 1} is in safe zone and cannot be tagged`);
                return;
            }
        } else if (runner.inSafeZone) {
            // fallback guard
            console.log(`SAFE (fallback): Player ${runnerIndex + 1} is in safe zone and cannot be tagged`);
            return;
        }

        this.lastTagTime = Date.now();

        if (this.gameMode === 'single') {
            // Single chaser mode: switch roles
            chaser.isChaser = false;
            runner.isChaser = true;

            // Tag-back logic: brief window where previous chaser can tag back
            chaser.canTagBack = true;
            setTimeout(() => { chaser.canTagBack = false; }, 1500);
            runner.canTagBack = false;

            console.log(`TAG (single): Player ${chaserIndex + 1} tagged Player ${runnerIndex + 1}`);

            // Update UI
            if (runnerIndex === this.playerIndex) {
                document.getElementById('roleText').textContent = 'Chaser';
                document.getElementById('playerRole').className = 'status-indicator chaser';
            } else if (chaserIndex === this.playerIndex) {
                document.getElementById('roleText').textContent = 'Runner';
                document.getElementById('playerRole').className = 'status-indicator runner';
            }
        } else {
            // Multi-chaser mode
            runner.isChaser = true;
            this.taggedPlayers.push({
                playerId: runnerIndex,
                time: Date.now() - this.gameStartTime,
                taggedBy: chaserIndex
            });

            console.log(`TAG (multi): Player ${chaserIndex + 1} tagged Player ${runnerIndex + 1}`);

            // Update UI
            if (runnerIndex === this.playerIndex) {
                document.getElementById('roleText').textContent = 'Chaser';
                document.getElementById('playerRole').className = 'status-indicator chaser';
            }
        }

        this.updateGameUI();
    }
    
    checkSafeZoneCollisions() {
        this.safeZones.forEach(zone => {
            zone.occupants = [];
            
            this.players.forEach((player, index) => {
                if (player.x >= zone.x && player.x <= zone.x + zone.width &&
                    player.y >= zone.y && player.y <= zone.y + zone.width) {
                    
                    zone.occupants.push(index);
                    player.inSafeZone = true;
                    
                    if (!player.safeZoneEnterTime) {
                        player.safeZoneEnterTime = Date.now();
                    }
                    
                    // Check safe zone time limit
                    const timeInSafeZone = Date.now() - player.safeZoneEnterTime;
                    if (timeInSafeZone > 3000) {
                        // Force player out of safe zone
                        this.ejectFromSafeZone(player, zone);
                    }
                } else {
                    if (player.inSafeZone) {
                        player.inSafeZone = false;
                        player.safeZoneEnterTime = null;
                    }
                }
            });
        });
    }
    
    ejectFromSafeZone(player, zone) {
        // Find nearest edge and push player out
        const centerX = zone.x + zone.width / 2;
        const centerY = zone.y + zone.height / 2;
        
        const dx = player.x - centerX;
        const dy = player.y - centerY;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            player.x = dx > 0 ? zone.x + zone.width + player.radius : zone.x - player.radius;
        } else {
            player.y = dy > 0 ? zone.y + zone.height + player.radius : zone.y - player.radius;
        }
        
        player.inSafeZone = false;
        player.safeZoneEnterTime = null;
    }
    
    checkPowerUpCollisions() {
        this.powerUps.forEach((powerUp, index) => {
            if (powerUp.collected) return;
            
            this.players.forEach(player => {
                const distance = this.getDistance(player, powerUp);
                if (distance < player.radius + 10) {
                    this.collectPowerUp(player, powerUp, index);
                }
            });
        });
    }
    
    collectPowerUp(player, powerUp, index) {
        powerUp.collected = true;
        
        if (powerUp.type === 'speed') {
            player.hasSpeedBoost = true;
            setTimeout(() => {
                player.hasSpeedBoost = false;
            }, powerUp.duration);
        } else if (powerUp.type === 'invincible') {
            player.isInvincible = true;
            setTimeout(() => {
                player.isInvincible = false;
            }, powerUp.duration);
        }
        
        // Remove collected power-up
        this.powerUps.splice(index, 1);
    }
    
    updateSafeZoneTimers() {
        const humanPlayer = this.players[this.playerIndex];
        if (humanPlayer.inSafeZone && humanPlayer.safeZoneEnterTime) {
            const timeInSafeZone = Date.now() - humanPlayer.safeZoneEnterTime;
            const timeLeft = Math.max(0, 3 - Math.floor(timeInSafeZone / 1000));
            
            document.getElementById('safeTimeLeft').textContent = timeLeft;
            document.getElementById('safeZoneTimer').classList.remove('hidden');
        } else {
            document.getElementById('safeZoneTimer').classList.add('hidden');
        }
    }
    
    checkWinConditions() {
        if (this.gameMode === 'multi') {
            const runners = this.players.filter(p => !p.isChaser).length;
            document.getElementById('playersLeft').textContent = runners;
            
            if (runners === 0) {
                this.endGame('allTagged');
            }
        }
    }
    
    activateFreeze() {
        // Freeze all players for 2 seconds
        this.players.forEach(player => {
            player.frozen = true;
            setTimeout(() => {
                player.frozen = false;
            }, 2000);
        });
    }
    
    updateGameUI() {
        document.getElementById('currentMode').textContent = 
            this.gameMode === 'single' ? 'Single Chaser' : 'Multi-Chaser';
        
        const runners = this.players.filter(p => !p.isChaser).length;
        document.getElementById('playersLeft').textContent = runners;
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw safe zones
        this.ctx.fillStyle = '#3498db';
        this.safeZones.forEach(zone => {
            this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
            
            // Draw safe zone border
            this.ctx.strokeStyle = '#2980b9';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        });
        
        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            if (!powerUp.collected) {
                this.ctx.fillStyle = powerUp.type === 'speed' ? '#f39c12' : '#9b59b6';
                this.ctx.beginPath();
                this.ctx.arc(powerUp.x, powerUp.y, 10, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw power-up icon
                this.ctx.fillStyle = 'white';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    powerUp.type === 'speed' ? 'S' : 'I',
                    powerUp.x,
                    powerUp.y + 4
                );
            }
        });
        
        // Draw players
        this.players.forEach((player, index) => {
            this.ctx.save();
            
            // Player color based on role
            if (player.isChaser) {
                this.ctx.fillStyle = '#e74c3c';
            } else {
                this.ctx.fillStyle = '#3498db';
            }
            
            // Special effects
            if (player.isInvincible) {
                this.ctx.globalAlpha = 0.7;
                this.ctx.fillStyle = '#9b59b6';
            }
            
            if (player.hasSpeedBoost) {
                this.ctx.shadowColor = '#f39c12';
                this.ctx.shadowBlur = 10;
            }
            
            if (player.frozen) {
                this.ctx.fillStyle = '#bdc3c7';
            }
            
            // Draw player
            this.ctx.beginPath();
            this.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw player border
            this.ctx.strokeStyle = index === this.playerIndex ? '#f1c40f' : '#34495e';
            this.ctx.lineWidth = index === this.playerIndex ? 4 : 2;
            this.ctx.stroke();
            
            // Draw player number
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(index + 1, player.x, player.y + 5);
            
            this.ctx.restore();
        });
        
        // Draw UI overlays
        if (this.isPaused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 48px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    pauseGame() {
        this.isPaused = true;
        this.showScreen('pauseScreen');
    }
    
    resumeGame() {
        this.isPaused = false;
        this.showScreen('gameScreen');
    }
    
    quitGame() {
        this.pauseGame();
    }
    
    quitToMenu() {
        this.endGame('quit');
    }
    
    endGame(reason) {
        this.gameRunning = false;
        this.isPaused = false;
        
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }
        
        // Calculate final results
        this.calculateFinalResults(reason);
        this.showGameOverScreen(reason);
    }
    
    calculateFinalResults(reason) {
        if (this.gameMode === 'multi') {
            // Create rankings based on tag order (reverse)
            this.currentRankings = [];
            
            // Add untagged players (winners)
            const untagged = this.players
                .map((player, index) => ({ player, index }))
                .filter(({ player }) => !player.isChaser);
            
            untagged.forEach(({ player, index }) => {
                this.currentRankings.push({
                    playerId: index,
                    playerName: index === this.playerIndex ? 'You' : `Player ${index + 1}`,
                    rank: this.currentRankings.length + 1,
                    status: 'Winner'
                });
            });
            
            // Add tagged players in reverse order
            const sortedTagged = [...this.taggedPlayers].reverse();
            sortedTagged.forEach(taggedInfo => {
                this.currentRankings.push({
                    playerId: taggedInfo.playerId,
                    playerName: taggedInfo.playerId === this.playerIndex ? 'You' : `Player ${taggedInfo.playerId + 1}`,
                    rank: this.currentRankings.length + 1,
                    status: 'Tagged'
                });
            });
        }
    }
    
    showGameOverScreen(reason) {
        let title = 'Game Over!';
        let playerResult = '';
        
        if (reason === 'timeUp') {
            title = 'Time\'s Up!';
            if (this.gameMode === 'single') {
                const isChaser = this.players[this.playerIndex].isChaser;
                playerResult = isChaser ? 'You were the final chaser!' : 'You survived until the end!';
            }
        } else if (reason === 'allTagged') {
            title = 'All Players Tagged!';
            const humanRanking = this.currentRankings.find(r => r.playerId === this.playerIndex);
            if (humanRanking) {
                playerResult = `You finished in ${this.getOrdinal(humanRanking.rank)} place!`;
            }
        } else if (reason === 'quit') {
            title = 'Game Quit';
            playerResult = 'Thanks for playing!';
        }
        
        document.getElementById('gameOverTitle').textContent = title;
        document.getElementById('playerResult').textContent = playerResult;
        
        // Show rankings for multi-chaser mode
        if (this.gameMode === 'multi' && this.currentRankings.length > 0) {
            const rankingsList = document.getElementById('finalRankings');
            rankingsList.innerHTML = '';
            
            this.currentRankings.forEach(ranking => {
                const li = document.createElement('li');
                li.textContent = `${ranking.rank}. ${ranking.playerName} - ${ranking.status}`;
                if (ranking.playerId === this.playerIndex) {
                    li.style.fontWeight = 'bold';
                    li.style.color = '#3498db';
                }
                rankingsList.appendChild(li);
            });
        } else {
            document.querySelector('.leaderboard').style.display = 'none';
        }
        
        this.showScreen('gameOverScreen');
    }
    
    getOrdinal(num) {
        const suffixes = ['th', 'st', 'nd', 'rd'];
        const v = num % 100;
        return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
    }
}

// Player classes
class Player {
    constructor(id, position) {
        this.id = id;
        this.x = position.x;
        this.y = position.y;
        this.radius = 20;
        this.speed = 3;
        this.isChaser = false;
        this.canTagBack = false;
        
        // Status effects
        this.inSafeZone = false;
        this.safeZoneEnterTime = null;
        this.hasSpeedBoost = false;
        this.isInvincible = false;
        this.frozen = false;
    }
    
    update(deltaTime) {
        // Override in subclasses
    }
}

class HumanPlayer extends Player {
    constructor(id, position) {
        super(id, position);
    }
    
    update(deltaTime) {
        // Movement handled in main game loop
    }
}

class AIPlayer extends Player {
    constructor(id, position) {
        super(id, position);
        this.moveTarget = null;
        this.lastDecisionTime = 0;
        this.decisionCooldown = 500 + Math.random() * 1000;
    }
    
    update(deltaTime) {
        // AI behavior handled in main game loop
        if (Date.now() - this.lastDecisionTime > this.decisionCooldown) {
            this.lastDecisionTime = Date.now();
            this.decisionCooldown = 500 + Math.random() * 1000;
        }
    }
}

// Initialize game when page loads
const game = new GameState();
document.addEventListener('DOMContentLoaded', () => {
    game.init();
});
