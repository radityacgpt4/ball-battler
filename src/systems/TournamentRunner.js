/**
 * Tournament Runner
 * Autonomous system for running all fighter combinations in Best of 5 format
 *
 * PERFORMANCE TUNING (with physics substep system):
 * - timeScale 1.0 = Normal speed (~30-45 mins for 855 battles)
 * - timeScale 3.0 = Safe fast mode (~5-8 mins)
 * - timeScale 5.0 = Max safe speed (~3-5 mins, uses 5 substeps per frame)
 * - Note: timeScale is capped at 5.0 (MAX_TIMESCALE) to prevent excessive CPU load
 *
 * If you see weird results (projectiles missing, fighters phasing through each other),
 * reduce the timeScale value below.
 */
import { battleLogger } from './BattleLogger.js';

// CONFIGURATION
const TOURNAMENT_CONFIG = {
    timeScale: 5.0,          // Speed multiplier (1.0 = normal, 5.0 = 5x speed)
    roundsPerMatchup: 5,     // Best of X format (1, 3, 5, or 7)
    includeMirrorMatches: false,  // Same fighter vs same fighter
    visualTestCount: 3,      // Number of test battles to run visually before headless mode
    enableAnomalyDetection: true  // Log suspicious battle results
};

export class TournamentRunner {
    constructor(game) {
        this.game = game;
        this.matchups = [];
        this.currentMatchupIndex = 0;
        this.currentRound = 0;
        this.roundsPerMatchup = TOURNAMENT_CONFIG.roundsPerMatchup;
        this.isRunning = false;
        this.results = new Map(); // matchupKey -> {wins: [fighter1Wins, fighter2Wins], battles: [...]}
        this.timeScale = TOURNAMENT_CONFIG.timeScale;
        this.anomalies = []; // Track suspicious battle results
        this.testBattlesComplete = 0;
        this.isRunningVisualTests = false;
        this.startTime = 0; // Track tournament start time for ETA
        this.isMinimized = false; // Track UI minimization state
        this.leaderboard = new Map(); // Fighter name -> {wins, losses, draws, totalWinHpPct, winCount}
        this.fighterDpsData = new Map(); // fighterType -> { seconds: Map<secondIndex, {totalDmg, count}> }
        this.winsNeeded = Math.ceil(this.roundsPerMatchup / 2);
        this.totalBattlesPlayed = 0;
    }

    /**
     * Generate all unique 1v1 matchups (no mirror matches)
     * Returns array of {fighter1: string, fighter2: string}
     */
    generateMatchups(fighterTypes) {
        const fighters = Object.keys(fighterTypes);
        const matchups = [];

        for (let i = 0; i < fighters.length; i++) {
            for (let j = i + 1; j < fighters.length; j++) {
                matchups.push({
                    fighter1: fighters[i],
                    fighter2: fighters[j]
                });
            }
        }

        return matchups;
    }

    /**
     * Calculate total number of battles
     */
    getTotalBattles() {
        return this.matchups.length * this.roundsPerMatchup;
    }

    /**
     * Get current progress information
     */
    getProgress() {
        const totalBattles = this.getTotalBattles();
        const completedBattles = this.totalBattlesPlayed || 0;
        const percentage = this.matchups.length > 0
            ? (this.currentMatchupIndex / this.matchups.length * 100).toFixed(1) : 0;

        // Calculate ETA using matchup-based estimation (accounts for early termination)
        const elapsed = this.startTime > 0 ? (performance.now() - this.startTime) / 1000 : 0; // seconds
        const MIN_BATTLES_FOR_ETA = 20; // Need at least 20 battles for accurate prediction

        let etaSeconds = 0;
        if (this.totalBattlesPlayed >= MIN_BATTLES_FOR_ETA) {
            const avgBattlesPerMatchup = this.totalBattlesPlayed / Math.max(this.currentMatchupIndex, 1);
            const remainingMatchups = this.matchups.length - this.currentMatchupIndex;
            const battlesPerSecond = this.totalBattlesPlayed / elapsed;
            etaSeconds = (remainingMatchups * avgBattlesPerMatchup) / battlesPerSecond;
        }

        return {
            completedBattles,
            totalBattles,
            percentage,
            currentMatchup: this.currentMatchupIndex + 1,
            totalMatchups: this.matchups.length,
            currentRound: this.currentRound + 1,
            roundsPerMatchup: this.roundsPerMatchup,
            elapsedTime: Math.floor(elapsed),
            etaSeconds: Math.floor(etaSeconds),
            hasValidETA: this.totalBattlesPlayed >= MIN_BATTLES_FOR_ETA
        };
    }

    /**
     * Format seconds to readable time string
     */
    formatTime(seconds) {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }

    /**
     * Start the tournament
     */
    async start(fighterTypes, bestOf) {
        this.roundsPerMatchup = bestOf || TOURNAMENT_CONFIG.roundsPerMatchup;
        this.winsNeeded = Math.ceil(this.roundsPerMatchup / 2);
        this.totalBattlesPlayed = 0;
        this.matchups = this.generateMatchups(fighterTypes);
        this.currentMatchupIndex = 0;
        this.currentRound = 0;
        this.isRunning = true;
        this.results.clear();
        this.anomalies = [];
        this.testBattlesComplete = 0;
        this.startTime = performance.now();
        this.isMinimized = false;
        this.leaderboard.clear();
        this.fighterDpsData.clear();

        console.log(`Tournament started: ${this.matchups.length} matchups, ${this.getTotalBattles()} total battles`);

        // Show tournament UI
        this.showTournamentUI();

        // Run visual test battles first if configured
        if (TOURNAMENT_CONFIG.visualTestCount > 0) {
            this.isRunningVisualTests = true;
            await this.runVisualTests(fighterTypes);
        } else {
            // Skip directly to headless mode
            await this.processNextBattle();
        }
    }

    /**
     * Run visual test battles to verify physics before headless mode
     */
    async runVisualTests(fighterTypes) {
        console.log(`Running ${TOURNAMENT_CONFIG.visualTestCount} visual test battles...`);

        // Update UI to show testing phase
        this.updateTestPhaseUI();

        // Select random matchups for testing
        const testMatchups = [];
        for (let i = 0; i < TOURNAMENT_CONFIG.visualTestCount; i++) {
            const randomIndex = Math.floor(Math.random() * this.matchups.length);
            testMatchups.push(this.matchups[randomIndex]);
        }

        // Run test battles with rendering
        for (const matchup of testMatchups) {
            await this.runVisualTestBattle(matchup);
            this.testBattlesComplete++;
            this.updateTestPhaseUI();

            // Short delay between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Tests complete, transition to headless mode
        console.log('Visual tests complete. Starting headless tournament...');
        this.isRunningVisualTests = false;

        // Show transition message (restore full overlay)
        const tournamentUI = document.getElementById('tournament-ui');
        if (tournamentUI) {
            tournamentUI.classList.remove('test-phase-hud');
            tournamentUI.classList.add('screen-overlay');
            tournamentUI.innerHTML = `
                <h2 class="setup-title">TESTS COMPLETE ✓</h2>
                <div class="test-info">
                    <p style="color: #00ff88; font-size: 1.2rem; font-weight: 800;">Physics validation passed!</p>
                    <p>Starting headless tournament mode...</p>
                    <p style="font-size: 0.8rem; color: var(--text-dim);">Running at ${this.timeScale}x speed</p>
                </div>
            `;
        }

        // Brief delay to show transition message
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Reset start time for accurate headless ETA (visual tests were slower)
        this.startTime = performance.now();

        // Rebuild the normal tournament UI structure
        this.rebuildTournamentUI();
        this.updateProgressUI();

        // Start headless battles
        await this.processNextBattle();
    }

    /**
     * Run a single visual test battle
     */
    async runVisualTestBattle(matchup) {
        return new Promise((resolve) => {
            // Setup battle
            this.game.p1Team = [matchup.fighter1];
            this.game.p2Team = [matchup.fighter2];
            this.game.gameMode = '1v1';

            // Start match with rendering at test speed
            this.game.isHeadlessMode = false;
            this.game.startMatch();
            // Set timeScale AFTER startMatch (which resets it to 1.0)
            this.game.timeScale = this.timeScale;

            // Wait for battle to complete
            const checkComplete = () => {
                if (!this.game.running) {
                    // Hide the end-screen immediately (we're in tournament mode)
                    const endScreen = document.getElementById('end-screen');
                    if (endScreen) {
                        endScreen.style.display = 'none';
                    }

                    // Check for anomalies in this test battle
                    this.checkBattleAnomaly(matchup, true);
                    resolve();
                } else {
                    requestAnimationFrame(checkComplete);
                }
            };

            checkComplete();
        });
    }

    /**
     * Check for physics anomalies in a completed battle
     */
    checkBattleAnomaly(matchup, isVisualTest = false) {
        if (!TOURNAMENT_CONFIG.enableAnomalyDetection) return;

        const battleData = this.game.entities;
        const duration = performance.now() - (this.game.arenaTimer || 0);

        // Get battle stats
        const team1 = battleData.filter(e => e.id === 1)[0];
        const team2 = battleData.filter(e => e.id === 2)[0];

        if (!team1 || !team2) return;

        const anomaly = {
            matchup: `${matchup.fighter1} vs ${matchup.fighter2}`,
            issues: [],
            isVisualTest
        };

        // Detection 1: Suspiciously short battle (< 3 seconds of game-time)
        const battleTime = (this.game.battleFrameCounter || 0) / 60; // Convert simulation ticks to seconds
        if (battleTime < 3) {
            anomaly.issues.push(`Very short battle: ${battleTime.toFixed(1)}s (possible tunneling)`);
        }

        // Detection 2: Zero damage dealt/received (projectile missed everything?)
        const t1Stats = team1.battleStats || {};
        const t2Stats = team2.battleStats || {};
        if ((t1Stats.damageDealt || 0) < 5 && (t2Stats.damageDealt || 0) < 5) {
            anomaly.issues.push(`Very low damage dealt by both fighters (< 5 dmg total)`);
        }

        // Detection 3: One fighter took no damage (complete miss?)
        if ((t1Stats.damageReceived || 0) === 0 && !team1.isDead) {
            anomaly.issues.push(`${matchup.fighter1} took zero damage`);
        }
        if ((t2Stats.damageReceived || 0) === 0 && !team2.isDead) {
            anomaly.issues.push(`${matchup.fighter2} took zero damage`);
        }

        // If anomalies detected, log them
        if (anomaly.issues.length > 0) {
            this.anomalies.push(anomaly);
            console.warn('⚠️ Anomaly detected:', anomaly);

            // If this is a visual test, alert the user
            if (isVisualTest) {
                console.error('❌ PHYSICS ISSUE DETECTED in visual test!', anomaly.issues);
            }
        }
    }

    /**
     * Process next battle in the queue
     */
    async processNextBattle() {
        if (!this.isRunning) return;

        // Check if tournament is complete
        if (this.currentMatchupIndex >= this.matchups.length) {
            this.complete();
            return;
        }

        const matchup = this.matchups[this.currentMatchupIndex];

        // Update UI
        this.updateProgressUI();

        // Setup battle
        this.game.p1Team = [matchup.fighter1];
        this.game.p2Team = [matchup.fighter2];
        this.game.gameMode = '1v1';

        // Run battle in headless mode (synchronous)
        this.runHeadlessBattle();

        // Record result
        this.recordBattleResult(matchup);

        // Move to next battle
        this.currentRound++;
        this.totalBattlesPlayed++;

        // Early termination: skip remaining rounds when one side clinches
        const key = `${matchup.fighter1}_vs_${matchup.fighter2}`;
        const result = this.results.get(key);
        const earlyWin = result && (result.wins[0] >= this.winsNeeded || result.wins[1] >= this.winsNeeded);

        if (this.currentRound >= this.roundsPerMatchup || earlyWin) {
            this.currentRound = 0;
            this.currentMatchupIndex++;
        }

        // Continue with next battle (small delay to prevent freezing)
        setTimeout(() => this.processNextBattle(), 10);
    }

    /**
     * Run a single battle in headless mode (no rendering)
     * Runs synchronously - no timer dependency, works when minimized
     */
    runHeadlessBattle() {
        this.game.startMatchHeadless(this.timeScale);
        // Battle completes synchronously inside loopHeadless()
    }

    /**
     * Record battle result
     */
    recordBattleResult(matchup) {
        const key = `${matchup.fighter1}_vs_${matchup.fighter2}`;

        if (!this.results.has(key)) {
            this.results.set(key, {
                fighter1: matchup.fighter1,
                fighter2: matchup.fighter2,
                wins: [0, 0], // [fighter1 wins, fighter2 wins]
                draws: 0,
                battles: [] // Store individual battle results
            });
        }

        const result = this.results.get(key);

        // Determine winner from last battle
        const team1AliveFighters = this.game.entities.filter(e => !e.isDead && e.id === 1);
        const team2AliveFighters = this.game.entities.filter(e => !e.isDead && e.id === 2);
        const team1Alive = team1AliveFighters.length;
        const team2Alive = team2AliveFighters.length;

        // Capture remaining HP% for alive fighters
        const team1HpPct = team1AliveFighters.length > 0
            ? Math.round(team1AliveFighters.reduce((s, f) => s + f.hp, 0) / team1AliveFighters.reduce((s, f) => s + f.maxHp, 0) * 100) : 0;
        const team2HpPct = team2AliveFighters.length > 0
            ? Math.round(team2AliveFighters.reduce((s, f) => s + f.hp, 0) / team2AliveFighters.reduce((s, f) => s + f.maxHp, 0) * 100) : 0;

        // Initialize leaderboard entries if needed
        const f1Name = this.game.getFighterName(matchup.fighter1);
        const f2Name = this.game.getFighterName(matchup.fighter2);

        if (!this.leaderboard.has(f1Name)) {
            this.leaderboard.set(f1Name, { wins: 0, losses: 0, draws: 0, totalWinHpPct: 0, winCount: 0 });
        }
        if (!this.leaderboard.has(f2Name)) {
            this.leaderboard.set(f2Name, { wins: 0, losses: 0, draws: 0, totalWinHpPct: 0, winCount: 0 });
        }

        const f1Stats = this.leaderboard.get(f1Name);
        const f2Stats = this.leaderboard.get(f2Name);

        let battleResult = 'draw';
        if (team1Alive > team2Alive) {
            result.wins[0]++;
            f1Stats.wins++;
            f2Stats.losses++;
            f1Stats.totalWinHpPct += team1HpPct;
            f1Stats.winCount++;
            battleResult = 'fighter1';
        } else if (team2Alive > team1Alive) {
            result.wins[1]++;
            f2Stats.wins++;
            f1Stats.losses++;
            f2Stats.totalWinHpPct += team2HpPct;
            f2Stats.winCount++;
            battleResult = 'fighter2';
        } else {
            result.draws++;
            f1Stats.draws++;
            f2Stats.draws++;
        }

        // Store individual battle result
        result.battles.push({
            round: result.battles.length + 1,
            winner: battleResult,
            team1Alive,
            team2Alive,
            team1HpPct,
            team2HpPct
        });

        // Collect DPS time-series data
        this.collectDpsData();

        // Check for anomalies
        this.checkBattleAnomaly(matchup, false);

        // Update score immediately
        this.updateCurrentScore();
    }

    /**
     * Collect per-second DPS data from BattleLogger after each battle
     */
    collectDpsData() {
        const lastBattle = battleLogger.battleHistory[battleLogger.battleHistory.length - 1];
        if (!lastBattle || !lastBattle.secondSnapshots) return;

        for (const snap of lastBattle.secondSnapshots) {
            for (const f of snap.fighters) {
                if (!this.fighterDpsData.has(f.type)) {
                    this.fighterDpsData.set(f.type, { name: f.name, seconds: new Map() });
                }
                const fighterData = this.fighterDpsData.get(f.type);
                const bucket = fighterData.seconds.get(snap.second);
                if (bucket) {
                    bucket.totalDmg += f.dmgThisSecond;
                    bucket.count++;
                } else {
                    fighterData.seconds.set(snap.second, { totalDmg: f.dmgThisSecond, count: 1 });
                }
            }
        }
    }

    /**
     * Update just the current matchup score display
     */
    updateCurrentScore() {
        if (this.currentMatchupIndex >= this.matchups.length) return;

        const matchup = this.matchups[this.currentMatchupIndex];
        const key = `${matchup.fighter1}_vs_${matchup.fighter2}`;
        const result = this.results.get(key);
        const scoreEl = document.getElementById('matchup-score');

        if (scoreEl) {
            if (result) {
                scoreEl.textContent = `${result.wins[0]} - ${result.wins[1]}`;
            } else {
                scoreEl.textContent = '0 - 0';
            }
        }
    }

    /**
     * Show tournament UI
     */
    showTournamentUI() {
        const charSelect = document.getElementById('char-select');
        charSelect.style.display = 'none';

        // Create tournament UI
        const tournamentUI = document.createElement('div');
        tournamentUI.id = 'tournament-ui';
        tournamentUI.className = 'screen-overlay';
        tournamentUI.innerHTML = `
            <div class="tournament-header">
                <h2 class="setup-title">AUTO-TOURNAMENT RUNNING</h2>
                <button class="minimize-btn" id="minimize-tournament-btn">−</button>
            </div>
            <div class="tournament-content" id="tournament-content">
                <div class="current-matchup-display">
                    <div class="matchup-title">CURRENT BATTLE</div>
                    <div class="matchup-fighters">
                        <div class="fighter-card p1-card">
                            <span class="fighter-name" id="fighter1-name">---</span>
                        </div>
                        <div class="vs-separator">VS</div>
                        <div class="fighter-card p2-card">
                            <span class="fighter-name" id="fighter2-name">---</span>
                        </div>
                    </div>
                    <div class="matchup-score" id="matchup-score">0 - 0</div>
                </div>
                <div class="leaderboard-container">
                    <div class="leaderboard-header" id="leaderboard-header">
                        <span>LEADERBOARD</span>
                        <button class="toggle-leaderboard-btn" id="toggle-leaderboard-btn">▼</button>
                    </div>
                    <div class="leaderboard-content" id="leaderboard-content">
                        <div class="leaderboard-table" id="leaderboard-table">
                            <div class="leaderboard-row header-row">
                                <span class="rank-col">#</span>
                                <span class="name-col">Fighter</span>
                                <span class="wins-col">W</span>
                                <span class="losses-col">L</span>
                                <span class="draws-col">D</span>
                                <span class="winrate-col">Win%</span>
                                <span class="hp-col">HP%</span>
                            </div>
                            <div id="leaderboard-rows"></div>
                        </div>
                    </div>
                </div>
                <div class="matchup-history-container">
                    <div class="matchup-history-header" id="matchup-history-header">
                        <span>MATCHUP MATRIX</span>
                        <button class="toggle-matchup-history-btn" id="toggle-matchup-history-btn">▼</button>
                    </div>
                    <div class="matchup-history-content" id="matchup-history-content">
                        <div id="matchup-details" class="matchup-details"></div>
                    </div>
                </div>
                <div class="tournament-stats">
                    <div class="stat-row">
                        <span class="stat-label">Progress:</span>
                        <span class="stat-value" id="battles-progress">0 / 0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Matchup:</span>
                        <span class="stat-value" id="matchup-progress">0 / 0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Round:</span>
                        <span class="stat-value" id="round-progress">0 / 5</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Elapsed:</span>
                        <span class="stat-value" id="elapsed-time">0s</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">ETA:</span>
                        <span class="stat-value" id="eta-time">Calculating...</span>
                    </div>
                </div>
                <div class="tournament-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="tournament-progress-bar"></div>
                    </div>
                    <div class="progress-percentage" id="progress-percentage">0%</div>
                </div>
                <div class="tournament-controls">
                    <button class="restart-btn danger-btn" id="stop-tournament-btn">STOP TOURNAMENT</button>
                </div>
            </div>
        `;

        document.getElementById('game-wrapper').appendChild(tournamentUI);

        // Bind buttons
        document.getElementById('stop-tournament-btn').addEventListener('click', () => {
            this.stop();
        });

        document.getElementById('minimize-tournament-btn').addEventListener('click', () => {
            this.toggleMinimize();
        });

        document.getElementById('toggle-leaderboard-btn').addEventListener('click', () => {
            this.toggleLeaderboard();
        });

        document.getElementById('toggle-matchup-history-btn').addEventListener('click', () => {
            this.toggleMatchupHistory();
        });

        // Initialize progress display
        this.updateProgressUI();
    }

    /**
     * Toggle minimize state
     */
    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        const content = document.getElementById('tournament-content');
        const btn = document.getElementById('minimize-tournament-btn');
        const ui = document.getElementById('tournament-ui');

        if (this.isMinimized) {
            content.style.display = 'none';
            btn.textContent = '+';
            ui.classList.add('minimized');
        } else {
            content.style.display = 'flex';
            btn.textContent = '−';
            ui.classList.remove('minimized');
        }
    }

    /**
     * Rebuild tournament UI to normal structure (after test phase)
     */
    rebuildTournamentUI() {
        const tournamentUI = document.getElementById('tournament-ui');
        if (!tournamentUI) return;

        tournamentUI.innerHTML = `
            <div class="tournament-header">
                <h2 class="setup-title">AUTO-TOURNAMENT RUNNING</h2>
                <button class="minimize-btn" id="minimize-tournament-btn">−</button>
            </div>
            <div class="tournament-content" id="tournament-content">
                <div class="current-matchup-display">
                    <div class="matchup-title">CURRENT BATTLE</div>
                    <div class="matchup-fighters">
                        <div class="fighter-card p1-card">
                            <span class="fighter-name" id="fighter1-name">---</span>
                        </div>
                        <div class="vs-separator">VS</div>
                        <div class="fighter-card p2-card">
                            <span class="fighter-name" id="fighter2-name">---</span>
                        </div>
                    </div>
                    <div class="matchup-score" id="matchup-score">0 - 0</div>
                </div>
                <div class="leaderboard-container">
                    <div class="leaderboard-header" id="leaderboard-header">
                        <span>LEADERBOARD</span>
                        <button class="toggle-leaderboard-btn" id="toggle-leaderboard-btn">▼</button>
                    </div>
                    <div class="leaderboard-content" id="leaderboard-content">
                        <div class="leaderboard-table" id="leaderboard-table">
                            <div class="leaderboard-row header-row">
                                <span class="rank-col">#</span>
                                <span class="name-col">Fighter</span>
                                <span class="wins-col">W</span>
                                <span class="losses-col">L</span>
                                <span class="draws-col">D</span>
                                <span class="winrate-col">Win%</span>
                                <span class="hp-col">HP%</span>
                            </div>
                            <div id="leaderboard-rows"></div>
                        </div>
                    </div>
                </div>
                <div class="matchup-history-container">
                    <div class="matchup-history-header" id="matchup-history-header">
                        <span>MATCHUP MATRIX</span>
                        <button class="toggle-matchup-history-btn" id="toggle-matchup-history-btn">▼</button>
                    </div>
                    <div class="matchup-history-content" id="matchup-history-content">
                        <div id="matchup-details" class="matchup-details"></div>
                    </div>
                </div>
                <div class="tournament-stats">
                    <div class="stat-row">
                        <span class="stat-label">Progress:</span>
                        <span class="stat-value" id="battles-progress">0 / 0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Matchup:</span>
                        <span class="stat-value" id="matchup-progress">0 / 0</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Round:</span>
                        <span class="stat-value" id="round-progress">0 / 5</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Elapsed:</span>
                        <span class="stat-value" id="elapsed-time">0s</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">ETA:</span>
                        <span class="stat-value" id="eta-time">Calculating...</span>
                    </div>
                </div>
                <div class="tournament-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="tournament-progress-bar"></div>
                    </div>
                    <div class="progress-percentage" id="progress-percentage">0%</div>
                </div>
                <div class="tournament-controls">
                    <button class="restart-btn danger-btn" id="stop-tournament-btn">STOP TOURNAMENT</button>
                </div>
            </div>
        `;

        // Re-bind event listeners
        document.getElementById('stop-tournament-btn').addEventListener('click', () => {
            this.stop();
        });

        document.getElementById('minimize-tournament-btn').addEventListener('click', () => {
            this.toggleMinimize();
        });

        document.getElementById('toggle-leaderboard-btn').addEventListener('click', () => {
            this.toggleLeaderboard();
        });

        document.getElementById('toggle-matchup-history-btn').addEventListener('click', () => {
            this.toggleMatchupHistory();
        });
    }

    /**
     * Toggle leaderboard visibility
     */
    toggleLeaderboard() {
        const content = document.getElementById('leaderboard-content');
        const btn = document.getElementById('toggle-leaderboard-btn');

        if (content.style.display === 'none') {
            content.style.display = 'block';
            btn.textContent = '▼';
        } else {
            content.style.display = 'none';
            btn.textContent = '▶';
        }
    }

    /**
     * Toggle matchup history visibility
     */
    toggleMatchupHistory() {
        const content = document.getElementById('matchup-history-content');
        const btn = document.getElementById('toggle-matchup-history-btn');

        if (content.style.display === 'none') {
            content.style.display = 'block';
            btn.textContent = '▼';
        } else {
            content.style.display = 'none';
            btn.textContent = '▶';
        }
    }

    /**
     * Update progress UI
     */
    updateProgressUI() {
        const progress = this.getProgress();

        // Update progress stats
        const battlesProgressEl = document.getElementById('battles-progress');
        if (battlesProgressEl) {
            battlesProgressEl.textContent = `${progress.completedBattles} / ${progress.totalBattles}`;
        }

        const matchupProgressEl = document.getElementById('matchup-progress');
        if (matchupProgressEl) {
            matchupProgressEl.textContent = `${progress.currentMatchup} / ${progress.totalMatchups}`;
        }

        const roundProgressEl = document.getElementById('round-progress');
        if (roundProgressEl) {
            roundProgressEl.textContent = `${progress.currentRound} / ${progress.roundsPerMatchup}`;
        }

        const elapsedTimeEl = document.getElementById('elapsed-time');
        if (elapsedTimeEl) {
            elapsedTimeEl.textContent = this.formatTime(progress.elapsedTime);
        }

        const etaTimeEl = document.getElementById('eta-time');
        if (etaTimeEl) {
            if (progress.hasValidETA) {
                etaTimeEl.textContent = this.formatTime(progress.etaSeconds);
            } else {
                etaTimeEl.textContent = `Calculating... (${progress.completedBattles}/20)`;
            }
        }

        const progressPctEl = document.getElementById('progress-percentage');
        if (progressPctEl) progressPctEl.textContent = `${progress.percentage}%`;

        // Update progress bar
        const progressBar = document.getElementById('tournament-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress.percentage}%`;
        }

        // Update current battle display
        if (this.currentMatchupIndex < this.matchups.length) {
            const matchup = this.matchups[this.currentMatchupIndex];
            const fighter1Name = this.game.getFighterName(matchup.fighter1);
            const fighter2Name = this.game.getFighterName(matchup.fighter2);

            const f1El = document.getElementById('fighter1-name');
            const f2El = document.getElementById('fighter2-name');
            if (f1El) f1El.textContent = fighter1Name;
            if (f2El) f2El.textContent = fighter2Name;

            // Update matchup score - always show current score or 0-0 for new matchups
            const key = `${matchup.fighter1}_vs_${matchup.fighter2}`;
            const result = this.results.get(key);
            const scoreEl = document.getElementById('matchup-score');
            if (scoreEl) {
                if (result) {
                    scoreEl.textContent = `${result.wins[0]} - ${result.wins[1]}`;
                } else {
                    // New matchup, show 0-0
                    scoreEl.textContent = '0 - 0';
                }
            }
        }

        // Update page title with progress (for background monitoring)
        document.title = `Tournament ${progress.percentage}% - Ball Battler`;

        // Update leaderboard
        this.updateLeaderboard();

        // Update matchup history dropdown
        this.updateMatchupHistoryDropdown();
    }

    /**
     * Update leaderboard display
     */
    updateLeaderboard() {
        const leaderboardRows = document.getElementById('leaderboard-rows');
        if (!leaderboardRows) return;

        // Sort fighters by win rate, then by total wins
        const sortedFighters = Array.from(this.leaderboard.entries())
            .map(([name, stats]) => {
                const totalGames = stats.wins + stats.losses + stats.draws;
                const winRate = totalGames > 0 ? (stats.wins / totalGames * 100).toFixed(1) : 0;
                const avgHpPct = stats.winCount > 0 ? (stats.totalWinHpPct / stats.winCount).toFixed(0) : '-';
                return { name, ...stats, winRate: parseFloat(winRate), totalGames, avgHpPct };
            })
            .sort((a, b) => {
                if (b.winRate !== a.winRate) return b.winRate - a.winRate;
                return b.wins - a.wins;
            });

        leaderboardRows.innerHTML = sortedFighters.map((fighter, index) => {
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
            return `
                <div class="leaderboard-row ${rankClass}">
                    <span class="rank-col">${index + 1}</span>
                    <span class="name-col">${fighter.name}</span>
                    <span class="wins-col">${fighter.wins}</span>
                    <span class="losses-col">${fighter.losses}</span>
                    <span class="draws-col">${fighter.draws}</span>
                    <span class="winrate-col">${fighter.winRate}%</span>
                    <span class="hp-col">${fighter.avgHpPct}${fighter.avgHpPct !== '-' ? '%' : ''}</span>
                </div>
            `;
        }).join('');
    }

    /**
     * Generate 3-letter code from fighter name
     */
    getFighterCode(fighterKey) {
        const name = this.game.getFighterName(fighterKey);

        // Special mappings for better codes
        const customCodes = {
            'SWORDMASTER': 'SWM',
            'KING OF CURSES': 'KOC',
            'RUBBER CAPTAIN': 'RBC',
            'DIVINE GENERAL': 'DVG',
            'DIVINE BRAWLER': 'DVB',
            'BALLISTA': 'BST',
            'MECHA': 'MCH',
            'QUINCY': 'QNC',
            'SNIPER': 'SNP',
            'FRIEREN': 'FRN',
            'LEVI': 'LVI',
            'ICHIGO': 'ICH',
            'GOJO': 'GJO',
            'AXE': 'AXE'
        };

        const upperName = name.toUpperCase();
        if (customCodes[upperName]) {
            return customCodes[upperName];
        }

        // Default: take first 3 letters
        return name.substring(0, 3).toUpperCase();
    }

    /**
     * Update matchup matrix
     */
    updateMatchupHistoryDropdown() {
        const matrixDiv = document.getElementById('matchup-details');
        if (!matrixDiv) return;

        // Get all fighters from matchups
        const fighterKeys = new Set();
        this.matchups.forEach(m => {
            fighterKeys.add(m.fighter1);
            fighterKeys.add(m.fighter2);
        });
        const fighters = Array.from(fighterKeys).sort();

        // Build matrix
        let matrixHTML = '<div class="matchup-matrix-container"><table class="matchup-matrix">';

        // Header row
        matrixHTML += '<tr><th class="matrix-corner"></th>';
        fighters.forEach(f => {
            const code = this.getFighterCode(f);
            matrixHTML += `<th class="matrix-header" title="${this.game.getFighterName(f)}">${code}</th>`;
        });
        matrixHTML += '</tr>';

        // Data rows
        fighters.forEach(f1 => {
            const code1 = this.getFighterCode(f1);
            matrixHTML += `<tr><th class="matrix-header row-header" title="${this.game.getFighterName(f1)}">${code1}</th>`;

            fighters.forEach(f2 => {
                if (f1 === f2) {
                    // Same fighter - show dash
                    matrixHTML += '<td class="matrix-cell self-cell">—</td>';
                } else {
                    // Find result
                    const key1 = `${f1}_vs_${f2}`;
                    const key2 = `${f2}_vs_${f1}`;
                    const result = this.results.get(key1) || this.results.get(key2);

                    if (result) {
                        // Determine which fighter is which
                        const isF1First = result.fighter1 === f1;
                        const f1Wins = isF1First ? result.wins[0] : result.wins[1];
                        const f2Wins = isF1First ? result.wins[1] : result.wins[0];

                        // Determine cell class based on wins
                        let cellClass = 'matrix-cell';
                        if (f1Wins > f2Wins) cellClass += ' win-cell';
                        else if (f1Wins < f2Wins) cellClass += ' loss-cell';
                        else cellClass += ' draw-cell';

                        // Calculate avg HP% for the row fighter's wins in this matchup
                        const f1WinBattles = result.battles.filter(b => {
                            return (isF1First && b.winner === 'fighter1') || (!isF1First && b.winner === 'fighter2');
                        });
                        const avgHp = f1WinBattles.length > 0
                            ? Math.round(f1WinBattles.reduce((s, b) => s + (isF1First ? b.team1HpPct : b.team2HpPct), 0) / f1WinBattles.length)
                            : null;
                        const hpSub = avgHp !== null ? `<div class="matrix-hp-sub">${avgHp}%</div>` : '';

                        const scoreText = `${f1Wins}-${f2Wins}`;
                        const title = `${this.game.getFighterName(f1)} vs ${this.game.getFighterName(f2)}: ${scoreText}`;
                        matrixHTML += `<td class="${cellClass}" title="${title}">${scoreText}${hpSub}</td>`;
                    } else {
                        // Not played yet
                        matrixHTML += '<td class="matrix-cell pending-cell">-</td>';
                    }
                }
            });

            matrixHTML += '</tr>';
        });

        matrixHTML += '</table></div>';
        matrixHTML += '<div class="matrix-legend"><span class="legend-item win-legend">Win</span><span class="legend-item draw-legend">Draw</span><span class="legend-item loss-legend">Loss</span><span class="legend-item pending-legend">Pending</span></div>';

        matrixDiv.innerHTML = matrixHTML;
    }

    /**
     * Update UI during visual test phase
     */
    updateTestPhaseUI() {
        const tournamentUI = document.getElementById('tournament-ui');
        if (!tournamentUI) return;

        const testCount = TOURNAMENT_CONFIG.visualTestCount;

        // Remove screen-overlay class and add test-phase-hud class for non-blocking UI
        tournamentUI.classList.remove('screen-overlay');
        tournamentUI.classList.add('test-phase-hud');

        tournamentUI.innerHTML = `
            <div class="test-phase-header">
                <span class="test-phase-title">PHYSICS TEST ${this.testBattlesComplete + 1}/${testCount}</span>
                <span class="test-phase-speed">${this.timeScale}x Speed</span>
            </div>
            <div class="test-phase-progress">
                <div class="progress-bar-mini" style="width: ${(this.testBattlesComplete / testCount * 100)}%"></div>
            </div>
            <div class="test-phase-info">
                <p>👁️ Watch for physics issues at ${this.timeScale}x speed</p>
            </div>
            <button class="test-stop-btn" id="stop-tournament-btn">STOP</button>
        `;

        // Re-bind stop button
        const stopBtn = document.getElementById('stop-tournament-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stop());
        }
    }

    /**
     * Stop tournament
     */
    stop() {
        this.isRunning = false;
        this.game.running = false;

        // Reset page title
        document.title = 'Ball Battler';

        // Remove tournament UI
        const tournamentUI = document.getElementById('tournament-ui');
        if (tournamentUI) {
            tournamentUI.remove();
        }

        // Show character select again
        this.game.showSelect();
    }

    /**
     * Complete tournament
     */
    complete() {
        this.isRunning = false;
        console.log('Tournament complete!');

        // Reset page title
        document.title = 'Ball Battler';

        // Generate anomaly report
        const anomalyReport = this.generateAnomalyReport();

        // Update UI — keep leaderboard & matrix, replace header/stats/controls
        const tournamentUI = document.getElementById('tournament-ui');
        if (tournamentUI) {
            // Update header
            const header = tournamentUI.querySelector('.tournament-header');
            if (header) {
                header.innerHTML = `<h2 class="setup-title">TOURNAMENT COMPLETE!</h2>`;
            }

            // Remove the current-matchup display and running stats/progress
            const matchupDisplay = tournamentUI.querySelector('.current-matchup-display');
            if (matchupDisplay) matchupDisplay.remove();
            const statsDiv = tournamentUI.querySelector('.tournament-stats');
            if (statsDiv) statsDiv.remove();
            const progressDiv = tournamentUI.querySelector('.tournament-progress');
            if (progressDiv) progressDiv.remove();

            // Remove the old stop button
            const oldControls = tournamentUI.querySelector('.tournament-controls');
            if (oldControls) oldControls.remove();

            // Get the content container (holds leaderboard + matrix)
            const content = document.getElementById('tournament-content');
            if (content) {
                // Ensure leaderboard and matrix are visible
                const lbContent = document.getElementById('leaderboard-content');
                if (lbContent) lbContent.style.display = '';
                const mhContent = document.getElementById('matchup-history-content');
                if (mhContent) mhContent.style.display = '';

                // Append summary stats
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'tournament-info';
                summaryDiv.innerHTML = `
                    <div class="tournament-stat">
                        <span class="stat-label">Total Battles:</span>
                        <span class="stat-value">${this.totalBattlesPlayed}</span>
                    </div>
                    <div class="tournament-stat">
                        <span class="stat-label">Matchups Tested:</span>
                        <span class="stat-value">${this.matchups.length}</span>
                    </div>
                    <div class="tournament-stat">
                        <span class="stat-label">Anomalies:</span>
                        <span class="stat-value ${this.anomalies.length > 0 ? 'anomaly-warning' : ''}">${this.anomalies.length}</span>
                    </div>
                `;
                content.appendChild(summaryDiv);

                // Append toggleable anomaly report
                if (this.anomalies.length > 0) {
                    const anomalySection = document.createElement('div');
                    anomalySection.className = 'anomaly-section';
                    anomalySection.innerHTML = `
                        <div class="anomaly-toggle-header" id="anomaly-toggle-header">
                            <span>ANOMALY REPORT (${this.anomalies.length})</span>
                            <button class="toggle-leaderboard-btn" id="toggle-anomaly-btn">▶</button>
                        </div>
                        <div class="anomaly-toggle-content" id="anomaly-toggle-content" style="display: none;">
                            ${anomalyReport}
                        </div>
                    `;
                    content.appendChild(anomalySection);

                    // Bind toggle
                    anomalySection.querySelector('#anomaly-toggle-header').addEventListener('click', () => {
                        const anomalyContent = document.getElementById('anomaly-toggle-content');
                        const btn = document.getElementById('toggle-anomaly-btn');
                        if (anomalyContent.style.display === 'none') {
                            anomalyContent.style.display = '';
                            btn.textContent = '▼';
                        } else {
                            anomalyContent.style.display = 'none';
                            btn.textContent = '▶';
                        }
                    });
                } else {
                    const passDiv = document.createElement('div');
                    passDiv.innerHTML = anomalyReport;
                    content.appendChild(passDiv);
                }

                // Append DPS time-series charts
                this.generateDpsCharts(content);

                // Append completion message and controls
                const footer = document.createElement('div');
                footer.innerHTML = `
                    <div class="completion-message">
                        <p>All battles have been completed!</p>
                        <p>Battle report will download automatically...</p>
                    </div>
                    <div class="tournament-controls">
                        <button class="restart-btn" id="download-report-btn">DOWNLOAD REPORT NOW</button>
                        <button class="restart-btn" id="back-to-menu-btn">BACK TO MENU</button>
                    </div>
                `;
                content.appendChild(footer);
            }

            // Bind buttons
            document.getElementById('download-report-btn').addEventListener('click', () => {
                this.downloadReport();
            });

            document.getElementById('back-to-menu-btn').addEventListener('click', () => {
                tournamentUI.remove();
                this.game.showSelect();
            });
        }

        // Auto-download report after 2 seconds
        setTimeout(() => {
            this.downloadReport();
        }, 2000);
    }

    /**
     * Generate anomaly report HTML
     */
    generateAnomalyReport() {
        if (this.anomalies.length === 0) {
            return `
                <div class="anomaly-report success">
                    <h3>✅ Physics Validation: PASSED</h3>
                    <p>No anomalies detected. Results are reliable at ${this.timeScale}x speed.</p>
                </div>
            `;
        }

        const anomalyList = this.anomalies.slice(0, 5).map(a => `
            <li>
                <strong>${a.matchup}</strong>: ${a.issues.join(', ')}
            </li>
        `).join('');

        const moreCount = this.anomalies.length > 5 ? this.anomalies.length - 5 : 0;

        return `
            <div class="anomaly-report warning">
                <h3>⚠️ Physics Validation: ${this.anomalies.length} Anomalies Detected</h3>
                <p>Some battles showed suspicious results. Consider reducing timeScale.</p>
                <ul class="anomaly-list">
                    ${anomalyList}
                    ${moreCount > 0 ? `<li><em>...and ${moreCount} more (check console)</em></li>` : ''}
                </ul>
                <p class="anomaly-suggestion">
                    <strong>Recommendation:</strong> If anomaly rate > 5%, reduce timeScale to ${Math.max(1, this.timeScale - 1)}x and re-run.
                </p>
            </div>
        `;
    }

    /**
     * Generate DPS time-series charts for the completion UI
     */
    generateDpsCharts(container) {
        if (this.fighterDpsData.size === 0) return;

        const section = document.createElement('div');
        section.className = 'dps-chart-section';

        // Header with toggle
        const header = document.createElement('div');
        header.className = 'dps-chart-header';
        header.innerHTML = `
            <span>DPS TIME-SERIES</span>
            <button class="toggle-leaderboard-btn" id="toggle-dps-btn">▼</button>
        `;
        section.appendChild(header);

        const content = document.createElement('div');
        content.className = 'dps-chart-content';
        content.id = 'dps-chart-content';

        // Sort fighters by leaderboard rank
        const sortedFighters = Array.from(this.leaderboard.entries())
            .map(([name, stats]) => {
                const total = stats.wins + stats.losses + stats.draws;
                const wr = total > 0 ? stats.wins / total : 0;
                return { name, wr, wins: stats.wins };
            })
            .sort((a, b) => b.wr !== a.wr ? b.wr - a.wr : b.wins - a.wins);

        // Find global max second across all fighters for consistent x-axis
        let globalMaxSecond = 0;
        let globalMaxAvgDps = 0;
        for (const [, data] of this.fighterDpsData) {
            for (const [sec, bucket] of data.seconds) {
                if (sec > globalMaxSecond) globalMaxSecond = sec;
                const avg = bucket.totalDmg / bucket.count;
                if (avg > globalMaxAvgDps) globalMaxAvgDps = avg;
            }
        }

        if (globalMaxSecond === 0 || globalMaxAvgDps === 0) return;

        // Find fighterType from name
        const nameToType = new Map();
        for (const [type, data] of this.fighterDpsData) {
            nameToType.set(data.name, type);
        }

        for (const fighter of sortedFighters) {
            const type = nameToType.get(fighter.name);
            if (!type) continue;
            const data = this.fighterDpsData.get(type);
            if (!data) continue;

            const row = document.createElement('div');
            row.className = 'dps-fighter-row';

            const label = document.createElement('div');
            label.className = 'dps-fighter-label';
            // Calculate total avg DPS
            let totalDmg = 0, totalCount = 0;
            for (const [, bucket] of data.seconds) {
                totalDmg += bucket.totalDmg;
                totalCount += bucket.count;
            }
            const overallAvgDps = totalCount > 0 ? (totalDmg / totalCount).toFixed(1) : '0';
            label.innerHTML = `<span class="dps-fighter-name">${fighter.name}</span><span class="dps-avg-value">${overallAvgDps} avg/s</span>`;

            const canvas = document.createElement('canvas');
            canvas.className = 'dps-canvas';
            const canvasWidth = 600;
            const canvasHeight = 50;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            const ctx = canvas.getContext('2d');

            // Draw background
            ctx.fillStyle = 'rgba(20, 20, 30, 0.8)';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw grid lines at 5-second intervals
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            for (let s = 5; s <= globalMaxSecond; s += 5) {
                const x = (s / globalMaxSecond) * canvasWidth;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvasHeight);
                ctx.stroke();
            }

            // Draw bars
            const barWidth = Math.max(2, canvasWidth / (globalMaxSecond + 1) - 1);
            for (let s = 0; s <= globalMaxSecond; s++) {
                const bucket = data.seconds.get(s);
                if (!bucket) continue;
                const avgDmg = bucket.totalDmg / bucket.count;
                const barHeight = (avgDmg / globalMaxAvgDps) * (canvasHeight - 4);
                const x = (s / (globalMaxSecond + 1)) * canvasWidth;

                // Color gradient: low=cyan, high=red
                const intensity = avgDmg / globalMaxAvgDps;
                const r = Math.floor(intensity * 255);
                const g = Math.floor((1 - intensity * 0.5) * 180);
                const b = Math.floor((1 - intensity) * 255);
                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x, canvasHeight - barHeight - 2, barWidth, barHeight);
            }

            // Draw x-axis time labels
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            const labelInterval = globalMaxSecond > 30 ? 10 : 5;
            for (let s = labelInterval; s <= globalMaxSecond; s += labelInterval) {
                const x = (s / globalMaxSecond) * canvasWidth;
                ctx.fillText(`${s}s`, x, 10);
            }

            row.appendChild(label);
            row.appendChild(canvas);
            content.appendChild(row);
        }

        section.appendChild(content);
        container.appendChild(section);

        // Bind toggle
        header.addEventListener('click', () => {
            const c = document.getElementById('dps-chart-content');
            const btn = document.getElementById('toggle-dps-btn');
            if (c.style.display === 'none') {
                c.style.display = '';
                btn.textContent = '▼';
            } else {
                c.style.display = 'none';
                btn.textContent = '▶';
            }
        });
    }

    /**
     * Download tournament report
     */
    downloadReport() {
        battleLogger.downloadCSV();
    }
}
