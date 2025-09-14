<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { TableHandler, Datatable, ThSort, ThFilter } from '@vincjo/datatables';
	import { getContainerDetails } from '../../../shared/services/containers.js';
	import { getRouterParams } from '../../../shared/stores/router-params.store.js';
	import Loader from '../../../shared/components/Loader.svelte';
	import ThemeToggle from '../../../shared/components/ThemeToggle.svelte';
	import { toast } from '../../../shared/services/toast.js';
	import { navigate } from '../../../shared/classes/Router.js';

	// State management
	let isLoading = $state(true);
	let container = $state(null);
	let error = $state(null);
	let containerId = $state(null);
	let selectedScan = $state(null);
	let vulnerabilityTables = $state(new Map());

	/**
	 * Format date for display
	 */
	function formatDate(dateString) {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Get risk score badge classes based on score value (0-100 scale)
	 */
	function getRiskScoreBadgeClass(riskScore) {
		if (!riskScore || riskScore === 'N/A') {
			return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
		}
		
		const score = parseFloat(riskScore);
		if (score >= 80) {
			return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 ring-2 ring-red-500/20';
		} else if (score >= 60) {
			return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 ring-2 ring-orange-500/20';
		} else if (score >= 40) {
			return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 ring-2 ring-yellow-500/20';
		} else {
			return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 ring-2 ring-green-500/20';
		}
	}

	/**
	 * Format risk score for display (0-100 scale)
	 */
	function formatRiskScore(riskScore) {
		if (!riskScore || riskScore === 'N/A') return 'N/A';
		const score = parseFloat(riskScore);
		return isNaN(score) ? 'N/A' : Math.round(score).toString();
	}

	/**
	 * Get severity badge classes
	 */
	function getSeverityBadgeClass(severity) {
		switch (severity?.toLowerCase()) {
			case 'critical':
				return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
			case 'high':
				return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
			case 'medium':
				return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
			case 'low':
				return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
			default:
				return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
		}
	}

	/**
	 * Generate DockerHub URL for the container
	 */
	function getDockerHubUrl(repository, tag) {
		if (!repository) return null;
		
		// Handle different repository formats
		let dockerHubPath = repository;
		
		// If repository contains a registry (like registry.com/user/repo), extract just the user/repo part
		if (repository.includes('/')) {
			const parts = repository.split('/');
			// For official Docker Hub images, they might be in format: docker.io/library/nginx or just nginx
			if (parts.length >= 2) {
				// Take the last two parts for user/repo format
				dockerHubPath = parts.slice(-2).join('/');
			}
			// If it starts with docker.io/library, it's an official image
			if (repository.startsWith('docker.io/library/')) {
				dockerHubPath = parts[parts.length - 1]; // Just the image name for official images
			}
		}
		
		// Build the DockerHub URL
		const baseUrl = 'https://hub.docker.com/r/';
		const officialUrl = 'https://hub.docker.com/_/';
		
		// Check if it's likely an official image (no slash in the final path)
		if (!dockerHubPath.includes('/')) {
			return `${officialUrl}${dockerHubPath}`;
		}
		
		return `${baseUrl}${dockerHubPath}`;
	}

	/**
	 * Get vulnerability summary from scan
	 */
	function getVulnerabilitySummary(scan) {
		if (!scan.summary) return { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
		return scan.summary;
	}

	/**
	 * Add unique ID to vulnerability objects to handle duplicate CVE IDs
	 */
	function addUniqueIdsToVulnerabilities(vulnerabilities) {
		return vulnerabilities.map((vuln, index) => ({
			...vuln,
			uniqueId: `${vuln.cveId}-${vuln.package.name}-${vuln.package.version}-${index}`
		}));
	}

	/**
	 * Toggle scan details visibility
	 */
	function toggleScanDetails(scanId) {
		if (selectedScan === scanId) {
			selectedScan = null;
			vulnerabilityTables.delete(scanId);
		} else {
			selectedScan = scanId;
			const scan = container.scans.find(s => s.scanId === scanId);
			if (scan && scan.vulnerabilities) {
				const vulnerabilitiesWithIds = addUniqueIdsToVulnerabilities(scan.vulnerabilities);
				const table = new TableHandler(vulnerabilitiesWithIds, {
					rowsPerPage: 10,
					selectBy: 'uniqueId'
				});
				vulnerabilityTables.set(scanId, table);
			}
		}
	}

	/**
	 * Load container details
	 */
	async function loadContainerDetails() {
		try {
			isLoading = true;
			error = null;

			// Get container ID from router params
			const routerParams = getRouterParams();
			containerId = routerParams?.params?.containerid;

			if (!containerId) {
				error = 'Container ID not provided';
				return;
			}

			const containerIdNum = parseInt(containerId);
			if (isNaN(containerIdNum)) {
				error = 'Invalid container ID';
				return;
			}

			// Fetch container details
			const response = await getContainerDetails(containerIdNum);
			container = response;

			if (!container) {
				error = 'Container not found';
				return;
			}

			// Auto-expand the first (latest) scan
			if (container.scans && container.scans.length > 0) {
				const firstScan = container.scans[0];
				selectedScan = firstScan.scanId;
				if (firstScan.vulnerabilities) {
					const vulnerabilitiesWithIds = addUniqueIdsToVulnerabilities(firstScan.vulnerabilities);
					const table = new TableHandler(vulnerabilitiesWithIds, {
						rowsPerPage: 10,
						selectBy: 'uniqueId'
					});
					vulnerabilityTables.set(firstScan.scanId, table);
				}
			}

			toast.success(`Loaded details for container ${container.name}`);
		} catch (err) {
			console.error('Failed to load container details:', err);
			error = 'Failed to load container details';
			toast.error('Failed to load container details');
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Navigate back to containers list
	 */
	function goBack() {
		navigate('/home');
	}

	// Load data on component mount
	onMount(() => {
		loadContainerDetails();
	});
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200" in:fade={{ duration: 300 }}>
	<div class="mx-auto px-4 py-8">
		{#if isLoading}
			<div class="flex items-center justify-center py-20">
				<Loader variant="spinner" size="lg" text="Loading container details..." />
			</div>
		{:else if error}
			<div class="text-center py-20" in:fly={{ y: 20, duration: 500, delay: 100, easing: quintOut }}>
				<svg class="mx-auto h-12 w-12 text-red-400 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Error Loading Container</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
				<div class="mt-6">
					<button onclick={goBack} class="btn-primary">
						← Back to Containers
					</button>
				</div>
			</div>
		{:else if container}
			<!-- Header with navigation and theme toggle -->
			<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between" in:fly={{ y: -20, duration: 500, delay: 100, easing: quintOut }}>
				<div class="flex items-center gap-4">
					<button 
						onclick={goBack}
						class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
						aria-label="Back to containers"
					>
						<svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
						</svg>
					</button>
					<div>
						<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Container Details</h1>
						<p class="mt-2 text-gray-600 dark:text-gray-400">
							Detailed vulnerability analysis for {container.name}
						</p>
					</div>
				</div>
				<div class="mt-4 sm:mt-0">
					<ThemeToggle size="md" variant="button" />
				</div>
			</div>

			<!-- Container Overview -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8" 
				 in:fly={{ y: 20, duration: 500, delay: 200, easing: quintOut }}>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Container Name</dt>
						<dd class="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{container.name}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Repository</dt>
						<dd class="mt-1 flex items-center gap-2">
							<span class="text-sm text-gray-900 dark:text-gray-100">{container.repository}</span>
							{#if getDockerHubUrl(container.repository, container.tag)}
								<a 
									href={getDockerHubUrl(container.repository, container.tag)}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center text-xs text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
									title="View on DockerHub"
								>
									<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
									</svg>
									DockerHub
								</a>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Tag</dt>
						<dd class="mt-1">
							<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
								{container.tag}
							</span>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Hostname</dt>
						<dd class="mt-1">
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
								{container.hostname}
							</span>
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Update Status</dt>
						<dd class="mt-1">
							{#if container.hasUpdate}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
									<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
									</svg>
									Update Available
								</span>
							{:else}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
									<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									Up to Date
								</span>
							{/if}
						</dd>
					</div>
				</div>
			</div>

			<!-- Container Statistics -->
			{#if container.scans && container.scans.length > 0}
				{@const latestScan = container.scans[0]}
				{@const summary = getVulnerabilitySummary(latestScan)}
				
				<div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8" in:fly={{ y: 20, duration: 500, delay: 300, easing: quintOut }}>
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div class="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
									<svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>
							</div>
							<div class="ml-4">
								<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Issues</p>
								<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.total}</p>
							</div>
						</div>
					</div>
					
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div class="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
									<svg class="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
									</svg>
								</div>
							</div>
							<div class="ml-4">
								<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Critical</p>
								<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.critical}</p>
							</div>
						</div>
					</div>
					
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
									<svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>
							</div>
							<div class="ml-4">
								<p class="text-sm font-medium text-gray-500 dark:text-gray-400">High</p>
								<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.high}</p>
							</div>
						</div>
					</div>
					
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div class="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
									<svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>
							</div>
							<div class="ml-4">
								<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Medium</p>
								<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.medium}</p>
							</div>
						</div>
					</div>
					
					<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<div class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
									<svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
								</div>
							</div>
							<div class="ml-4">
								<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Low</p>
								<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{summary.low}</p>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Scans History -->
			{#if container.scans && container.scans.length > 0}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" 
					 in:fly={{ y: 20, duration: 500, delay: 400, easing: quintOut }}>
					<div class="p-6">
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Scan History</h2>
						
						<div class="space-y-4">
							{#each container.scans as scan, index (scan.scanId)}
								{@const summary = getVulnerabilitySummary(scan)}
								<div class="border border-gray-200 dark:border-gray-700 rounded-lg">
									<!-- Scan Header -->
									<button 
										onclick={() => toggleScanDetails(scan.scanId)}
										class="w-full p-4 text-left bg-white dark:bg-gray-800 hover:!bg-gray-50 dark:hover:!bg-gray-700 transition-colors duration-150 rounded-t-lg flex items-center justify-between"
									>
										<div class="flex-1">
											<div class="flex items-center justify-between">
												<div>
													<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
														Scan #{scan.scanId}
														{#if index === 0}
															<span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
																Latest
															</span>
														{/if}
													</h3>
													<p class="text-sm text-gray-500 dark:text-gray-400">
														{formatDate(scan.scanTimestamp)} • Grype {scan.grypVersion}
													</p>
												</div>
												<div class="flex items-center gap-4">
													<!-- Vulnerability summary badges -->
													{#if summary.critical > 0}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
															{summary.critical} Critical
														</span>
													{/if}
													{#if summary.high > 0}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
															{summary.high} High
														</span>
													{/if}
													{#if summary.medium > 0}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
															{summary.medium} Medium
														</span>
													{/if}
													{#if summary.low > 0}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
															{summary.low} Low
														</span>
													{/if}
													
													<!-- Total vulnerabilities -->
													<div class="text-right">
														<div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{summary.total}</div>
														<div class="text-xs text-gray-500 dark:text-gray-400">Total Issues</div>
													</div>
												</div>
											</div>
										</div>
										
										<!-- Expand/Collapse icon -->
										<div class="ml-4">
											<svg class="w-5 h-5 text-gray-400 dark:text-gray-500 transition-transform duration-200 {selectedScan === scan.scanId ? 'rotate-180' : ''}" 
												 fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
											</svg>
										</div>
									</button>

									<!-- Scan Details (Vulnerabilities Table) -->
									{#if selectedScan === scan.scanId && vulnerabilityTables.has(scan.scanId)}
										{@const table = vulnerabilityTables.get(scan.scanId)}
										<div class="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900/50" 
											 in:fly={{ y: -20, duration: 300 }}>
											<h4 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Vulnerability Details</h4>
											
											{#if scan.vulnerabilities && scan.vulnerabilities.length > 0}
												<Datatable {table}>
													<div class="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
														<div class="overflow-x-auto">
															<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
																<thead class="bg-gray-50 dark:bg-gray-700">
																	<tr>
																		<ThSort {table} field="cveId">
																			<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
																				CVE ID
																			</span>
																		</ThSort>
																		<ThSort {table} field="severity">
																			<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
																				Severity
																			</span>
																		</ThSort>
																		<ThSort {table} field="riskScore">
																			<span class="px-6 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block border-l-4 border-orange-400 dark:border-orange-500">
																				🔥 Risk Score
																			</span>
																		</ThSort>
																		<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
																			Package
																		</th>
																		<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
																			Fixed Version
																		</th>
																		<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
																			Description
																		</th>
																	</tr>
																</thead>
																<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
																	{#each table.rows as vuln (vuln.uniqueId)}
																		<tr class="bg-white dark:bg-gray-800 hover:!bg-gray-50 dark:hover:!bg-gray-700 transition-colors duration-150">
																			<td class="px-6 py-4 whitespace-nowrap">
																				<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
																					{vuln.cveId}
																				</div>
																			</td>
																			<td class="px-6 py-4 whitespace-nowrap">
																				<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getSeverityBadgeClass(vuln.severity)}">
																					{vuln.severity}
																				</span>
																			</td>
																			<td class="px-6 py-4 whitespace-nowrap">
																				<div class="flex items-center justify-center">
																					<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold shadow-sm {getRiskScoreBadgeClass(vuln.riskScore)}">
																						{formatRiskScore(vuln.riskScore)}
																					</span>
																				</div>
																			</td>
																			<td class="px-6 py-4 whitespace-nowrap">
																				<div class="text-sm font-medium text-gray-900 dark:text-gray-100">
																					{vuln.package.name}
																				</div>
																				<div class="text-xs text-gray-500 dark:text-gray-400">
																					v{vuln.package.version} ({vuln.package.type})
																				</div>
																			</td>
																			<td class="px-6 py-4 whitespace-nowrap">
																				{#if vuln.package.fixedVersion}
																					<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
																						v{vuln.package.fixedVersion}
																					</span>
																				{:else}
																					<span class="text-sm text-gray-500 dark:text-gray-400">No fix available</span>
																				{/if}
																			</td>
																			<td class="px-6 py-4">
																				<div class="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
																					{vuln.description || 'No description available'}
																				</div>
																				{#if vuln.urls && vuln.urls.length > 0}
																					<div class="mt-1">
																						<a 
																							href={vuln.urls[0]} 
																							target="_blank" 
																							rel="noopener noreferrer"
																							class="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-900 dark:hover:text-primary-300"
																						>
																							View Details →
																						</a>
																					</div>
																				{/if}
																			</td>
																		</tr>
																	{/each}
																</tbody>
															</table>
														</div>
													</div>
												</Datatable>
											{:else}
												<div class="text-center py-8">
													<svg class="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
													</svg>
													<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No vulnerabilities found in this scan</p>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{:else}
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center" 
					 in:fly={{ y: 20, duration: 500, delay: 400, easing: quintOut }}>
					<svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No Scans Available</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">This container has not been scanned yet.</p>
				</div>
			{/if}

			<!-- TODO: Scans History Section and Vulnerability Tables will be added in next steps -->
		{/if}
	</div>
</div>
