<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { doc, onSnapshot } from 'firebase/firestore';
	import {
		db,
		startGameInFirestore,
		onAuthChange,
		getUserProfile,
		type UserProfile
	} from '$lib/firebase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { COLORS, GAME_CONFIG } from '$lib/config';

	interface PlayerData {
		uid: string;
		nickname: string;
		isCurrentPlayer?: boolean;
		lives?: number;
	}

	export let data: { code: string };

	let room: {
		code: string;
		host?: string;
		players?: { [uid: string]: PlayerData };
		createdAt?: Date | null;
		game?: {
			started?: boolean;
		};
	} | null = null;

	let loading = true;
	let authLoading = true;
	let error = '';
	let unsub: (() => void) | null = null;
	let user: { uid: string; emailVerified: boolean } | null = null;
	let userProfile: UserProfile | null = null;

	onMount(() => {
		const unsubAuth = onAuthChange(async (authUser) => {
			user = authUser;
			if (authUser) {
				// require email verified
				if (!authUser.emailVerified) {
					await goto(resolve('/auth'));
					return;
				}

				userProfile = await getUserProfile(authUser.uid);
				if (!userProfile) {
					await goto(resolve('/auth'));
					return;
				}
				authLoading = false;
			} else {
				await goto(resolve('/auth'));
				return;
			}
		});

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

		return () => {
			if (unsub) unsub();
			unsubAuth();
		};
	});

	onDestroy(() => {
		if (unsub) unsub();
	});

	let starting = false;
	async function onStartGame() {
		if (!user) return;

		starting = true;
		try {
			await startGameInFirestore(data.code);
			await goto(resolve(`/room/${data.code}/game`));
		} catch (err) {
			console.error(err);
			error = (err as Error)?.message ?? 'Failed to start game';
		} finally {
			starting = false;
		}
	}

	async function onJoinGame() {
		if (user) {
			await goto(resolve(`/room/${data.code}/game`));
		} else {
			error = 'You must be logged in';
		}
	}

	const goHome = async () => await goto(resolve('/'));

	$: playersList = room?.players ? Object.values(room.players) : [];
	$: playerCount = playersList.length;
	$: isHost = user && room?.host === user.uid;
</script>

<div
	class="flex min-h-screen items-center justify-center p-4"
	style="background-color: {COLORS.primary}"
>
	{#if authLoading}
		<!-- Loading state while checking authentication -->
		<div class="text-center">
			<h1
				class="retro-text mb-4 animate-pulse text-2xl sm:text-4xl md:text-5xl"
				style="color: {COLORS.secondary}"
			>
				🎮 SUDOKU DUEL
			</h1>
			<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.secondary}">
				LOADING...
			</p>
		</div>
	{:else}
		<div class="retro-box w-full max-w-5xl p-6 sm:p-8" style="background-color: {COLORS.secondary}">
			<!-- Header -->
			<div
				class="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center"
			>
				<div class="w-full sm:w-auto">
					<h1 class="retro-text mb-2 text-base sm:text-xl" style="color: {COLORS.primary}">
						🎮 LOBBY
					</h1>
					<div
						class="retro-box inline-flex items-center gap-2 px-3 py-2"
						style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
					>
						<p class="retro-text text-[10px] break-all sm:text-xs">CODE: {data.code}</p>
						<!-- inline this button to the code -->
						<button
							type="button"
							on:click={() => {
								navigator.clipboard.writeText(data.code);
							}}
							class="retro-button px-2 py-1 hover:opacity-90"
							style="background-color: {COLORS.secondary}; color: {COLORS.primary}"
						>
							<span class="text-[8px] sm:text-[10px]"> 📋 </span>
						</button>
					</div>
				</div>
				<button
					type="button"
					on:click={goHome}
					class="retro-button w-full px-3 py-2 hover:opacity-90 sm:w-auto"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<span class="text-[10px] sm:text-xs">❌ EXIT</span>
				</button>
			</div>

			{#if loading}
				<div class="py-8 text-center sm:py-12">
					<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.primary}">
						LOADING...
					</p>
				</div>
			{:else if error}
				<div
					class="retro-box mb-4 px-4 py-3 text-center sm:mb-6"
					style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
				>
					<p class="retro-text text-[10px] sm:text-xs">⚠️ {error}</p>
				</div>
			{:else if room}
				<!-- Players Section -->
				<div class="retro-box mb-4 bg-white p-4 sm:mb-6 sm:p-6">
					<h2
						class="retro-text mb-3 text-[10px] sm:mb-4 sm:text-xs"
						style="color: {COLORS.primary}"
					>
						👥 PLAYERS ({playerCount}/{GAME_CONFIG.maxPlayers})
					</h2>
					<div class="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2">
						{#each playersList as player (player.uid)}
							<div
								class="retro-box flex flex-col items-start justify-between gap-2 p-3 sm:flex-row sm:items-center sm:p-4"
								style="background-color: {COLORS.secondary}"
							>
								<div class="flex items-center gap-2 sm:gap-3">
									<span class="text-xl sm:text-2xl">🎯</span>
									<span
										class="retro-text text-[10px] break-all sm:text-xs"
										style="color: {COLORS.primary}">{player.nickname}</span
									>
								</div>
								{#if player.uid === room.host}
									<span
										class="retro-box self-start px-2 py-1 sm:self-center"
										style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
									>
										<span class="retro-text text-[8px] sm:text-[10px]">👑 HOST</span>
									</span>
								{/if}
							</div>
						{/each}

						{#if playerCount < GAME_CONFIG.maxPlayers}
							<div class="retro-box border-dashed bg-white p-3 sm:p-4">
								<p class="retro-text text-center text-[10px] text-gray-500 sm:text-xs">
									WAITING...
								</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex flex-col gap-3 sm:gap-4">
					{#if isHost}
						<button
							class="retro-button py-3 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
							style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
							on:click={onStartGame}
							disabled={starting || room.game?.started || playerCount < GAME_CONFIG.minPlayers}
						>
							<span class="text-[10px] sm:text-xs">
								{starting ? '⏳ STARTING...' : room.game?.started ? '✓ STARTED' : '🚀 START GAME'}
							</span>
						</button>
					{/if}

					{#if room.game?.started}
						<button
							class="retro-button py-3 hover:opacity-90 disabled:opacity-50 sm:py-4"
							style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
							on:click={onJoinGame}
							disabled={!user}
						>
							<span class="text-[10px] sm:text-xs">🎯 JOIN GAME</span>
						</button>
					{/if}
				</div>

				{#if playerCount < GAME_CONFIG.minPlayers}
					<div
						class="retro-box mt-4 px-4 py-3 text-center sm:mt-6"
						style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
					>
						<p class="retro-text text-[10px] sm:text-xs">
							⚠️ NEED {GAME_CONFIG.minPlayers} PLAYERS
						</p>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

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
