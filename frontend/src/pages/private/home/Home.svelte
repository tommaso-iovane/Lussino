<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { TableHandler, Datatable, ThSort, ThFilter } from '@vincjo/datatables';
	import { getContainers, flattenContainers, formatVulnerabilities, getVulnerabilitySeverityClass } from '../../../shared/services/containers.js';
	import Loader from '../../../shared/components/Loader.svelte';
	import ThemeToggle from '../../../shared/components/ThemeToggle.svelte';
	import { toast } from '../../../shared/services/toast.js';
	import { navigate } from '../../../shared/classes/Router.js';

	// State management
	let isLoading = $state(true);
	let containers = $state([]);
	let filteredData = $state([]);
	let table = $state(null);
	let searchValue = $state('');
	let hostnameFilter = $state('');
	let totalContainers = $state(0);
	let pollInterval = $state(null);

	// Create reactive table handler
	$effect(() => {
		if (filteredData.length > 0) {
			table = new TableHandler(filteredData, { 
				rowsPerPage: 20,
				selectBy: 'id'
			});
		}
	});

	/**
	 * Load containers data from API
	 */
	async function loadContainers(showToast = true) {
		try {
			if (showToast) isLoading = true;
			const response = await getContainers();
			
			containers = flattenContainers(response.containers);
			totalContainers = response.totalContainers;
			
			// Reapply filters to maintain current view
			applyFilters();
			
			if (showToast) {
				toast.success(`Loaded ${totalContainers} containers`);
			}
		} catch (error) {
			console.error('Failed to load containers:', error);
			if (showToast) {
				toast.error('Failed to load containers');
			}
		} finally {
			if (showToast) isLoading = false;
		}
	}

	/**
	 * Start polling for data updates
	 */
	function startPolling() {
		// Clear any existing interval
		if (pollInterval) {
			clearInterval(pollInterval);
		}
		
		// Poll every minute (60000ms)
		pollInterval = setInterval(() => {
			loadContainers(false); // Don't show loading spinner or success toast for automatic refreshes
		}, 60000);
	}

	/**
	 * Stop polling
	 */
	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	/**
	 * Apply filters to the data
	 */
	function applyFilters() {
		let filtered = containers;
		
		// Apply hostname filter
		if (hostnameFilter.trim()) {
			filtered = filtered.filter(container => 
				container.hostname.toLowerCase().includes(hostnameFilter.toLowerCase())
			);
		}
		
		// Apply search filter
		if (searchValue.trim()) {
			filtered = filtered.filter(container => 
				container.name.toLowerCase().includes(searchValue.toLowerCase()) ||
				container.repository.toLowerCase().includes(searchValue.toLowerCase()) ||
				container.tag.toLowerCase().includes(searchValue.toLowerCase())
			);
		}
		
		filteredData = filtered;
		
		// Update table data
		if (table) {
			table.setRows(filteredData);
		}
	}

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
	 * Get status badge class based on vulnerability count
	 */
	function getStatusBadgeClass(vulnerabilities) {
		if (!vulnerabilities) return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
		
		const { critical, high, medium } = vulnerabilities;
		
		if (critical > 0) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
		if (high > 0) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
		if (medium > 0) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
		
		return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
	}

	// Load data on component mount
	onMount(() => {
		loadContainers();
		startPolling();
		
		// Cleanup polling when component is destroyed
		return () => {
			stopPolling();
		};
	});
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200" in:fade={{ duration: 300 }}>
	<div class="mx-auto px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between" in:fly={{ y: -20, duration: 500, delay: 100, easing: quintOut }}>
			<div class="flex items-center">
				<div class="flex-shrink-0 w-12 h-12 bg-white dark:bg-gray-700 rounded-xl shadow-sm overflow-hidden mr-4">
					<img src="/logo.png" alt="Lussino Logo" class="w-full h-full object-contain" />
				</div>
				<div>
					<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Container Security Dashboard</h1>
					<p class="mt-2 text-gray-600 dark:text-gray-400">
						Monitor and manage your container vulnerabilities across all hosts
					</p>
				</div>
			</div>
			<div class="mt-4 sm:mt-0 flex items-center space-x-3">
				<button
					onclick={() => navigate('/profile')}
					class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 transition-colors duration-200"
				>
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
					</svg>
					Profile
				</button>
			</div>
		</div>

		<!-- Stats Overview -->
		{#if !isLoading}
			<div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" in:fly={{ y: 20, duration: 500, delay: 200, easing: quintOut }}>
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
					<div class="flex items-center">
						<div class="flex-shrink-0">
							<div class="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
								<svg class="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-7H3a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"/>
								</svg>
							</div>
						</div>
						<div class="ml-4">
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Containers</p>
							<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{totalContainers}</p>
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
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Critical Issues</p>
							<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
								{filteredData.reduce((sum, c) => sum + (c.vulnerabilities?.critical || 0), 0)}
							</p>
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
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">High Issues</p>
							<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
								{filteredData.reduce((sum, c) => sum + (c.vulnerabilities?.high || 0), 0)}
							</p>
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
							<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Scanned</p>
							<p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">
								{filteredData.filter(c => c.vulnerabilities).length}
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Data Table -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700" 
			 in:fly={{ y: 20, duration: 500, delay: 300, easing: quintOut }}>
			
			{#if isLoading}
				<div class="flex items-center justify-center py-20">
					<Loader variant="spinner" size="lg" />
				</div>
			{:else if table}
				<Datatable {table}>
					<div class="p-6">
						<!-- Search and Filters -->
						<div class="mb-6 flex flex-col sm:flex-row gap-4">
							<div class="flex-1">
								<label for="search-input" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Containers</label>
								<input 
									id="search-input"
									type="text" 
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 placeholder-gray-500 dark:placeholder-gray-400"
									placeholder="Search by name, repository, or tag..."
									bind:value={searchValue}
									oninput={applyFilters}
								/>
							</div>
							<div class="sm:w-64">
								<label for="hostname-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Hostname</label>
								<input 
									id="hostname-filter"
									type="text" 
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 dark:focus:border-primary-400 placeholder-gray-500 dark:placeholder-gray-400"
									placeholder="Filter by hostname..."
									bind:value={hostnameFilter}
									oninput={applyFilters}
								/>
							</div>
						</div>

						<!-- Table -->
						<div class="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
							<div class="overflow-x-auto">
								<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
									<thead class="bg-gray-50 dark:bg-gray-700">
										<tr>
											<ThSort {table} field="name">
												<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
													Container Name
												</span>
											</ThSort>
											<ThSort {table} field="hostname">
												<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
													Hostname
												</span>
											</ThSort>
											<ThSort {table} field="repository">
												<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
													Repository
												</span>
											</ThSort>
											<ThSort {table} field="tag">
												<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
													Tag
												</span>
											</ThSort>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
												Vulnerabilities
											</th>
											<ThSort {table} field="hasUpdate">
												<span class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 block">
													Update Available
												</span>
											</ThSort>
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
												Last Scan
											</th>
										</tr>
									</thead>
									<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
										{#each table.rows as container (container.id)}
											<tr 
												class="bg-white dark:bg-gray-800 hover:!bg-gray-50 dark:hover:!bg-gray-700 transition-colors duration-150 cursor-pointer"
												onclick={() => navigate(`/container/${container.id}`)}
												role="button"
												tabindex="0"
												onkeydown={(e) => e.key === 'Enter' && navigate(`/container/${container.id}`)}
											>
												<td class="px-6 py-4 whitespace-nowrap">
													<div class="flex items-center">
														<div class="flex-shrink-0 w-8 h-8">
															<div class="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
																<svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-7H3a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"/>
																</svg>
															</div>
														</div>
														<div class="ml-4 min-w-0 flex-1">
															<div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{container.name}</div>
															<div class="text-xs text-gray-500 dark:text-gray-400 truncate">ID: {container.id}</div>
														</div>
													</div>
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
														{container.hostname}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<div class="text-sm text-gray-900 dark:text-gray-100">{container.repository}</div>
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
														{container.tag}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadgeClass(container.vulnerabilities)}">
														{formatVulnerabilities(container.vulnerabilities)}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													{#if container.hasUpdate}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
															<svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
															</svg>
															Available
														</span>
													{:else}
														<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
															Up to date
														</span>
													{/if}
												</td>
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
													{formatDate(container.vulnerabilities?.lastScanAt)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</Datatable>
			{:else}
				<div class="text-center py-20">
					<svg class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14-7H3a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2z"/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No containers</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">No containers found in the system.</p>
				</div>
			{/if}
		</div>
	</div>
</div>