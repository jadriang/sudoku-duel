<script lang="ts">
    import { goto } from '$app/navigation';
    import { createRoomInFirestore, joinRoomInFirestore } from '$lib/firebase';

    let nickname = '';
    let roomCode = '';
    let loading = false;
    let error = '';

    const createRoom = async () => {
        if (!nickname.trim()) {
            error = 'Please enter a nickname';
            return;
        }
        loading = true;
        error = '';

        try {
            // Store nickname in sessionStorage
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
            // Store nickname in sessionStorage
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
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-gray-200 p-6">
    <h1 class="text-4xl font-bold mb-8 text-gray-800">🧩 Sudoku Duel</h1>

    <div class="bg-white rounded-2xl shadow-md p-6 w-full max-w-sm">
        <span class="block mb-2 text-gray-700 font-semibold">Your Nickname</span>
        <input
            type="text"
            bind:value={nickname}
            class="w-full border rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter nickname"
            maxlength="20"
        />

        <!-- Create Room -->
        <button
            type="button"
            on:click={createRoom}
            class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg mb-4 transition disabled:opacity-50"
            disabled={loading}
        >
            {loading ? 'Creating...' : 'Create Room'}
        </button>

        <div class="my-4 text-center text-gray-500">OR</div>

        <!-- Join Room -->
        <input
            type="text"
            bind:value={roomCode}
            class="w-full border rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter room code"
        />
        <button
            type="button"
            on:click={joinRoom}
            class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 rounded-lg transition disabled:opacity-50"
            disabled={loading}
        >
            {loading ? 'Joining...' : 'Join Room'}
        </button>

        {#if error}
            <p class="text-red-500 text-center mt-4">{error}</p>
        {/if}
    </div>
</div>