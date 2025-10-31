<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { doc, onSnapshot } from 'firebase/firestore';
    import { db, startGameInFirestore } from '$lib/firebase';
    import { goto } from '$app/navigation';
    import { COLORS, GAME_CONFIG } from '$lib/config';

    export let data: { code: string };

    let room: {
        code: string;
        host?: string;
        players?: { [nickname: string]: any };
        createdAt?: Date | null;
        game?: {
            started?: boolean;
        };
    } | null = null;

    let loading = true;
    let error = '';
    let unsub: (() => void) | null = null;
    let myNickname = '';

    onMount(() => {
        myNickname = sessionStorage.getItem('sudoku_nickname') || '';
        
        loading = true;
        const roomRef = doc(db, 'rooms', data.code);

        unsub = onSnapshot(
            roomRef,
            (snap) => {
                if (!snap.exists()) {
                    room = null;
                    error = 'Room not found';
                    loading = false;
                    return;
                }
                const d = snap.data();
                room = {
                    code: snap.id,
                    host: d.host,
                    players: d.players ?? {},
                    createdAt: d.createdAt?.toDate?.() ?? null,
                    game: d.game ?? null
                };
                error = '';
                loading = false;
            },
            (err) => {
                console.error(err);
                error = 'Failed to load room';
                loading = false;
            }
        );
    });

    onDestroy(() => {
        if (unsub) unsub();
    });

    let starting = false;
    async function onStartGame() {
        starting = true;
        try {
            await startGameInFirestore(data.code);
            goto(`/room/${data.code}/game?nickname=${encodeURIComponent(myNickname || room?.host || '')}`);
        } catch (err) {
            console.error(err);
            error = (err as Error)?.message ?? 'Failed to start game';
        } finally {
            starting = false;
        }
    }

    function onJoinGame() {
        if (myNickname) {
            goto(`/room/${data.code}/game?nickname=${encodeURIComponent(myNickname)}`);
        } else {
            error = 'Nickname not found. Please rejoin the room.';
        }
    }

    const goHome = () => goto('/');

    $: playersList = room?.players ? Object.values(room.players) : [];
    $: playerCount = playersList.length;
</script>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    .retro-text {
        font-family: 'Press Start 2P', cursive;
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

<div class="min-h-screen flex items-center justify-center p-4" style="background-color: {COLORS.primary}">
    <div class="retro-box p-6 sm:p-8 w-full max-w-5xl" style="background-color: {COLORS.secondary}">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <div class="w-full sm:w-auto">
                <h1 class="retro-text text-base sm:text-xl mb-2" style="color: {COLORS.primary}">🎮 LOBBY</h1>
                <div class="retro-box px-3 py-2 inline-block" style="background-color: {COLORS.primary}; color: {COLORS.secondary}">
                    <p class="retro-text text-[10px] sm:text-xs break-all">CODE: {data.code}</p>
                </div>
            </div>
            <button
                type="button"
                on:click={goHome}
                class="retro-button hover:opacity-90 px-3 py-2 w-full sm:w-auto"
                style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
            >
                <span class="text-[10px] sm:text-xs">❌ EXIT</span>
            </button>
        </div>

        {#if loading}
            <div class="text-center py-8 sm:py-12">
                <p class="retro-text text-xs sm:text-sm animate-pulse" style="color: {COLORS.primary}">LOADING...</p>
            </div>
        {:else if error}
            <div class="retro-box px-4 py-3 text-center mb-4 sm:mb-6" style="background-color: {COLORS.primary}; color: {COLORS.secondary}">
                <p class="retro-text text-[10px] sm:text-xs">⚠️ {error}</p>
            </div>
        {:else if room}
            <!-- Players Section -->
            <div class="retro-box bg-white p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 class="retro-text text-[10px] sm:text-xs mb-3 sm:mb-4" style="color: {COLORS.primary}">
                    👥 PLAYERS ({playerCount}/{GAME_CONFIG.maxPlayers})
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                    {#each playersList as player}
                        <div class="retro-box p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2" style="background-color: {COLORS.secondary}">
                            <div class="flex items-center gap-2 sm:gap-3">
                                <span class="text-xl sm:text-2xl">🎯</span>
                                <span class="retro-text text-[10px] sm:text-xs break-all" style="color: {COLORS.primary}">{player.nickname}</span>
                            </div>
                            {#if player.nickname === room.host}
                                <span class="retro-box px-2 py-1 self-start sm:self-center" style="background-color: {COLORS.primary}; color: {COLORS.secondary}">
                                    <span class="retro-text text-[8px] sm:text-[10px]">👑 HOST</span>
                                </span>
                            {/if}
                        </div>
                    {/each}
                    
                    {#if playerCount < GAME_CONFIG.maxPlayers}
                        <div class="retro-box bg-white p-3 sm:p-4 border-dashed">
                            <p class="retro-text text-[10px] sm:text-xs text-gray-500 text-center">
                                WAITING...
                            </p>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col gap-3 sm:gap-4">
                <button
                    class="retro-button hover:opacity-90 py-3 sm:py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                    on:click={onStartGame}
                    disabled={starting || room.game?.started || !myNickname || playerCount < GAME_CONFIG.minPlayers}
                >
                    <span class="text-[10px] sm:text-xs">
                        {starting ? '⏳ STARTING...' : room.game?.started ? '✓ STARTED' : '🚀 START GAME'}
                    </span>
                </button>

                {#if room.game?.started}
                    <button
                        class="retro-button hover:opacity-90 py-3 sm:py-4 disabled:opacity-50"
                        style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
                        on:click={onJoinGame}
                        disabled={!myNickname}
                    >
                        <span class="text-[10px] sm:text-xs">🎯 JOIN GAME</span>
                    </button>
                {/if}
            </div>

            {#if playerCount < GAME_CONFIG.minPlayers}
                <div class="retro-box px-4 py-3 text-center mt-4 sm:mt-6" style="background-color: {COLORS.primary}; color: {COLORS.secondary}">
                    <p class="retro-text text-[10px] sm:text-xs">⚠️ NEED {GAME_CONFIG.minPlayers} PLAYERS</p>
                </div>
            {/if}
        {/if}
    </div>
</div>