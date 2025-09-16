<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { TableHandler, Datatable, ThSort, ThFilter } from '@vincjo/datatables';
	import { getContainers, flattenContainers, formatVulnerabilities, getVulnerabilitySeverityClass, deleteContainer } from '../../../shared/services/containers.js';
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
	let containerToDelete = $state(null);
	let showDeleteDialog = $state(false);

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
	 * Show delete confirmation dialog
	 */
	function confirmDelete(container) {
		containerToDelete = container;
		showDeleteDialog = true;
	}

	/**
	 * Handle container deletion
	 */
	async function handleDelete() {
		if (!containerToDelete) return;
		
		try {
			await deleteContainer(containerToDelete.id);
			
			// Refresh the containers list
			await loadContainers(false);
			
			// Close dialog
			showDeleteDialog = false;
			containerToDelete = null;
		} catch (error) {
			console.error('Failed to delete container:', error);
		}
	}

	/**
	 * Cancel delete operation
	 */
	function cancelDelete() {
		showDeleteDialog = false;
		containerToDelete = null;
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
				<div class="inline-flex items-center px-4 py-2 border border-blue-200 dark:border-blue-800 shadow-sm text-sm font-medium rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20">
					<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					Scanning handled by agents
				</div>
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
											<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
												Actions
											</th>
										</tr>
									</thead>
									<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
										{#each table.rows as container (container.id)}
											<tr class="bg-white dark:bg-gray-800 hover:!bg-gray-50 dark:hover:!bg-gray-700 transition-colors duration-150">
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
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
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
														{container.hostname}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
													<div class="text-sm text-gray-900 dark:text-gray-100">{container.repository}</div>
												</td>
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
													<span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
														{container.tag}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadgeClass(container.vulnerabilities)}">
														{formatVulnerabilities(container.vulnerabilities)}
													</span>
												</td>
												<td class="px-6 py-4 whitespace-nowrap cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
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
												<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 cursor-pointer" 
													onclick={() => navigate(`/container/${container.id}`)}>
													{formatDate(container.vulnerabilities?.lastScanAt)}
												</td>
												<td class="px-6 py-4 whitespace-nowrap">
													<button
														onclick={(e) => {
															e.stopPropagation();
															confirmDelete(container);
														}}
														class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
														title="Delete container"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
														</svg>
													</button>
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

<!-- Delete Confirmation Dialog -->
{#if showDeleteDialog && containerToDelete}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4" 
		 onclick={cancelDelete} 
		 in:fade={{ duration: 200 }}>
		<div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" 
			 onclick={(e) => e.stopPropagation()}
			 in:fly={{ y: 20, duration: 300 }}>
			
			<!-- Dialog Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
				<div class="flex items-center gap-3">
					<div class="flex-shrink-0">
						<div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
							<svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
							</svg>
						</div>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Container</h3>
						<p class="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
					</div>
				</div>
				<button
					onclick={cancelDelete}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<!-- Dialog Content -->
			<div class="p-6">
				<p class="text-sm text-gray-700 dark:text-gray-300 mb-4">
					Are you sure you want to delete the container <strong>{containerToDelete.name}</strong>? 
					This will permanently remove the container and all its vulnerability scan data.
				</p>
				<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
							</svg>
						</div>
						<div class="ml-3">
							<p class="text-sm text-yellow-700 dark:text-yellow-300">
								<strong>Warning:</strong> This will delete all vulnerability scans and historical data for this container.
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Dialog Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
				<button
					onclick={cancelDelete}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleDelete}
					class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
				>
					Delete Container
				</button>
			</div>
		</div>
	</div>
{/if}