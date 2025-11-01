<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		createRoomInFirestore,
		joinRoomInFirestore,
		onAuthChange,
		getUserProfile,
		signOut,
		type UserProfile
	} from '$lib/firebase';
	import { COLORS } from '$lib/config';

	let user: any = null;
	let userProfile: UserProfile | null = null;
	let roomCode = '';
	let loading = false;
	let error = '';
	let mode: 'create' | 'join' | null = null;
	let authLoading = true;

	onMount(() => {
		const unsubscribe = onAuthChange(async (authUser) => {
			user = authUser;
			authLoading = false;

			if (authUser) {
				userProfile = await getUserProfile(authUser.uid);
				if (!userProfile) {
					// User doesn't have a profile, sign them out
					await signOut();
					goto('/auth');
				}
			} else {
				goto('/auth');
			}
		});

		return () => unsubscribe();
	});

	const createRoom = async () => {
		if (!user || !userProfile) return;

		loading = true;
		error = '';

		try {
			const roomId = await createRoomInFirestore(user.uid, userProfile.nickname);
			goto(`/room/${roomId}`);
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to create room.';
		} finally {
			loading = false;
		}
	};

	const joinRoom = async () => {
		if (!user || !userProfile) return;

		if (!roomCode.trim()) {
			error = 'Please enter a room code.';
			return;
		}
		loading = true;
		error = '';

		try {
			const code = roomCode.trim();
			await joinRoomInFirestore(code, user.uid, userProfile.nickname);
			goto(`/room/${code}`);
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to join room.';
		} finally {
			loading = false;
		}
	};

	async function handleSignOut() {
		await signOut();
		goto('/auth');
	}

	function resetMode() {
		mode = null;
		roomCode = '';
		error = '';
	}
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center p-4"
	style="background-color: {COLORS.primary}"
>
	{#if authLoading}
		<!-- Loading State -->
		<div class="text-center">
			<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.secondary}">
				LOADING...
			</p>
		</div>
	{:else if !user || !userProfile}
		<!-- Redirecting to auth -->
		<div class="text-center">
			<p class="retro-text text-xs sm:text-sm" style="color: {COLORS.secondary}">REDIRECTING...</p>
		</div>
	{:else}
		<!-- Title -->
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
			<p class="retro-text text-[10px] text-white opacity-75 sm:text-xs">
				WELCOME {userProfile.nickname}
			</p>
		</div>

		<!-- Main Card -->
		<div
			class="retro-box mx-4 w-full max-w-md p-6 sm:p-8"
			style="background-color: {COLORS.secondary}"
		>
			{#if mode === null}
				<!-- Initial Mode Selection -->
				<div class="retro-box mb-6 bg-white p-4 text-center">
					<p class="retro-text mb-2 text-[10px] sm:text-xs" style="color: {COLORS.primary}">
						PLAYER:
					</p>
					<p class="text-sm font-bold sm:text-base" style="color: {COLORS.primary}">
						{userProfile.nickname}
					</p>
					<p class="mt-2 text-xs text-gray-600">
						Games: {userProfile.gamesPlayed} | Won: {userProfile.gamesWon}
					</p>
				</div>

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
					class="w-full text-center text-xs underline sm:text-sm"
					style="color: {COLORS.primary}"
				>
					Sign Out
				</button>
			{:else if mode === 'create'}
				<!-- Create Room Confirmation -->
				<div class="mb-6 text-center">
					<p class="retro-text mb-4 text-xs sm:text-sm" style="color: {COLORS.primary}">
						CREATE ROOM?
					</p>
					<p class="mb-4 text-sm" style="color: {COLORS.primary}">
						Player: <span class="font-bold">{userProfile.nickname}</span>
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
				<!-- Join Room -->
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

			<!-- Error Message -->
			{#if error}
				<div
					class="retro-box mt-4 px-3 py-2 text-center sm:mt-6 sm:py-3"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<p class="text-[10px] font-bold sm:text-xs">⚠️ {error}</p>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="mt-6 text-center sm:mt-8">
			<p class="retro-text text-[8px] text-white opacity-50 sm:text-[10px]">© 2025 SUDOKU DUEL</p>
		</div>
	{/if}
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
