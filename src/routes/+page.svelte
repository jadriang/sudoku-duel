<script lang="ts">
    import { goto } from '$app/navigation';
    import { createRoomInFirestore, joinRoomInFirestore } from '$lib/firebase';
    import { COLORS } from '$lib/config';

    let nickname = '';
    let roomCode = '';
    let loading = false;
    let error = '';
    let mode: 'create' | 'join' | null = null;

    const createRoom = async () => {
        if (!nickname.trim()) {
            error = 'Please enter a nickname';
            return;
        }
        loading = true;
        error = '';

        try {
            sessionStorage.setItem('sudoku_nickname', nickname.trim());
            const roomId = await createRoomInFirestore(nickname.trim());
            goto(`/room/${roomId}`);
        } catch (err) {
            console.error(err);
            error = (err as Error)?.message ?? 'Failed to create room.';
        } finally {
            loading = false;
        }
    };

    const joinRoom = async () => {
        if (!nickname.trim() || !roomCode.trim()) {
            error = 'Please enter your nickname and room code.';
            return;
        }
        loading = true;
        error = '';

        try {
            const code = roomCode.trim();
            sessionStorage.setItem('sudoku_nickname', nickname.trim());
            await joinRoomInFirestore(code, nickname.trim());
            goto(`/room/${code}`);
        } catch (err) {
            console.error(err);
            error = (err as Error)?.message ?? 'Failed to join room.';
        } finally {
            loading = false;
        }
    };

    function resetMode() {
        mode = null;
        roomCode = '';
        error = '';
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
    <div class="mb-8 text-center">
        <h1 class="retro-text text-2xl sm:text-4xl md:text-5xl mb-2 animate-pulse" style="color: {COLORS.secondary}">
            🎮 SUDOKU
        </h1>
        <h1 class="retro-text text-2xl sm:text-4xl md:text-5xl mb-3 animate-pulse" style="color: {COLORS.secondary}">
            DUEL
        </h1>
        <p class="retro-text text-[10px] sm:text-xs text-white opacity-75">
            BATTLE OF NUMBERS
        </p>
    </div>

    <!-- Main Card -->
    <div class="retro-box p-6 sm:p-8 w-full max-w-md mx-4" style="background-color: {COLORS.secondary}">
        {#if mode === null}
            <!-- Initial Mode Selection -->
            <label class="retro-text text-[10px] sm:text-xs block mb-2" style="color: {COLORS.primary}">PLAYER NAME:</label>
            <input
                type="text"
                bind:value={nickname}
                class="retro-box w-full bg-white px-3 py-2 sm:py-3 mb-6 text-center font-mono text-base sm:text-lg uppercase focus:outline-none focus:ring-4"
                style="focus:ring-color: {COLORS.primary}"
                placeholder="ENTER NAME"
                maxlength="20"
            />

            <div class="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    on:click={() => mode = 'create'}
                    class="retro-button hover:opacity-90 py-3 sm:py-4"
                    style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                    disabled={!nickname.trim()}
                >
                    <span class="text-[10px] sm:text-xs">🚀 CREATE</span>
                </button>

                <button
                    type="button"
                    on:click={() => mode = 'join'}
                    class="retro-button hover:opacity-90 py-3 sm:py-4"
                    style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                    disabled={!nickname.trim()}
                >
                    <span class="text-[10px] sm:text-xs">🎯 JOIN</span>
                </button>
            </div>

        {:else if mode === 'create'}
            <!-- Create Room Confirmation -->
            <div class="text-center mb-6">
                <p class="retro-text text-xs sm:text-sm mb-4" style="color: {COLORS.primary}">
                    CREATE ROOM?
                </p>
                <p class="text-sm mb-4" style="color: {COLORS.primary}">
                    Player: <span class="font-bold">{nickname}</span>
                </p>
            </div>

            <div class="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    on:click={resetMode}
                    class="retro-button hover:opacity-90 py-3 bg-gray-500 text-white"
                >
                    <span class="text-[10px] sm:text-xs">← BACK</span>
                </button>

                <button
                    type="button"
                    on:click={createRoom}
                    class="retro-button hover:opacity-90 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                    disabled={loading}
                >
                    <span class="text-[10px] sm:text-xs">{loading ? '⏳...' : '✓ CREATE'}</span>
                </button>
            </div>

        {:else if mode === 'join'}
            <!-- Join Room -->
            <label class="retro-text text-[10px] sm:text-xs block mb-2" style="color: {COLORS.primary}">ROOM CODE:</label>
            <input
                type="text"
                bind:value={roomCode}
                class="retro-box w-full bg-white px-3 py-2 sm:py-3 mb-4 text-center font-mono text-base sm:text-lg uppercase focus:outline-none focus:ring-4"
                style="focus:ring-color: {COLORS.primary}"
                placeholder="ENTER CODE"
            />

            <div class="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    on:click={resetMode}
                    class="retro-button hover:opacity-90 py-3 bg-gray-500 text-white"
                >
                    <span class="text-[10px] sm:text-xs">← BACK</span>
                </button>

                <button
                    type="button"
                    on:click={joinRoom}
                    class="retro-button hover:opacity-90 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                    disabled={loading}
                >
                    <span class="text-[10px] sm:text-xs">{loading ? '⏳...' : '✓ JOIN'}</span>
                </button>
            </div>
        {/if}

        <!-- Error Message -->
        {#if error}
            <div class="retro-box mt-4 sm:mt-6 px-3 py-2 sm:py-3 text-center" style="background-color: {COLORS.primary}; color: {COLORS.secondary}">
                <p class="text-[10px] sm:text-xs font-bold">⚠️ {error}</p>
            </div>
        {/if}
    </div>

    <!-- Footer -->
    <div class="mt-6 sm:mt-8 text-center">
        <p class="retro-text text-[8px] sm:text-[10px] text-white opacity-50">
            © 2025 SUDOKU DUEL
        </p>
    </div>
</div>