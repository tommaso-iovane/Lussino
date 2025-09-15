import { toast } from './toast.js'

const baseUrl = import.meta.env.VITE_BASE_URL || ''
/**
 * Handle HTTP errors and display appropriate toast messages
 * @param {Response} response - Fetch response object
 * @param {Error} error - Error object if request failed
 */
const handleError = async (response, error) => {
    let message = 'Server error';
    
    try {
        if (response) {
            // Try to extract error message from response
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                message = errorData.error || errorData.message || `HTTP ${response.status} Error`;
            } else {
                message = `HTTP ${response.status} Error`;
            }
        } else if (error) {
            // Network or other errors
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                message = 'Network error - please check your connection';
            } else {
                message = error.message || 'Request failed';
            }
        }
    } catch (parseError) {
        // If we can't parse the error response, use default message
        console.error('Error parsing error response:', parseError);
    }
    
    // Show error toast
    toast.error(message);
    
    // Return error object for further handling if needed
    return {
        error: true,
        message,
        status: response?.status || 0,
        statusText: response?.statusText || 'Unknown Error'
    };
}

/**
 * Converts a JavaScript object to a URL query string
 * Handles nested objects, arrays, and special characters
 *
 * @param {Object} obj - The object to convert
 * @param {string} [prefix=''] - Internal parameter for recursive calls
 * @returns {string} The formatted query string starting with '?'
 *
 * @example
 * const params = {
 *   limit: 25,
 *   filters: {
 *     status: [2]
 *   }
 * };
 * objectToQueryString(params); // "?limit=25&filters[status]=[2]"
 */
function objectToQueryString(obj, prefix = '') {
    // Handle null or undefined input
    if (!obj || typeof obj !== 'object') {
        return ''
    }

    const parts = Object.entries(obj)
        .map(([key, value]) => {
            // Construct the parameter key
            const paramKey = prefix ? `${prefix}[${encodeURIComponent(key)}]` : encodeURIComponent(key)

            if (value === null || value === undefined) {
                // Skip null or undefined values
                return null
            } else if (Array.isArray(value)) {
                // Handle arrays - convert to string representation
                return value.map((arrayValue) => `${paramKey}[]=${encodeURIComponent(arrayValue)}`).join('&')
            } else if (typeof value === 'object') {
                // Recursively handle nested objects
                return objectToQueryString(value, paramKey)
            } else {
                // Handle primitive values
                return `${paramKey}=${encodeURIComponent(value)}`
            }
        })
        .filter(Boolean) // Remove null entries

    // If this is the top-level call, add the '?' prefix
    const separator = prefix ? '&' : '?'
    return parts.length > 0 ? `${!prefix ? separator : ''}${parts.join('&')}` : ''
}

/**
 * @param {string} url
 * @param {*} query
 * @param {{cache: boolean}} options
 * @returns
 */
export const get = async (url, query = {}, options = { cache: false }) => {
    const querystring = objectToQueryString(query)

    try {
        const response = await fetch(`${baseUrl}${url}${querystring}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            cache: options.cache ? 'default' : 'no-cache'
        })

        if (!response.ok) {
            return await handleError(response, null);
        }

        const responseData = await response.json()
        return responseData
    } catch (error) {
        return await handleError(null, error)
    }
}

export const post = async (url, data = {}, query = {}) => {
    const querystring = objectToQueryString(query)

    try {
        const response = await fetch(`${baseUrl}${url}${querystring}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            return await handleError(response, null);
        }

        const responseData = await response.json()
        return responseData
    } catch (error) {
        return await handleError(null, error)
    }
}

export const put = async (url, data = {}, query = {}) => {
    const querystring = objectToQueryString(query)

    try {
        const response = await fetch(`${baseUrl}${url}${querystring}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })

        if (!response.ok) {
            return await handleError(response, null);
        }

        const responseData = await response.json()
        return responseData
    } catch (error) {
        return await handleError(null, error)
    }
}

export const deleteRequest = async (url, query = {}) => {
    const querystring = objectToQueryString(query)
    
    try {
        const response = await fetch(`${baseUrl}${url}${querystring}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        })

        if (!response.ok) {
            return await handleError(response, null);
        }

        const responseData = await response.json()
        return responseData
    } catch (error) {
        return await handleError(null, error)
    }
}

export default {
    get,
    post,
    put,
    deleteRequest
}
