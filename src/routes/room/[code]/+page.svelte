<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { doc, onSnapshot } from 'firebase/firestore';
	import { db, startGameInFirestore } from '$lib/firebase';
	import { goto } from '$app/navigation';

	export let data: { code: string };

	let room: {
		code: string;
		host?: string;
		players?: string[];
		createdAt?: Date | null;
        game?: {
            started?: boolean;
        }
	} | null = null;

	let loading = true;
	let error = '';
	let unsub: (() => void) | null = null;

	onMount(() => {
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
					players: d.players ?? [],
					createdAt: d.createdAt?.toDate?.() ?? null,
                    game: d.game ?? null,
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
			goto(`/room/${data.code}/game`);
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to start game';
		} finally {
			starting = false;
		}
	}

    function onJoinGame() {
        // navigate to the game page — disabled in UI unless game started
        goto(`/room/${data.code}/game`);
    }

	const goHome = () => goto('/');
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-100 p-6">
	<div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-md">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-800">Room</h1>
				<p class="text-sm text-gray-500">
					Code: <span class="font-mono text-gray-700">{data.code}</span>
				</p>
			</div>
			<button
				type="button"
				on:click={goHome}
				class="rounded-md bg-gray-200 px-3 py-1 text-sm transition hover:bg-gray-300"
			>
				Back
			</button>
		</div>

		{#if loading}
			<div class="mt-6 text-center text-gray-500">Loading room...</div>
		{:else if error}
			<div class="mt-6 text-center text-red-500">{error}</div>
		{:else if room}
			<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
				<div>
					<h2 class="mb-2 text-sm font-semibold text-gray-600">Host</h2>
					<div class="text-lg font-medium text-gray-800">{room.host ?? '—'}</div>

					<h2 class="mt-4 mb-2 text-sm font-semibold text-gray-600">Created</h2>
					<div class="text-sm text-gray-700">
						{#if room.createdAt}
							{room.createdAt.toLocaleString()}
						{:else}
							—
						{/if}
					</div>
				</div>

				<div>
					<h2 class="mb-2 text-sm font-semibold text-gray-600">
						Players ({room.players?.length ?? 0})
					</h2>
					<ul class="space-y-2">
						{#each room.players ?? [] as p}
							<li class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
								<span class="text-gray-800">{p}</span>
								{#if p === room.host}
									<span class="text-xs font-semibold text-blue-600">host</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</div>

			<div class="mt-6 flex items-center gap-3">
				<button
					class="rounded-lg bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
					on:click={onStartGame}
					disabled={starting || room.game?.started}
				>
					{starting ? 'Starting...' : 'Start Game'}
				</button>

                <button
                    class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                    on:click={onJoinGame}
                    disabled={loading || !room?.game?.started}
                    title={room?.game?.started ? 'Join the game' : 'Waiting for host to start the game'}
                >
                    Join Game
                </button>

				<button class="rounded-lg bg-red-100 px-4 py-2 text-red-700" on:click={goHome}>
					Leave
				</button>
			</div>
		{/if}
	</div>
</div>
