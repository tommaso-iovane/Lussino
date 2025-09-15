import { Hono } from 'hono'
import { agentTokenIsValid, isLogged } from '../middlewares/auth-middleware'
import { updateContainersByHostname, getContainersWithVulnerabilities, getContainerDetails } from '../repository/containers'
import { deferScanAllByHostname, scanAllContainers } from '../repository/grype'
import { checkAllContainersForUpdates } from '../repository/updates'

const containersRoutes = new Hono()


containersRoutes.post('/update-containers', agentTokenIsValid, async (c) => {
    try {
        const body = await c.req.json()
        if (!body.hostname) {
            return c.json({ error: 'hostname is required' }, 422)
        }

        // Update containers for a specific hostname
        const result = updateContainersByHostname(body.hostname, body.containers)

        deferScanAllByHostname(body.hostname)
        checkAllContainersForUpdates(body.hostname)

        return c.json({
            added: result.totalAdded,
            removed: result.removedCount
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
        const body = await c.req.json()
        const hostname = body?.hostname // Optional: scan specific hostname only
        
        if (hostname) {
            // Scan containers for specific hostname
            deferScanAllByHostname(hostname)
            return c.json({ 
                message: `Vulnerability scan initiated for hostname: ${hostname}`,
                hostname: hostname
            })
        } else {
            // Scan all containers
            scanAllContainers()
            return c.json({ 
                message: 'Vulnerability scan initiated for all containers'
            })
        }
        
    } catch (error) {
        console.error('Failed to initiate container scan:', error)
        return c.json({ error: 'Internal server error' }, 500)
    }
})


export default containersRoutes