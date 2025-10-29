<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { doc, onSnapshot } from 'firebase/firestore';
    import { db } from '$lib/firebase';
    import { goto } from '$app/navigation';

    export let data: { code: string };

    let room: any = null;
    let unsub: (() => void) | null = null;
    let loading = true;
    let error = '';

    onMount(() => {
        const ref = doc(db, 'rooms', data.code);
        unsub = onSnapshot(
            ref,
            (snap) => {
                if (!snap.exists()) {
                    error = 'Room not found';
                    loading = false;
                    return;
                }
                room = snap.data();
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

    const goBack = () => goto(`/room/${data.code}`);

    function cellAt(board: string | undefined, r: number, c: number) {
        if (!board) return '.';
        return board[r * 9 + c];
    }

    // helper to mark thick borders for 3x3 blocks
    function borderClasses(r: number, c: number) {
        const top = r % 3 === 0 ? 'border-t-2' : 'border-t';
        const left = c % 3 === 0 ? 'border-l-2' : 'border-l';
        const right = c === 8 ? 'border-r-2' : 'border-r';
        const bottom = r === 8 ? 'border-b-2' : 'border-b';
        return `${top} ${left} ${right} ${bottom} border-gray-300`;
    }
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 p-6">
    <div class="w-full max-w-3xl bg-white rounded-2xl shadow-md p-6">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold">Game — Room {data.code}</h2>
            <button on:click={goBack} class="text-sm bg-gray-200 px-3 py-1 rounded">Back to Lobby</button>
        </div>

        {#if loading}
            <div class="mt-6 text-gray-500">Loading...</div>
        {:else if error}
            <div class="mt-6 text-red-500">{error}</div>
        {:else}
            {#if room?.game?.started}
                <div class="mt-6 grid place-items-center">
                    <div class="grid grid-cols-9 gap-0 bg-gray-300 p-1 rounded">
                        {#each Array(9) as _, r}
                            {#each Array(9) as _, c}
                                {@const i = r * 9 + c}
                                <div class={`w-10 h-10 flex items-center justify-center bg-white ${borderClasses(r,c)}`}>
                                    <span class="text-lg font-medium">
                                        {#if room.game.board && room.game.board[i] !== '.' && room.game.board[i] !== '0'}
                                            {room.game.board[i]}
                                        {:else}
                                            &nbsp;
                                        {/if}
                                    </span>
                                </div>
                            {/each}
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="mt-6 text-gray-600">Waiting for host to start the game.</div>
            {/if}
        {/if}
    </div>
</div>