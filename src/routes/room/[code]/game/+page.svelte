<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { doc, onSnapshot } from 'firebase/firestore';
    import { db, makeMove, checkGameOver, type GameState } from '$lib/firebase';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';

    const nickname = $page.url.searchParams.get('nickname') ?? '';
    const code = $page.params.code;

    let room: { game?: GameState; host?: string } | null = null;
    let unsub: (() => void) | null = null;
    let loading = true;
    let error = '';
    let lastMoveResult: boolean | null = null;

    onMount(() => {
        if (!code || !nickname) {
            error = 'Missing room code or nickname';
            loading = false;
            return;
        }

        const ref = doc(db, 'rooms', code);
        unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    error = 'Room not found';
                    loading = false;
                    return;
                }
                room = snap.data() as any;
                loading = false;
            },
            (err) => {
                console.error(err);
                error = 'Failed to load game';
                loading = false;
            }
        );
    });

    onDestroy(() => {
        if (unsub) unsub();
    });

    const goBack = () => goto(`/room/${code}`);

    function borderClasses(r: number, c: number) {
        const top = r % 3 === 0 ? 'border-t-2' : 'border-t';
        const left = c % 3 === 0 ? 'border-l-2' : 'border-l';
        const right = c === 8 ? 'border-r-2' : 'border-r';
        const bottom = r === 8 ? 'border-b-2' : 'border-b';
        return `${top} ${left} ${right} ${bottom} border-gray-300`;
    }

    async function handleCellClick(position: number) {
        if (!room?.game || !nickname) return;
        
        const game = room.game;
        const player = game.players[nickname];
        
        if (!player?.isCurrentPlayer) return;
        if (game.board[position] !== '.') return;
        
        try {
            lastMoveResult = await makeMove(code ?? '', nickname, position);
        } catch (err) {
            console.error(err);
            error = (err as Error)?.message ?? 'Failed to make move';
        }
    }

    $: isMyTurn = room?.game?.players[nickname]?.isCurrentPlayer ?? false;
    $: currentNumber = room?.game?.currentNumber;
    $: winner = room?.game ? checkGameOver(room.game) : null;
    $: gameOver = winner !== null;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold">Game — Room {code}</h2>
            <button on:click={goBack} class="text-sm bg-gray-200 px-3 py-1 rounded">Back to Lobby</button>
        </div>

        {#if loading}
            <div class="mt-6 text-gray-500">Loading...</div>
        {:else if error}
            <div class="mt-6 text-red-500">{error}</div>
        {:else if room?.game?.started}
            <!-- Game Status -->
            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <!-- Players -->
                <div class="space-y-2">
                    {#each Object.values(room.game.players ?? {}) as player}
                        <div class="flex items-center justify-between p-2 rounded bg-gray-50">
                            <span class="flex items-center gap-2">
                                <span class={player.isCurrentPlayer ? "text-blue-600 font-medium" : "text-gray-600"}>
                                    {player.nickname}
                                </span>
                                {#if player.nickname === room.host}
                                    <span class="text-xs bg-blue-100 text-blue-600 px-1 rounded">host</span>
                                {/if}
                            </span>
                            <span class="flex gap-1">
                                {#each Array(3) as _, i}
                                    <span class={i < player.lives ? "text-red-500" : "text-gray-300"}>❤</span>
                                {/each}
                            </span>
                        </div>
                    {/each}
                </div>

                <!-- Current Number -->
                <div class="text-center">
                    {#if gameOver}
                        <div class="text-xl font-bold text-green-600">
                            Game Over! {winner} wins!
                        </div>
                    {:else}
                        <div class="text-gray-600">Current Number</div>
                        <div class="text-4xl font-bold text-blue-600">{currentNumber}</div>
                        {#if isMyTurn}
                            <div class="mt-2 text-green-600">Your turn!</div>
                        {/if}
                    {/if}
                </div>
            </div>

            <!-- Game Board -->
            <div class="grid place-items-center">
                <div class="grid grid-cols-9 gap-0 bg-gray-300 p-1 rounded">
                    {#each Array(9) as _, r}
                        {#each Array(9) as _, c}
                            {@const position = r * 9 + c}
                            {@const value = room.game.board[position]}
                            {@const isPuzzleNumber = room.game.puzzle[position] !== '.'}
                            <!-- svelte-ignore a11y-click-events-have-key-events -->
                            <div
                                role="button"
                                tabindex="{r}"
                                class={`
                                    w-10 h-10 flex items-center justify-center bg-white
                                    ${borderClasses(r,c)}
                                    ${isPuzzleNumber ? 'bg-gray-50' : 'hover:bg-blue-50 cursor-pointer'}
                                    ${isMyTurn && !isPuzzleNumber ? 'cursor-pointer' : 'cursor-not-allowed'}
                                `}
                                on:click={() => !isPuzzleNumber && handleCellClick(position)}
                            >
                                <span class={`text-lg font-medium ${isPuzzleNumber ? 'text-gray-900' : 'text-blue-600'}`}>
                                    {value !== '.' ? value : ''}
                                </span>
                            </div>
                        {/each}
                    {/each}
                </div>
            </div>

            {#if lastMoveResult !== null}
                <div class="mt-4 text-center">
                    <div class={lastMoveResult ? "text-green-600" : "text-red-600"}>
                        {lastMoveResult ? "Correct!" : "Wrong! Lost a life!"}
                    </div>
                </div>
            {/if}
        {:else}
            <div class="mt-6 text-gray-600">Waiting for host to start the game.</div>
        {/if}
    </div>
</div>