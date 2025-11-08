<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		createRoomInFirestore,
		joinRoomInFirestore,
		onAuthChange,
		getUserProfile,
		signOut,
		type UserProfile
	} from '$lib/firebase';
	import { COLORS } from '$lib/config';

	let userProfile: UserProfile | null = null;
	let roomCode = '';
	let loading = false;
	let error = '';
	let mode: 'create' | 'join' | null = null;
	let unsubAuth: (() => void) | null = null;

	onMount(() => {
		unsubAuth = onAuthChange(async (authUser) => {
			if (!authUser) {
				await goto(resolve('/auth'));
				return;
			}

			if (!authUser.emailVerified) {
				await signOut();
				await goto(resolve('/auth'));
				return;
			}

			// Retry logic to fetch user profile
			let attempts = 0;
			const maxAttempts = 3;
			while (attempts < maxAttempts) {
				userProfile = await getUserProfile(authUser.uid);
				if (userProfile) break;
				attempts++;
				await new Promise((r) => setTimeout(r, 500));
			}

			if (!userProfile) {
				await signOut();
				await goto(resolve('/auth'));
			}
		});
	});

	onDestroy(() => {
		if (unsubAuth) unsubAuth();
	});

	const createRoom = async () => {
		if (!userProfile) {
			error = 'User profile not loaded';
			return;
		}

		loading = true;
		error = '';

		try {
			const roomId = await createRoomInFirestore(userProfile.uid, userProfile.nickname);
			await goto(resolve(`/room/${roomId}`));
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to create room.';
		} finally {
			loading = false;
		}
	};

	const joinRoom = async () => {
		if (!roomCode.trim() || !userProfile) {
			error = 'Please enter a room code.';
			return;
		}
		loading = true;
		error = '';

		try {
			const code = roomCode.trim();
			await joinRoomInFirestore(code, userProfile.uid, userProfile.nickname);
			await goto(resolve(`/room/${code}`));
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

	async function handleSignOut() {
		await signOut();
		await goto(resolve('/auth'));
	}
</script>

<!-- Rest of the template stays the same -->
<div
	class="flex min-h-screen flex-col items-center justify-center p-4"
	style="background-color: {COLORS.primary}"
>
	<div class="mb-8 text-center">
		<h1
			class="retro-text mb-2 animate-pulse text-2xl sm:text-4xl md:text-5xl"
			style="color: {COLORS.secondary}"
		>
			🎮 SUDOKU
		</h1>
		<h1
			class="retro-text mb-3 animate-pulse text-2xl sm:text-4xl md:text-5xl"
			style="color: {COLORS.secondary}"
		>
			DUEL
		</h1>
		<p class="retro-text text-[10px] text-white opacity-75 sm:text-xs">BATTLE OF NUMBERS</p>
	</div>

	{#if userProfile}
		<div class="retro-box mb-6 p-4 text-center" style="background-color: {COLORS.secondary}">
			<p class="retro-text mb-2 text-xs" style="color: {COLORS.primary}">
				👤 {userProfile.nickname}
			</p>
			<p class="text-xs" style="color: {COLORS.primary}">
				Games: {userProfile.gamesPlayed} | Won: {userProfile.gamesWon}
			</p>
		</div>
	{/if}

	<div
		class="retro-box mx-4 w-full max-w-md p-6 sm:p-8"
		style="background-color: {COLORS.secondary}"
	>
		{#if mode === null}
			<a
				href={resolve('/how-to-play')}
				class="retro-button mb-4 block bg-purple-600 py-3 text-center text-white hover:opacity-90 sm:py-4"
			>
				<span class="text-[10px] sm:text-xs">📖 HOW TO PLAY</span>
			</a>

			<a
				href={resolve('/leaderboard')}
				class="retro-button mb-4 block bg-yellow-600 py-3 text-center text-white hover:opacity-90 sm:py-4"
			>
				<span class="text-[10px] sm:text-xs">🏆 LEADERBOARD</span>
			</a>

			<div class="mb-4 grid grid-cols-2 gap-3">
				<button
					type="button"
					on:click={() => (mode = 'create')}
					class="retro-button py-3 hover:opacity-90 sm:py-4"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<span class="text-[10px] sm:text-xs">🚀 CREATE</span>
				</button>

				<button
					type="button"
					on:click={() => (mode = 'join')}
					class="retro-button py-3 hover:opacity-90 sm:py-4"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<span class="text-[10px] sm:text-xs">🎯 JOIN</span>
				</button>
			</div>

			<button
				type="button"
				on:click={handleSignOut}
				class="retro-button w-full bg-red-600 py-2 text-white hover:opacity-90"
			>
				<span class="text-[10px] sm:text-xs">🚪 SIGN OUT</span>
			</button>
		{:else if mode === 'create'}
			<div class="mb-6 text-center">
				<p class="retro-text mb-4 text-xs sm:text-sm" style="color: {COLORS.primary}">
					CREATE ROOM?
				</p>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button
					type="button"
					on:click={resetMode}
					class="retro-button bg-gray-500 py-3 text-white hover:opacity-90"
				>
					<span class="text-[10px] sm:text-xs">← BACK</span>
				</button>

				<button
					type="button"
					on:click={createRoom}
					class="retro-button py-3 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
					disabled={loading}
				>
					<span class="text-[10px] sm:text-xs">{loading ? '⏳...' : '✓ CREATE'}</span>
				</button>
			</div>
		{:else if mode === 'join'}
			<label class="retro-text mb-2 block text-[10px] sm:text-xs" style="color: {COLORS.primary}"
				>ROOM CODE:</label
			>
			<input
				type="text"
				bind:value={roomCode}
				class="retro-box mb-4 w-full bg-white px-3 py-2 text-center font-mono text-base uppercase focus:ring-4 focus:outline-none sm:py-3 sm:text-lg"
				style="focus:ring-color: {COLORS.primary}"
				placeholder="ENTER CODE"
			/>

			<div class="grid grid-cols-2 gap-3">
				<button
					type="button"
					on:click={resetMode}
					class="retro-button bg-gray-500 py-3 text-white hover:opacity-90"
				>
					<span class="text-[10px] sm:text-xs">← BACK</span>
				</button>

				<button
					type="button"
					on:click={joinRoom}
					class="retro-button py-3 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
					disabled={loading}
				>
					<span class="text-[10px] sm:text-xs">{loading ? '⏳...' : '✓ JOIN'}</span>
				</button>
			</div>
		{/if}

		{#if error}
			<div
				class="retro-box mt-4 px-3 py-2 text-center sm:mt-6 sm:py-3"
				style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
			>
				<p class="text-[10px] font-bold sm:text-xs">⚠️ {error}</p>
			</div>
		{/if}
	</div>

	<div class="mt-6 text-center sm:mt-8">
		<p class="retro-text text-[8px] text-white opacity-50 sm:text-[10px]">© 2025 SUDOKU DUEL</p>
	</div>
</div>

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
