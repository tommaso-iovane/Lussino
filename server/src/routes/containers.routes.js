import { Hono } from 'hono'
import { agentTokenIsValid, isLogged } from '../middlewares/auth-middleware'
import { updateContainersByHostname, getContainersWithVulnerabilities, getContainerDetails, updateSingleContainer, deleteContainer } from '../repository/containers'
import { checkAllContainersForUpdates, checkContainerForUpdates } from '../repository/updates'

const containersRoutes = new Hono()

// New endpoint for individual container updates with scan data
containersRoutes.post('/update-container', agentTokenIsValid, async (c) => {
    try {
        const body = await c.req.json()
        
        if (!body.hostname) {
            return c.json({ error: 'hostname is required' }, 422)
        }
        
        if (!body.container) {
            return c.json({ error: 'container data is required' }, 422)
        }
        
        // Update single container with scan data
        const result = updateSingleContainer(body.hostname, body.container, body.scanData)
        
        checkContainerForUpdates(result.containerId) // We'll implement this if needed
        
        return c.json({
            containerId: result.containerId,
            updated: result.updated,
            vulnerabilitiesFound: result.vulnerabilitiesCount
        })
    } catch (error) {
        console.error('Error updating container:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Keep the old bulk endpoint for backward compatibility (deprecated)
containersRoutes.post('/update-containers', agentTokenIsValid, async (c) => {
    try {
        const body = await c.req.json()
        if (!body.hostname) {
            return c.json({ error: 'hostname is required' }, 422)
        }

        // Update containers for a specific hostname
        const result = updateContainersByHostname(body.hostname, body.containers)
        checkAllContainersForUpdates(body.hostname)

        return c.json({
            added: result.totalAdded,
            removed: result.removedCount,
            message: 'This endpoint is deprecated. Use /update-container for individual updates with scanning.'
        })
    } catch (error) {
        console.log(error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

containersRoutes.get('/list', isLogged, async (c) => {
    try {
        const hostname = c.req.query('hostname')
        
        // Get containers with vulnerability counts
        const containersWithVulns = getContainersWithVulnerabilities(hostname)
        
        // Group by hostname for better organization when showing all
        if (!hostname) {
            const groupedContainers = containersWithVulns.reduce((acc, container) => {
                if (!acc[container.hostname]) {
                    acc[container.hostname] = []
                }
                acc[container.hostname].push(container)
                return acc
            }, {})
            
            return c.json({
                containers: groupedContainers,
                totalContainers: containersWithVulns.length,
                hostnameFilter: null
            })
        }
        
        return c.json({
            containers: containersWithVulns,
            totalContainers: containersWithVulns.length,
            hostnameFilter: hostname
        })
        
    } catch (error) {
        console.error('Failed to list containers:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

containersRoutes.get('/details/:id', isLogged, async (c) => {
    try {
        const containerId = c.req.param('id')
        const containerIdNum = parseInt(containerId)
        
        if (!containerId || isNaN(containerIdNum)) {
            return c.json({ error: 'Valid container ID is required' }, 400)
        }
        
        const containerDetails = getContainerDetails(containerIdNum)
        
        if (!containerDetails) {
            return c.json({ error: 'Container not found' }, 404)
        }
        
        return c.json(containerDetails)
        
    } catch (error) {
        console.error('Failed to get container details:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

containersRoutes.post('/scan-all', isLogged, async (c) => {
    try {
        return c.json({ 
            message: 'Container scanning is now handled by distributed agents. Deploy agents on your target hosts to automatically scan containers.',
            deprecated: true,
            instructions: 'Run the Lussino agent script on each host where you want to scan containers.'
        })
        
    } catch (error) {
        console.error('Failed to respond to scan request:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})

// Delete container endpoint
containersRoutes.delete('/delete/:id', isLogged, async (c) => {
    try {
        const containerId = c.req.param('id')
        const containerIdNum = parseInt(containerId)
        
        if (!containerId || isNaN(containerIdNum)) {
            return c.json({ error: 'Valid container ID is required' }, 400)
        }
        
        const result = deleteContainer(containerIdNum)
        
        if (!result.success) {
            return c.json({ error: 'Container not found or could not be deleted' }, 404)
        }
        
        return c.json({ 
            message: 'Container and all associated data deleted successfully',
            deletedScans: result.deletedScans
        })
        
    } catch (error) {
        console.error('Failed to delete container:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})


export default containersRoutes