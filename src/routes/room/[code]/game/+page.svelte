<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
    import { db, makeMove, type GameState, type Move } from '$lib/firebase';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';

    let nickname = '';
    const code = $page.params.code;

    let room: { 
        game?: GameState; 
        host?: string;
        status?: 'waiting' | 'active' | 'finished';
    } | null = null;
    let moves: Move[] = [];
    let unsub: Array<() => void> = [];
    let loading = true;
    let error = '';
    let lastMoveResult: boolean | null = null;

    onMount(() => {
        nickname = $page.url.searchParams.get('nickname') || '';
        if (!nickname && browser) {
            nickname = sessionStorage.getItem('sudoku_nickname') || '';
        }

        if (!code || !nickname) {
            error = 'Missing room code or nickname';
            loading = false;
            return;
        }

        // Subscribe to room document
        const roomRef = doc(db, 'rooms', code);
        const unsubRoom = onSnapshot(
            roomRef,
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

        // Subscribe to moves collection with ordering
        const movesRef = collection(db, 'rooms', code, 'moves');
        const movesQuery = query(movesRef, orderBy('moveNumber', 'desc'));
        const unsubMoves = onSnapshot(
            movesQuery,
            (snapshot) => {
                moves = snapshot.docs.map(doc => doc.data() as Move);
            },
            (err) => console.error('Failed to load moves:', err)
        );

        unsub = [unsubRoom, unsubMoves];
    });

    onDestroy(() => {
        unsub.forEach(fn => fn());
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
            lastMoveResult = await makeMove(code as string, nickname, position);
            // Clear result after 2 seconds
            setTimeout(() => lastMoveResult = null, 2000);
        } catch (err) {
            console.error(err);
            error = (err as Error)?.message ?? 'Failed to make move';
        }
    }

    function formatTimestamp(timestamp: any): string {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString();
    }

    $: isMyTurn = room?.game?.players[nickname]?.isCurrentPlayer ?? false;
    $: currentNumber = room?.game?.currentNumber;
    $: myLives = room?.game?.players[nickname]?.lives ?? 3;
    $: lastMove = moves[0]; // First item since we're ordering by desc
    $: winner = room?.game?.winner;
    $: gameOver = room?.status === 'finished' || winner !== null;
    $: playersList = room?.game?.players ? Object.values(room.game.players) : [];
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <div class="w-full max-w-6xl bg-white rounded-2xl shadow-md p-6">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold">Game — Room {code}</h2>
            <button on:click={goBack} class="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">
                Back to Lobby
            </button>
        </div>

        {#if loading}
            <div class="mt-6 text-center text-gray-500">Loading game...</div>
        {:else if error}
            <div class="mt-6 text-center text-red-500">{error}</div>
        {:else if room?.game?.started}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column: Players & Current Number -->
                <div class="space-y-4">
                    <!-- Game Over / Current Number -->
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                        {#if gameOver}
                            <div class="space-y-2">
                                <div class="text-3xl">🏆</div>
                                <div class="text-xl font-bold text-green-600">Game Over!</div>
                                <div class="text-lg font-semibold text-gray-800">{winner} Wins!</div>
                                <button 
                                    on:click={goBack}
                                    class="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
                                >
                                    Return to Lobby
                                </button>
                            </div>
                        {:else}
                            <div class="text-gray-600 mb-1">Current Number</div>
                            <div class="text-5xl font-bold text-blue-600">{currentNumber}</div>
                            {#if isMyTurn}
                                <div class="mt-2 text-green-600 font-medium animate-pulse">Your turn!</div>
                            {/if}
                        {/if}
                    </div>

                    <!-- Players List -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h3 class="text-sm font-semibold text-gray-600 mb-3">Players</h3>
                        <div class="space-y-2">
                            {#each playersList as player}
                                <div class="flex items-center justify-between p-3 rounded-lg bg-white border {player.isCurrentPlayer ? 'border-blue-400 shadow-sm' : 'border-gray-200'}">
                                    <div class="flex items-center gap-2">
                                        <span class={player.isCurrentPlayer ? "text-blue-600 font-semibold" : "text-gray-700"}>
                                            {player.nickname}
                                        </span>
                                        {#if player.nickname === room.host}
                                            <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">host</span>
                                        {/if}
                                    </div>
                                    <div class="flex gap-1">
                                        {#each Array(3) as _, i}
                                            {#if i < player.lives}
                                                <span class="text-red-500 text-lg">❤️</span>
                                            {:else}
                                                <span class="text-gray-300 text-lg">🤍</span>
                                            {/if}
                                        {/each}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- Move Result Feedback -->
                    {#if lastMoveResult !== null}
                        <div class="p-3 rounded-lg text-center font-medium {lastMoveResult ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                            {#if lastMoveResult}
                                ✓ Correct!
                            {:else}
                                ✗ Wrong! {myLives} {myLives === 1 ? 'life' : 'lives'} remaining
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Middle Column: Game Board -->
                <div class="flex flex-col items-center justify-start">
                    <div class="grid grid-cols-9 gap-0 bg-gray-400 p-1 rounded-lg shadow-lg">
                        {#each Array(9) as _, r}
                            {#each Array(9) as _, c}
                                {@const position = r * 9 + c}
                                {@const value = room.game.board[position]}
                                {@const isPuzzleNumber = room.game.puzzle[position] !== '.'}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class={`
                                        w-12 h-12 flex items-center justify-center bg-white
                                        ${borderClasses(r,c)}
                                        ${isPuzzleNumber ? 'bg-gray-100' : ''}
                                        ${isMyTurn && !isPuzzleNumber && !gameOver ? 'hover:bg-blue-50 cursor-pointer active:bg-blue-100' : 'cursor-not-allowed'}
                                        transition-colors
                                    `}
                                    on:click={() => !isPuzzleNumber && !gameOver && handleCellClick(position)}
                                    role="button"
                                    tabindex={isMyTurn && !isPuzzleNumber && !gameOver ? 0 : -1}
                                >
                                    <span class={`text-xl font-medium ${isPuzzleNumber ? 'text-gray-900 font-bold' : 'text-blue-600'}`}>
                                        {value !== '.' ? value : ''}
                                    </span>
                                </div>
                            {/each}
                        {/each}
                    </div>
                </div>

                <!-- Right Column: Move History -->
                <div class="bg-gray-50 rounded-lg p-4">
                    <h3 class="text-sm font-semibold text-gray-600 mb-3">Move History</h3>
                    <div class="space-y-2 max-h-[600px] overflow-y-auto">
                        {#if moves.length === 0}
                            <div class="text-sm text-gray-400 text-center py-4">No moves yet</div>
                        {:else}
                            {#each moves as move}
                                <div class="bg-white rounded p-3 text-sm border {move.isValid ? 'border-green-200' : 'border-red-200'}">
                                    <div class="flex items-center justify-between mb-1">
                                        <span class="font-semibold text-gray-700">#{move.moveNumber}</span>
                                        <span class="text-xs text-gray-500">{formatTimestamp(move.timestamp)}</span>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-gray-600">{move.player}</span>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-blue-600">{move.numberPlaced}</span>
                                            <span class={move.isValid ? 'text-green-600' : 'text-red-600'}>
                                                {move.isValid ? '✓' : '✗'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>
        {:else}
            <div class="mt-6 text-center text-gray-600">Waiting for host to start the game...</div>
        {/if}
    </div>
</div>