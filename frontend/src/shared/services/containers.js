import { get, post } from './http.js';
import { toast } from './toast.js';

/**
 * Container service for managing container data
 */

/**
 * Fetch all containers with vulnerability information
 * @param {string} [hostname] - Optional hostname filter
 * @returns {Promise<{containers: Array, totalContainers: number, hostnameFilter: string|null}>}
 */
export async function getContainers(hostname = null) {
	try {
		const params = new URLSearchParams();
		if (hostname) {
			params.append('hostname', hostname);
		}
		
		const url = `/api/containers/list${params.toString() ? '?' + params.toString() : ''}`;
		const data = await get(url);
		
		return data;
	} catch (error) {
		console.error('Failed to fetch containers:', error);
		toast.error('Failed to load containers');
		throw error;
	}
}

/**
 * Get container details including scans and vulnerabilities
 * @param {number} containerId - Container ID
 * @returns {Promise<Object>} Container details with scans
 */
export async function getContainerDetails(containerId) {
	try {
		const data = await get(`/api/containers/details/${containerId}`);
		return data;
	} catch (error) {
		console.error('Failed to fetch container details:', error);
		toast.error('Failed to load container details');
		throw error;
	}
}

/**
 * Flatten grouped containers for table display
 * @param {Object|Array} containers - Containers data (grouped by hostname or array)
 * @returns {Array} Flattened array of containers
 */
export function flattenContainers(containers) {
	if (Array.isArray(containers)) {
		return containers;
	}
	
	// If grouped by hostname, flatten to array
	const flattened = [];
	for (const [hostname, hostContainers] of Object.entries(containers)) {
		flattened.push(...hostContainers);
	}
	
	return flattened;
}

/**
 * Format vulnerability counts for display
 * @param {Object} vulnerabilities - Vulnerability data
 * @returns {string} Formatted vulnerability summary
 */
export function formatVulnerabilities(vulnerabilities) {
	if (!vulnerabilities) {
		return 'No scan data';
	}
	
	const { critical, high, medium, low, total } = vulnerabilities;
	const parts = [];
	
	if (critical > 0) parts.push(`${critical} Critical`);
	if (high > 0) parts.push(`${high} High`);
	if (medium > 0) parts.push(`${medium} Medium`);
	if (low > 0) parts.push(`${low} Low`);
	
	return parts.length > 0 ? parts.join(', ') : `${total} vulnerabilities`;
}

/**
 * Get vulnerability severity color class
 * @param {Object} vulnerabilities - Vulnerability data
 * @returns {string} CSS class name for severity indication
 */
export function getVulnerabilitySeverityClass(vulnerabilities) {
	if (!vulnerabilities) {
		return 'text-gray-500';
	}
	
	const { critical, high, medium } = vulnerabilities;
	
	if (critical > 0) return 'text-red-600';
	if (high > 0) return 'text-orange-500';
	if (medium > 0) return 'text-yellow-500';
	
	return 'text-green-500';
}

/**
 * Initiate vulnerability scan for all containers or specific hostname
 * @param {string} [hostname] - Optional hostname to scan specific containers only
 * @returns {Promise<Object>} Scan initiation response
 */
export async function scanAllContainers(hostname = null) {
	try {
		const payload = hostname ? { hostname } : {};
		const data = await post('/api/containers/scan-all', payload);
		
		if (data.error) {
			toast.error(data.message || 'Failed to initiate scan');
			throw new Error(data.message || 'Failed to initiate scan');
		}
		
		toast.success(data.message || 'Vulnerability scan initiated');
		return data;
	} catch (error) {
		console.error('Failed to initiate container scan:', error);
		toast.error('Failed to initiate vulnerability scan');
		throw error;
	}
}