<script lang="ts">
	import { signUp, signIn, signOut } from '$lib/firebase';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { COLORS } from '$lib/config';

	let mode: 'signin' | 'signup' = 'signin';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let nickname = '';
	let loading = false;
	let error = '';

	async function handleSignIn() {
		if (!email.trim() || !password.trim()) {
			error = 'Please enter email and password';
			return;
		}

		loading = true;
		error = '';

		try {
			const u = await signIn(email, password);
			// require email to be verified
			if (u && !u.emailVerified) {
				// sign out and show message
				await signOut();
				error =
					'Please verify your email before signing in. Check your inbox for the verification link.';
				return;
			}
			await goto(resolve('/'));
		} catch (err) {
			console.error(err);
			error = (err as Error).message || 'Failed to sign in';
		} finally {
			loading = false;
		}
	}

	async function handleSignUp() {
		if (!email.trim() || !password.trim() || !nickname.trim()) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		loading = true;
		error = '';

		try {
			await signUp(email, password, nickname);
			// inform user to verify email
			error =
				'Verification email sent. Please check your inbox and verify your email before signing in.';
			mode = 'signin';
		} catch (err) {
			console.error(err);
			error = (err as Error).message || 'Failed to sign up';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'signin' ? 'signup' : 'signin';
		error = '';
		password = '';
		confirmPassword = '';
	}
</script>

<div
	class="flex min-h-screen flex-col items-center justify-center p-4"
	style="background-color: {COLORS.primary}"
>
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
			{mode === 'signin' ? 'SIGN IN TO PLAY' : 'CREATE ACCOUNT'}
		</p>
	</div>

	<!-- Auth Card -->
	<div
		class="retro-box mx-4 w-full max-w-md p-6 sm:p-8"
		style="background-color: {COLORS.secondary}"
	>
		<h2 class="retro-text mb-6 text-center text-sm sm:text-base" style="color: {COLORS.primary}">
			{mode === 'signin' ? 'SIGN IN' : 'SIGN UP'}
		</h2>

		<!-- Email Input -->
		<label class="retro-text mb-2 block text-[10px] sm:text-xs" style="color: {COLORS.primary}"
			>EMAIL:</label
		>
		<input
			type="email"
			bind:value={email}
			class="retro-box mb-4 w-full bg-white px-3 py-2 text-center font-mono text-sm focus:ring-4 focus:outline-none sm:py-3 sm:text-base"
			style="focus:ring-color: {COLORS.primary}"
			placeholder="EMAIL@EXAMPLE.COM"
			autocomplete="email"
		/>

		<!-- Nickname (Sign Up Only) -->
		{#if mode === 'signup'}
			<label class="retro-text mb-2 block text-[10px] sm:text-xs" style="color: {COLORS.primary}"
				>NICKNAME:</label
			>
			<input
				type="text"
				bind:value={nickname}
				class="retro-box mb-4 w-full bg-white px-3 py-2 text-center font-mono text-sm uppercase focus:ring-4 focus:outline-none sm:py-3 sm:text-base"
				style="focus:ring-color: {COLORS.primary}"
				placeholder="PLAYER NAME"
				maxlength="20"
			/>
		{/if}

		<!-- Password Input -->
		<label class="retro-text mb-2 block text-[10px] sm:text-xs" style="color: {COLORS.primary}"
			>PASSWORD:</label
		>
		<input
			type="password"
			bind:value={password}
			class="retro-box mb-4 w-full bg-white px-3 py-2 text-center font-mono text-sm focus:ring-4 focus:outline-none sm:py-3 sm:text-base"
			style="focus:ring-color: {COLORS.primary}"
			placeholder="••••••••"
			autocomplete={mode === 'signin' ? 'current-password' : 'new-password'}
		/>

		<!-- Confirm Password (Sign Up Only) -->
		{#if mode === 'signup'}
			<label class="retro-text mb-2 block text-[10px] sm:text-xs" style="color: {COLORS.primary}"
				>CONFIRM:</label
			>
			<input
				type="password"
				bind:value={confirmPassword}
				class="retro-box mb-6 w-full bg-white px-3 py-2 text-center font-mono text-sm focus:ring-4 focus:outline-none sm:py-3 sm:text-base"
				style="focus:ring-color: {COLORS.primary}"
				placeholder="••••••••"
				autocomplete="new-password"
			/>
		{/if}

		<!-- Submit Button -->
		<button
			type="button"
			on:click={mode === 'signin' ? handleSignIn : handleSignUp}
			class="retro-button mb-4 w-full py-3 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
			style="background-color: {COLORS.primary}; color: {COLORS.secondary}"
			disabled={loading}
		>
			<span class="text-[10px] sm:text-xs">
				{loading ? '⏳ LOADING...' : mode === 'signin' ? '🚀 SIGN IN' : '✓ SIGN UP'}
			</span>
		</button>

		{#if mode === 'signin'}
			<div class="mb-3">
				<button
					type="button"
					on:click={async () => await goto(resolve('/how-to-play'))}
					class="retro-button w-full py-3 hover:opacity-90 sm:py-4"
					style="background-color: #6366f1; color: white;"
				>
					<span class="text-[10px] sm:text-xs">📖 HOW TO PLAY</span>
				</button>
			</div>
		{/if}

		<!-- Toggle Mode -->
		<button
			type="button"
			on:click={toggleMode}
			class="w-full text-center text-xs underline sm:text-sm"
			style="color: {COLORS.primary}"
			disabled={loading}
		>
			{mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
		</button>

		<!-- Error Message -->
		{#if error}
			<div
				class="retro-box mt-4 px-3 py-2 text-center sm:py-3"
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
