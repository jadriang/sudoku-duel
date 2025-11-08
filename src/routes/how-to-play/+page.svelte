<script lang="ts">
    import { goto } from '$app/navigation';
    import { COLORS, GAME_CONFIG } from '$lib/config';

    function goHome() {
        goto('/');
    }
</script>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    .retro-text {
        font-family: 'Press Start 2P', cursive;
        text-shadow: 2px 2px 0px rgba(0, 0, 0, 0.3);
    }
    
    .retro-box {
        border: 3px solid #000;
        box-shadow: 6px 6px 0px rgba(0, 0, 0, 0.3);
    }
    
    .retro-button {
        font-family: 'Press Start 2P', cursive;
        border: 3px solid #000;
        box-shadow: 4px 4px 0px rgba(0, 0, 0, 0.3);
        transition: all 0.1s ease;
    }
    
    .retro-button:active:not(:disabled) {
        box-shadow: 2px 2px 0px rgba(0, 0, 0, 0.3);
        transform: translate(2px, 2px);
    }
</style>

<div class="min-h-screen flex flex-col items-center justify-center p-4" style="background-color: {COLORS.primary}">
    <!-- Title -->
    <div class="mb-6 text-center">
        <h1 class="retro-text text-2xl sm:text-4xl md:text-5xl mb-2 animate-pulse" style="color: {COLORS.secondary}">
            🎮 HOW TO
        </h1>
        <h1 class="retro-text text-2xl sm:text-4xl md:text-5xl mb-3 animate-pulse" style="color: {COLORS.secondary}">
            PLAY
        </h1>
    </div>

    <!-- Instructions Card -->
    <div class="retro-box p-6 sm:p-8 w-full max-w-3xl mx-4 mb-6" style="background-color: {COLORS.secondary}">
        
        <!-- Game Overview -->
        <div class="retro-box bg-white p-4 mb-6">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">📋 OVERVIEW</h2>
            <p class="text-sm sm:text-base leading-relaxed mb-2">
                Sudoku Duel is a competitive multiplayer Sudoku game where players take turns placing numbers on a shared board.
            </p>
            <p class="text-sm sm:text-base leading-relaxed">
                Make correct moves to keep your lives and force your opponents to make mistakes!
            </p>
        </div>

        <!-- Setup -->
        <div class="retro-box bg-white p-4 mb-6">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">🚀 SETUP</h2>
            <ol class="text-sm sm:text-base leading-relaxed space-y-2 list-decimal list-inside">
                <li><strong>Create Account:</strong> Sign up with email and verify your email address</li>
                <li><strong>Create Room:</strong> Click "CREATE" to start a new game room</li>
                <li><strong>Share Code:</strong> Share the room code with {GAME_CONFIG.minPlayers}-{GAME_CONFIG.maxPlayers} friends</li>
                <li><strong>Wait for Players:</strong> Need at least {GAME_CONFIG.minPlayers} players to start</li>
                <li><strong>Start Game:</strong> Host clicks "START GAME" when ready</li>
            </ol>
        </div>

        <!-- Gameplay -->
        <div class="retro-box bg-white p-4 mb-6">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">🎯 GAMEPLAY</h2>
            <div class="space-y-3 text-sm sm:text-base leading-relaxed">
                <div>
                    <p class="font-bold mb-1">❤️ Lives: {GAME_CONFIG.maxLives} per player</p>
                    <p class="ml-4">Each player starts with {GAME_CONFIG.maxLives} hearts. Make a mistake and lose one!</p>
                </div>
                
                <div>
                    <p class="font-bold mb-1">🔢 Turn System</p>
                    <p class="ml-4">Players take turns in rotation. You can only play when it's YOUR TURN!</p>
                </div>
                
                <div>
                    <p class="font-bold mb-1">🎲 Number Assignment</p>
                    <p class="ml-4">Each turn, you're given a specific number to place on the board.</p>
                </div>
                
                <div>
                    <p class="font-bold mb-1">✅ Making Moves</p>
                    <ul class="ml-4 list-disc list-inside space-y-1">
                        <li>Click any empty cell on your turn</li>
                        <li>The assigned number will be placed if correct</li>
                        <li>Correct moves stay on the board</li>
                        <li>Wrong moves cost you 1 life (number disappears)</li>
                    </ul>
                </div>
            </div>
        </div>

        <!-- Winning -->
        <div class="retro-box bg-white p-4 mb-6">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">🏆 WINNING</h2>
            <p class="text-sm sm:text-base leading-relaxed mb-3">
                The game ends when:
            </p>
            <ul class="text-sm sm:text-base leading-relaxed space-y-2 list-disc list-inside ml-4">
                <li><strong>Player Elimination:</strong> A player loses all {GAME_CONFIG.maxLives} lives (others win)</li>
                <li><strong>Board Complete:</strong> All cells filled correctly (player with most lives wins)</li>
            </ul>
            <div class="retro-box mt-4 p-3 text-center" style="background-color: {COLORS.secondary}">
                <p class="retro-text text-[10px] sm:text-xs" style="color: {COLORS.primary}">
                    WINNER = MOST LIVES!
                </p>
            </div>
        </div>

        <!-- Tips -->
        <div class="retro-box bg-white p-4 mb-6">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">💡 PRO TIPS</h2>
            <ul class="text-sm sm:text-base leading-relaxed space-y-2 list-disc list-inside ml-4">
                <li>Study the board before your turn</li>
                <li>Use Sudoku logic: check rows, columns, and 3×3 boxes</li>
                <li>Remember: only correct numbers stay on the board</li>
                <li>Watch move history to track what numbers were tried</li>
                <li>Each game lasts 2 hours before auto-expiring</li>
            </ul>
        </div>

        <!-- Sudoku Rules Reminder -->
        <div class="retro-box bg-white p-4">
            <h2 class="retro-text text-xs sm:text-sm mb-3" style="color: {COLORS.primary}">📐 SUDOKU RULES</h2>
            <ul class="text-sm sm:text-base leading-relaxed space-y-2 list-disc list-inside ml-4">
                <li>Each <strong>row</strong> must contain numbers 1-9 (no repeats)</li>
                <li>Each <strong>column</strong> must contain numbers 1-9 (no repeats)</li>
                <li>Each <strong>3×3 box</strong> must contain numbers 1-9 (no repeats)</li>
                <li>Some numbers are given at the start (cannot be changed)</li>
            </ul>
        </div>

        <!-- Back Button -->
        <div class="mt-6">
            <button
                type="button"
                on:click={goHome}
                class="retro-button w-full py-3 sm:py-4 hover:opacity-90"
                style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
            >
                <span class="text-[10px] sm:text-xs">← BACK TO HOME</span>
            </button>
        </div>
    </div>

    <!-- Footer -->
    <div class="mt-6 text-center">
        <p class="retro-text text-[8px] sm:text-[10px] text-white opacity-50">
            © 2025 SUDOKU DUEL
        </p>
    </div>
</div>
