<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getLeaderboard, type UserProfile } from '$lib/firebase';
	import { COLORS } from '$lib/config';

	let players: UserProfile[] = [];
	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			players = await getLeaderboard(50); // Get top 50 players
			loading = false;
		} catch (err) {
			console.error(err);
			error = 'Failed to load leaderboard';
			loading = false;
		}
	});

	const goHome = async () => await goto(resolve('/'));
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center p-4"
	style="background-color: {COLORS.primary}"
>
	<!-- Title -->
	<div class="mb-6 text-center">
		<h1
			class="retro-text mb-2 animate-pulse text-2xl sm:text-4xl md:text-5xl"
			style="color: {COLORS.secondary}"
		>
			🏆 LEADER
		</h1>
		<h1
			class="retro-text mb-3 animate-pulse text-2xl sm:text-4xl md:text-5xl"
			style="color: {COLORS.secondary}"
		>
			BOARD
		</h1>
	</div>

	<!-- Leaderboard Card -->
	<div
		class="retro-box mx-4 mb-6 w-full max-w-3xl p-6 sm:p-8"
		style="background-color: {COLORS.secondary}"
	>
		{#if loading}
			<div class="py-12 text-center">
				<p class="retro-text animate-pulse text-xs sm:text-sm" style="color: {COLORS.primary}">
					LOADING...
				</p>
			</div>
		{:else if error}
			<div
				class="retro-box p-4 text-center"
				style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
			>
				<p class="retro-text text-[10px] sm:text-xs">⚠️ {error}</p>
			</div>
		{:else if players.length === 0}
			<div class="py-12 text-center">
				<p class="retro-text text-xs sm:text-sm" style="color: {COLORS.primary}">NO PLAYERS YET</p>
				<p class="mt-4 text-sm" style="color: {COLORS.primary}">Be the first to win a game!</p>
			</div>
		{:else}
			<!-- Leaderboard Table -->
			<div class="space-y-2">
				{#each players as player, index (player.uid)}
					{@const rank = index + 1}
					{@const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''}
					<div
						class="retro-box flex items-center justify-between p-3 sm:p-4"
						style="background-color: {rank <= 3 ? COLORS.primary : 'white'}"
					>
						<!-- Rank and Medal -->
						<div class="flex items-center gap-2 sm:gap-3">
							<span
								class="retro-text text-sm sm:text-lg"
								style="color: {rank <= 3 ? COLORS.secondary : COLORS.primary}"
							>
								{medal || `#${rank}`}
							</span>
							<span
								class="retro-text text-[10px] break-all sm:text-xs"
								style="color: {rank <= 3 ? COLORS.secondary : COLORS.primary}"
							>
								{player.nickname}
							</span>
						</div>

						<!-- Stats -->
						<div class="flex flex-col items-end gap-1 sm:flex-row sm:gap-4">
							<div class="text-right">
								<span
									class="retro-text text-[10px] sm:text-xs"
									style="color: {rank <= 3 ? COLORS.secondary : COLORS.primary}"
								>
									🏆 {player.gamesWon}
								</span>
							</div>
							<div class="text-right">
								<span
									class="text-[10px] sm:text-xs"
									style="color: {rank <= 3 ? COLORS.secondary : COLORS.primary}"
								>
									📊 {player.gamesPlayed} games
								</span>
							</div>
							<div class="text-right">
								<span
									class="text-[10px] sm:text-xs"
									style="color: {rank <= 3 ? COLORS.secondary : COLORS.primary}"
								>
									{player.gamesPlayed > 0
										? `${Math.round((player.gamesWon / player.gamesPlayed) * 100)}%`
										: '0%'}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Back Button -->
		<div class="mt-6">
			<button
				type="button"
				on:click={goHome}
				class="retro-button w-full py-3 hover:opacity-90 sm:py-4"
				style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
			>
				<span class="text-[10px] sm:text-xs">← BACK TO HOME</span>
			</button>
		</div>
	</div>

	<!-- Footer -->
	<div class="mt-6 text-center">
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
